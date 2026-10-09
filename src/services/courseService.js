import { supabase } from '../lib/supabase.js';
import { MOCK_COURSES } from '../data/mockData';
import { getDistanceMiles } from '../utils/geo';

// Clean and sanitize API key in case of accidental leading equal signs or whitespace
const rawKey = import.meta.env.VITE_GOLF_COURSE_API_KEY || '';
const GOLF_COURSE_API_KEY = rawKey.replace(/^=+/, '').trim();
const GOLF_COURSE_API_BASE = 'https://api.golfcourseapi.com/v1';
const LOCAL_STORAGE_COURSES_KEY = 'golf_notes_custom_courses';

export const isGolfCourseApiConfigured = () => !!GOLF_COURSE_API_KEY;
export const getMaskedApiKey = () => {
  if (!GOLF_COURSE_API_KEY) return null;
  if (GOLF_COURSE_API_KEY.length <= 8) return '****';
  return `${GOLF_COURSE_API_KEY.slice(0, 4)}...${GOLF_COURSE_API_KEY.slice(-4)}`;
};

/**
 * Ensures any ID string is a valid UUID that PostgreSQL accepts
 */
export function ensureValidUuid(id) {
  if (!id) {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
          (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
        );
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;

  // Generate deterministic UUID from string hash
  let hash1 = 0, hash2 = 0;
  for (let i = 0; i < id.length; i++) {
    hash1 = ((hash1 << 5) - hash1) + id.charCodeAt(i);
    hash1 |= 0;
    hash2 = ((hash2 << 7) - hash2) + id.charCodeAt(i);
    hash2 |= 0;
  }
  const s1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const s2 = Math.abs(hash2).toString(16).padStart(8, '0');
  const filler = 'a1b2c3d4e5f60718293a4b5c';
  const raw = (s1 + s2 + filler).slice(0, 32);
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

/**
 * Loads custom courses saved locally in case Supabase is offline or unmigrated
 */
function getLocalCustomCourses() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_COURSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Saves custom course to local storage fallback
 */
function saveLocalCustomCourse(course) {
  try {
    const list = getLocalCustomCourses();
    const updated = [course, ...list.filter(c => c.id !== course.id)];
    localStorage.setItem(LOCAL_STORAGE_COURSES_KEY, JSON.stringify(updated));
  } catch (e) {}
}

const FAVORITES_STORAGE_KEY_PREFIX = 'golf_notes_favorite_courses_';

export function getFavoriteCourses(userId = 'guest') {
  try {
    const raw = localStorage.getItem(`${FAVORITES_STORAGE_KEY_PREFIX}${userId || 'guest'}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function toggleFavoriteCourse(course, userId = 'guest') {
  try {
    const list = getFavoriteCourses(userId);
    const exists = list.some(c => c.id === course.id);
    let updated;
    if (exists) {
      updated = list.filter(c => c.id !== course.id);
    } else {
      updated = [{ ...course, is_favorite: true }, ...list];
    }
    localStorage.setItem(`${FAVORITES_STORAGE_KEY_PREFIX}${userId || 'guest'}`, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return [];
  }
}

export function isCourseFavorited(courseId, userId = 'guest') {
  const list = getFavoriteCourses(userId);
  return list.some(c => c.id === courseId);
}

/**
 * 1. GET MY COURSES (Default View)
 * Returns courses the golfer has played in past rounds + custom saved courses + starred favorites.
 * Zero external API calls!
 */
export async function getMyPlayedCourses(userId, pastRounds = [], isGuest = false) {
  // Extract unique course IDs & names from user's rounds
  const playedCourseMap = new Map();

  pastRounds.forEach(round => {
    if (round.courseId && round.courseName) {
      if (!playedCourseMap.has(round.courseId)) {
        playedCourseMap.set(round.courseId, {
          id: round.courseId,
          name: round.courseName,
          location: round.courseLocation || 'Home / Played Track',
          playedCount: 1,
          lastPlayed: round.date || 'Recent',
          facilities: ['played'],
          is_custom: false,
        });
      } else {
        const existing = playedCourseMap.get(round.courseId);
        existing.playedCount += 1;
      }
    }
  });

  // Fetch user's custom courses from Supabase
  let userCustomCourses = [];
  try {
    if (userId) {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('created_by', userId);

      if (!error && data) {
        userCustomCourses = data;
      }
    }
  } catch (err) {
    console.warn('Could not query Supabase courses table:', err);
  }

  // Fallback to local storage custom courses for this user
  if (userCustomCourses.length === 0) {
    userCustomCourses = getLocalCustomCourses().filter(c => !userId || c.created_by === userId);
  }

  // Merge into a single list
  const merged = Array.from(playedCourseMap.values());

  userCustomCourses.forEach(c => {
    if (!merged.find(m => m.id === c.id)) {
      merged.push({
        ...c,
        facilities: c.facilities || ['custom'],
        is_custom: true,
      });
    }
  });

  // Also merge user's favorited / starred courses
  const favorites = getFavoriteCourses(userId);
  favorites.forEach(fav => {
    const existing = merged.find(m => m.id === fav.id);
    if (!existing) {
      merged.push({
        ...fav,
        facilities: fav.facilities || ['favorite'],
        is_favorite: true,
      });
    } else {
      existing.is_favorite = true;
    }
  });

  // ONLY seed with dummy mock courses if in guest preview mode.
  // Real authenticated golfers start with a clean state!
  if (merged.length === 0 && isGuest) {
    return MOCK_COURSES;
  }

  return merged;
}

/**
 * 2. SEARCH COURSES (Cache-First -> Supabase -> Golf Course API)
 */
export async function searchCourses(query = '', userCoords = null, userId = null, isGuest = false) {
  const trimmed = query.trim().toLowerCase();
  let results = [];

  // A. Query Supabase cached courses first
  try {
    let sbQuery = supabase.from('courses').select('*');
    if (trimmed) {
      sbQuery = sbQuery.or(`name.ilike.%${trimmed}%,location.ilike.%${trimmed}%`);
    }

    const { data, error } = await sbQuery.limit(25);
    if (!error && data) {
      // Filter out custom courses belonging to other users (manual courses are private to author)
      results = data.filter(c => !c.is_custom || (userId && c.created_by === userId));
    }
  } catch (e) {
    console.warn('Supabase courses lookup error:', e);
  }

  // Also include matching local custom courses
  const localCustom = getLocalCustomCourses().filter(c => {
    const isOwner = !c.created_by || c.created_by === userId;
    const matchesQuery = !trimmed || c.name.toLowerCase().includes(trimmed) || (c.location && c.location.toLowerCase().includes(trimmed));
    return isOwner && matchesQuery;
  });

  localCustom.forEach(c => {
    if (!results.find(r => r.id === c.id)) {
      results.push(c);
    }
  });

  // Only check MOCK_COURSES if user is in guest mode!
  if (isGuest) {
    MOCK_COURSES.forEach(mock => {
      const matchesQuery = !trimmed || mock.name.toLowerCase().includes(trimmed) || mock.location.toLowerCase().includes(trimmed);
      if (matchesQuery && !results.find(r => r.name.toLowerCase() === mock.name.toLowerCase())) {
        results.push(mock);
      }
    });
  }

  // B. Query external Golf Course API whenever query is 3+ characters and API key is present
  if (trimmed.length >= 3 && GOLF_COURSE_API_KEY) {
    try {
      const apiResults = await fetchFromGolfCourseApi(trimmed);
      if (apiResults && apiResults.length > 0) {
        for (const apiCourse of apiResults) {
          if (!results.find(r => r.name.toLowerCase() === apiCourse.name.toLowerCase())) {
            results.push(apiCourse);
            // Cache in Supabase so subsequent queries are free!
            cacheCourseInSupabase(apiCourse).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('Golf Course API fetch failed:', err);
    }
  }

  // Calculate distance if userCoords provided
  if (userCoords) {
    results = results.map(c => {
      if (c.latitude && c.longitude) {
        const miles = getDistanceMiles(userCoords.lat, userCoords.lng, c.latitude, c.longitude);
        return { ...c, distanceMiles: parseFloat(miles), distance: `${miles} mi` };
      }
      return c;
    });

    // Sort by closest distance
    results.sort((a, b) => {
      if (a.distanceMiles !== undefined && b.distanceMiles !== undefined) {
        return a.distanceMiles - b.distanceMiles;
      }
      return a.distanceMiles !== undefined ? -1 : 1;
    });
  }

  return results;
}

/**
 * 3. FETCH FROM GOLF COURSE API (Direct Export)
 */
export async function fetchFromGolfCourseApi(searchQuery) {
  if (!GOLF_COURSE_API_KEY) {
    throw new Error('Golf Course API key not found in .env (VITE_GOLF_COURSE_API_KEY).');
  }

  const url = `${GOLF_COURSE_API_BASE}/search?search_query=${encodeURIComponent(searchQuery)}&fuzzy_match=true`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Key ${GOLF_COURSE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Golf Course API rate limit reached (35 monthly requests exhausted).');
    }
    throw new Error(`Golf Course API returned status ${response.status}`);
  }

  const data = await response.json();
  const rawList = Array.isArray(data) ? data : (data.courses || data.data || []);

  return rawList.map(item => {
    const rawId = item.id || item.course_id || '';
    const name = item.course_name && item.club_name && item.course_name !== item.club_name
      ? `${item.club_name} (${item.course_name})`
      : (item.course_name || item.club_name || item.name || 'Golf Course');

    const courseId = ensureValidUuid(rawId ? `golf_api_${rawId}` : name);

    const locationStr = [
      item.location?.city || item.city,
      item.location?.state || item.state,
      item.location?.country || item.country,
    ].filter(Boolean).join(', ');

    return {
      id: courseId,
      name,
      location: locationStr || 'Verified Course',
      par: item.par || 72,
      latitude: item.location?.latitude || item.latitude || null,
      longitude: item.location?.longitude || item.longitude || null,
      facilities: ['verified', 'api'],
      is_custom: false,
      api_provider: 'golfcourseapi',
    };
  });
}

/**
 * Cache an external course in Supabase database
 */
async function cacheCourseInSupabase(course) {
  try {
    await supabase.from('courses').upsert({
      id: ensureValidUuid(course.id),
      name: course.name,
      location: course.location || 'Verified Course',
      latitude: course.latitude || null,
      longitude: course.longitude || null,
      par: Number(course.par) || 72,
      facilities: course.facilities || [],
      api_provider: 'golfcourseapi',
      is_custom: false,
    });
  } catch (e) {
    // Non-fatal if Supabase tables haven't been migrated yet
  }
}

/**
 * 4. CREATE CUSTOM COURSE
 * Saves for the current user only (is_custom: true, created_by: userId)
 */
export async function createCustomCourse({ name, location, par = 72, holesCount = 18, facilities = [] }, userId) {
  const courseId = ensureValidUuid();
  
  const courseRecord = {
    id: courseId,
    name: name.trim(),
    location: location?.trim() || 'Private / Local',
    par: Number(par) || 72,
    facilities: facilities.length > 0 ? facilities : ['custom'],
    is_custom: true,
    created_by: userId || null,
    api_provider: 'custom',
    created_at: new Date().toISOString(),
  };

  // Try saving to Supabase
  try {
    let { data, error } = await supabase
      .from('courses')
      .insert(courseRecord)
      .select()
      .maybeSingle();

    // Fallback if schema cache lacks created_by
    if (error && (error.message?.includes('created_by') || error.message?.includes('schema cache'))) {
      const basic = {
        id: courseRecord.id,
        name: courseRecord.name,
        location: courseRecord.location,
        facilities: courseRecord.facilities,
      };
      const retry = await supabase.from('courses').insert(basic).select().maybeSingle();
      if (!retry.error) {
        data = retry.data || basic;
        error = null;
      }
    }

    if (!error && data) {
      saveLocalCustomCourse(data);
      return data;
    }
  } catch (err) {
    console.warn('Could not insert course to Supabase:', err);
  }

  // Local fallback
  saveLocalCustomCourse(courseRecord);
  return courseRecord;
}

/**
 * 5. SMART SUGGESTION MATCH FOR CUSTOM COURSE INPUT
 */
export async function searchCourseSuggestions(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const suggestions = [];

  // If Golf Course API key is available and search is 3+ chars
  if (GOLF_COURSE_API_KEY && q.length >= 3) {
    try {
      const apiResults = await fetchFromGolfCourseApi(q);
      apiResults.slice(0, 4).forEach(api => {
        if (!suggestions.find(s => s.name.toLowerCase() === api.name.toLowerCase())) {
          suggestions.push({
            ...api,
            source: 'Golf Course API (Verified)',
          });
        }
      });
    } catch (e) {}
  }

  return suggestions.slice(0, 5);
}
