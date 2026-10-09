import { supabase } from '../lib/supabase';
import { ensureValidUuid } from './courseService';

const LOCAL_ROUNDS_KEY = 'golf_notes_rounds';
const LOCAL_GREEN_PINS_PREFIX = 'green_pin_';

/**
 * 1. SAVE COMPLETED ROUND TO SUPABASE (With Local Fallback)
 */
export async function saveCompletedRound(completedRound, userId) {
  const roundUuid = ensureValidUuid(completedRound.id);
  const courseUuid = ensureValidUuid(completedRound.courseId || completedRound.courseName);
  const canonicalRound = { ...completedRound, id: roundUuid, courseId: courseUuid };

  // Always update local storage first with canonical UUID so user never loses round or has duplicates
  let localRounds = [];
  try {
    const raw = localStorage.getItem(LOCAL_ROUNDS_KEY);
    localRounds = raw ? JSON.parse(raw) : [];
    const exists = localRounds.some(r => r.id === roundUuid || r.id === completedRound.id || (r.courseName === completedRound.courseName && r.totalScore === completedRound.totalScore));
    if (!exists) {
      localRounds = [canonicalRound, ...localRounds];
    } else {
      localRounds = localRounds.map(r => (r.id === roundUuid || r.id === completedRound.id || (r.courseName === completedRound.courseName && r.totalScore === completedRound.totalScore)) ? canonicalRound : r);
    }
    localStorage.setItem(LOCAL_ROUNDS_KEY, JSON.stringify(localRounds));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }

  if (!userId) {
    return { success: true, localOnly: true, round: canonicalRound };
  }

  try {
    // A. Ensure course exists in 'courses' table to satisfy Foreign Key constraint
    try {
      const { data: existingCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('id', courseUuid)
        .maybeSingle();

      if (!existingCourse) {
        await supabase.from('courses').upsert({
          id: courseUuid,
          name: completedRound.courseName || 'Played Course',
          location: completedRound.courseLocation || 'Local Course',
          par: 72,
          is_custom: false,
        });
      }
    } catch (courseErr) {
      console.warn('Course foreign key pre-check warning:', courseErr);
    }

    // B. Insert / Upsert into 'rounds' table
    const roundRow = {
      id: roundUuid,
      user_id: userId,
      course_id: courseUuid,
      course_name: completedRound.courseName || 'Played Track',
      guest_count: completedRound.guestCount || 0,
      current_hole: 18,
      total_score: completedRound.totalScore || 0,
      status: completedRound.status || 'completed',
      completed_at: new Date().toISOString(),
    };

    const { error: roundError } = await supabase
      .from('rounds')
      .upsert(roundRow);

    if (roundError) {
      console.error('Supabase rounds insert error:', roundError);
      return { success: false, error: roundError.message, localSaved: true };
    }

    // C. Insert hole details into 'round_holes'
    if (completedRound.holes && completedRound.holes.length > 0) {
      const holeRows = completedRound.holes.map(h => ({
        id: ensureValidUuid(`${roundUuid}_hole_${h.number}`),
        round_id: roundUuid,
        hole_number: h.number,
        par: h.par || 4,
        user_score: h.score || h.par || 4,
        guest_scores: {
          ...(h.guestScores || {}),
          ...(h.fir ? { fir: h.fir } : {}),
          ...(h.putts !== null && h.putts !== undefined ? { putts: h.putts } : {}),
          ...(h.penalties ? { penalties: h.penalties } : {}),
          ...(h.notes ? { notes: h.notes } : {}),
        },
      }));

      const { error: holesError } = await supabase
        .from('round_holes')
        .upsert(holeRows);

      if (holesError) {
        console.warn('Supabase round_holes error:', holesError);
      }

      // D. Insert shots into 'shots' table
      const shotRows = [];
      completedRound.holes.forEach(h => {
        if (h.shots && h.shots.length > 0) {
          h.shots.forEach((s, idx) => {
            shotRows.push({
              id: ensureValidUuid(`${roundUuid}_shot_${h.number}_${idx}_${s.id || idx}`),
              round_id: roundUuid,
              hole_number: h.number,
              club: s.club || 'Unknown',
              distance: Number(s.distance) || 0,
              shot_order: idx + 1,
            });
          });
        }
      });

      // Clear existing shots for this round first to remove deleted shots cleanly
      try {
        await supabase.from('shots').delete().eq('round_id', roundUuid);
      } catch (delErr) {}

      if (shotRows.length > 0) {
        const { error: shotsError } = await supabase
          .from('shots')
          .upsert(shotRows);

        if (shotsError) {
          console.warn('Supabase shots error:', shotsError);
        }
      }
    }

    return { success: true, round: completedRound };
  } catch (err) {
    console.error('Failed saving round to Supabase:', err);
    return { success: false, error: err.message, localSaved: true };
  }
}

/**
 * 2. FETCH USER ROUNDS (Supabase Cache + Local Fallback)
 */
export async function fetchUserRounds(userId) {
  // 1. Load local rounds
  let localRounds = [];
  try {
    const raw = localStorage.getItem(LOCAL_ROUNDS_KEY);
    localRounds = raw ? JSON.parse(raw) : [];
  } catch (e) {}

  if (!userId) return localRounds;

  try {
    const { data: dbRounds, error } = await supabase
      .from('rounds')
      .select(`
        id,
        course_id,
        course_name,
        total_score,
        guest_count,
        status,
        completed_at,
        created_at,
        round_holes (
          id,
          hole_number,
          par,
          user_score,
          guest_scores
        ),
        shots (
          id,
          hole_number,
          club,
          distance,
          shot_order
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !dbRounds) {
      console.warn('Could not query rounds from Supabase:', error);
      return localRounds;
    }

    // Transform DB schema into app's round format
    const transformed = dbRounds.map(r => {
      const localMatch = localRounds.find(lr => lr.id === r.id);

      const holes = (r.round_holes || []).map(h => {
        const localHole = localMatch?.holes?.find(lh => lh.number === h.hole_number);
        const holeShots = (r.shots || [])
          .filter(s => s.hole_number === h.hole_number)
          .sort((a, b) => (a.shot_order || 0) - (b.shot_order || 0))
          .map(s => {
            const localShot = localHole?.shots?.find(ls => ls.id === s.id);
            return {
              id: s.id,
              club: s.club,
              distance: s.distance,
              lie: localShot?.lie || 'Fairway',
              result: localShot?.result || 'Target',
              notes: localShot?.notes || '',
            };
          });

        const gs = h.guest_scores || {};
        const { fir, putts, penalties, notes, ...guestMap } = gs;

        return {
          number: h.hole_number,
          par: h.par,
          score: h.user_score,
          guestScores: Object.keys(guestMap).length > 0 ? guestMap : (localHole?.guestScores || {}),
          fir: fir || localHole?.fir || null,
          putts: putts !== undefined ? putts : (localHole?.putts ?? null),
          penalties: penalties !== undefined ? penalties : (localHole?.penalties || 0),
          notes: notes || localHole?.notes || '',
          shots: holeShots.length > 0 ? holeShots : (localHole?.shots || []),
        };
      }).sort((a, b) => a.number - b.number);

      const dateStr = r.completed_at || r.created_at
        ? new Date(r.completed_at || r.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Recent Round';

      return {
        id: r.id,
        courseId: r.course_id,
        courseName: r.course_name,
        courseLocation: localMatch?.courseLocation || '',
        date: dateStr,
        totalScore: r.total_score,
        guestCount: r.guest_count,
        tee: localMatch?.tee || 'White',
        weather: localMatch?.weather || 'Sunny',
        notes: localMatch?.notes || '',
        holes: holes.length > 0 ? holes : (localMatch?.holes || []),
      };
    });

    // Merge: Include any local rounds not in DB yet, strictly deduplicated
    const merged = [...transformed];
    localRounds.forEach(lr => {
      const lrUuid = ensureValidUuid(lr.id);
      const isAlreadyInDb = merged.some(m =>
        m.id === lr.id ||
        m.id === lrUuid ||
        (m.courseName === lr.courseName && m.totalScore === lr.totalScore)
      );
      if (!isAlreadyInDb) {
        merged.push(lr);
      }
    });

    // Clean up local storage so duplicates never persist in user's browser
    try {
      localStorage.setItem(LOCAL_ROUNDS_KEY, JSON.stringify(merged));
    } catch (e) {}

    return merged;
  } catch (err) {
    console.warn('fetchUserRounds failed, using local storage:', err);
    return localRounds;
  }
}

/**
 * 3. DELETE ROUND
 */
export async function deleteRound(roundId, userId) {
  // 1. Delete locally
  try {
    const raw = localStorage.getItem(LOCAL_ROUNDS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      localStorage.setItem(LOCAL_ROUNDS_KEY, JSON.stringify(list.filter(r => r.id !== roundId)));
    }
  } catch (e) {}

  // 2. Delete in Supabase if user logged in
  if (userId) {
    try {
      const roundUuid = ensureValidUuid(roundId);
      await supabase.from('shots').delete().eq('round_id', roundUuid);
      await supabase.from('round_holes').delete().eq('round_id', roundUuid);
      await supabase.from('rounds').delete().eq('id', roundUuid).eq('user_id', userId);
    } catch (err) {
      console.warn('Could not delete round from Supabase:', err);
    }
  }
}

/**
 * 4. SAVE & LOAD GREEN PINS (Cloud Sync + Local Storage)
 */
export async function saveGreenPin(courseId, holeNumber, coords, userId) {
  const localKey = `${LOCAL_GREEN_PINS_PREFIX}${courseId}_h${holeNumber}`;
  try {
    localStorage.setItem(localKey, JSON.stringify(coords));
  } catch (e) {}

  if (!userId) return;

  try {
    // Attempt saving to 'green_pins' table in Supabase
    await supabase.from('green_pins').upsert({
      user_id: userId,
      course_id: ensureValidUuid(courseId),
      hole_number: holeNumber,
      latitude: coords.lat,
      longitude: coords.lng,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    // Non-fatal if table doesn't exist yet
  }
}

export async function getGreenPin(courseId, holeNumber, userId) {
  const localKey = `${LOCAL_GREEN_PINS_PREFIX}${courseId}_h${holeNumber}`;
  try {
    const saved = localStorage.getItem(localKey);
    if (saved) return JSON.parse(saved);
  } catch (e) {}

  if (!userId) return null;

  try {
    const { data } = await supabase
      .from('green_pins')
      .select('latitude, longitude')
      .eq('user_id', userId)
      .eq('course_id', ensureValidUuid(courseId))
      .eq('hole_number', holeNumber)
      .maybeSingle();

    if (data && data.latitude && data.longitude) {
      const coords = { lat: data.latitude, lng: data.longitude };
      try {
        localStorage.setItem(localKey, JSON.stringify(coords));
      } catch (e) {}
      return coords;
    }
  } catch (e) {}

  return null;
}

/**
 * 5. AUTOSAVE LIVE HOLE STROKE TO SUPABASE
 * Debounced live sync whenever user adds a shot, adjusts score, or changes clubs
 */
export async function syncHoleStrokeToSupabase({ roundId, holeNumber, holePar, scores, activeRound, userId }) {
  if (!userId || !roundId) return { success: false, reason: 'no_user_or_round' };

  try {
    const roundUuid = ensureValidUuid(roundId);
    const courseUuid = ensureValidUuid(activeRound?.courseId || activeRound?.courseName);

    // 1. Ensure course exists in courses table
    try {
      await supabase.from('courses').upsert({
        id: courseUuid,
        name: activeRound?.courseName || 'Played Track',
        location: activeRound?.courseLocation || 'Local Course',
        par: 72,
        is_custom: false,
      });
    } catch (e) {}

    // 2. Ensure in-progress round exists in rounds table
    await supabase.from('rounds').upsert({
      id: roundUuid,
      user_id: userId,
      course_id: courseUuid,
      course_name: activeRound?.courseName || 'Active Round',
      guest_count: activeRound?.guestCount || 0,
      current_hole: holeNumber,
      status: 'in_progress',
    });

    // 3. Upsert current hole score in round_holes table
    const holeUuid = ensureValidUuid(`${roundUuid}_hole_${holeNumber}`);
    await supabase.from('round_holes').upsert({
      id: holeUuid,
      round_id: roundUuid,
      hole_number: holeNumber,
      par: holePar || 4,
      user_score: scores.user || 0,
    });

    // 4. Upsert recorded shots for this hole in shots table
    if (scores.shots && scores.shots.length > 0) {
      const shotRows = scores.shots.map((s, idx) => ({
        id: ensureValidUuid(`${roundUuid}_shot_${holeNumber}_${idx}_${s.id || idx}`),
        round_id: roundUuid,
        hole_number: holeNumber,
        club: s.club || 'Unknown',
        distance: Number(s.distance) || 0,
        shot_order: idx + 1,
      }));

      await supabase.from('shots').upsert(shotRows);
    }

    return { success: true };
  } catch (err) {
    console.warn('Autosave stroke to Supabase error:', err);
    return { success: false, error: err.message };
  }
}

