import React, { useState, useEffect } from 'react';
import { MOCK_COURSES } from '../data/mockData';
import { Icons } from '../components/Icons';
import { useOfflineScore } from '../hooks/useOfflineScore';
import { getCurrentPosition, getDistanceYards } from '../utils/geo';
import { saveGreenPin, getGreenPin } from '../services/roundService';

// Helper to determine hole metadata
function getHoleInfo(course, holeNum) {
  if (course?.holes && course.holes[holeNum - 1]) {
    const h = course.holes[holeNum - 1];
    return {
      par: h.par || 4,
      handicap: h.handicap || h.stroke_index || holeNum,
      distance: h.yardage || h.distance || 390,
      greenLat: h.green_lat || null,
      greenLng: h.green_lng || null,
    };
  }

  // Realistic course distribution for 18 holes
  const par3s = [3, 8, 12, 16];
  const par5s = [5, 14, 18];
  const par = par3s.includes(holeNum) ? 3 : par5s.includes(holeNum) ? 5 : 4;
  const handicap = ((holeNum * 7) % 18) + 1;
  const baseDist = par === 3 ? (145 + ((holeNum * 11) % 45)) : par === 5 ? (495 + ((holeNum * 13) % 55)) : (365 + ((holeNum * 17) % 65));

  return {
    par,
    handicap,
    distance: baseDist,
    greenLat: null,
    greenLng: null,
  };
}

export default function ActiveHole({
  activeRound,
  navigate,
  setActiveRound,
  bag = [],
  currentUser = null,
  onFinishRound,
}) {
  const [currentHole, setCurrentHole] = useState(activeRound?.currentHole || 1);
  const [selectedClub, setSelectedClub] = useState('');
  const [shotDistance, setShotDistance] = useState('');

  // GPS Shot Tracking State
  const [isGpsTracking, setIsGpsTracking] = useState(false);
  const [startShotCoords, setStartShotCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  // Live GPS Distance to Green Center
  const [liveGreenDistance, setLiveGreenDistance] = useState(null);
  const [isCalculatingGreen, setIsCalculatingGreen] = useState(false);
  const [pinnedGreenCoords, setPinnedGreenCoords] = useState(null);
  const [userPinnedCoords, setUserPinnedCoords] = useState(null);
  const [courseGreenCoords, setCourseGreenCoords] = useState(null);
  const [activePinSource, setActivePinSource] = useState(null); // 'user' | 'course' | null

  // Edit / End Round Modal
  const [editingShotId, setEditingShotId] = useState(null);
  const [editShotData, setEditShotData] = useState({ club: '', distance: '' });
  const [showEndModal, setShowEndModal] = useState(false);

  // Course & Hole data
  const course = activeRound?.courseData || MOCK_COURSES.find(c => c.id === activeRound?.courseId) || {
    id: activeRound?.courseId || 'unknown',
    name: activeRound?.courseName || 'Selected Course',
    par: activeRound?.par || 72,
  };

  const holeData = getHoleInfo(course, currentHole);
  const clubData = bag.find(c => c.name === selectedClub);

  const { scores, updateScore, addShot, editShot, removeShot, needsSync } = useOfflineScore(
    activeRound?.id || 'temp',
    currentHole,
    holeData.par,
    activeRound?.guestCount || 0,
    activeRound,
    currentUser?.id
  );

  // Load any pinned green coordinates for this hole from localStorage + course metadata + cloud DB
  const greenPinStorageKey = `green_pin_${course.id}_h${currentHole}`;
  useEffect(() => {
    let isMounted = true;
    let userSaved = null;
    try {
      const saved = localStorage.getItem(greenPinStorageKey);
      if (saved) userSaved = JSON.parse(saved);
    } catch (e) {}

    const courseCoords = (holeData.greenLat && holeData.greenLng)
      ? { lat: holeData.greenLat, lng: holeData.greenLng }
      : null;

    setUserPinnedCoords(userSaved);
    setCourseGreenCoords(courseCoords);

    if (userSaved) {
      setActivePinSource('user');
      setPinnedGreenCoords(userSaved);
    } else if (courseCoords) {
      setActivePinSource('course');
      setPinnedGreenCoords(courseCoords);
    } else {
      setActivePinSource(null);
      setPinnedGreenCoords(null);

      // Check cloud DB if user is logged in
      if (currentUser?.id) {
        getGreenPin(course.id, currentHole, currentUser.id).then(cloudPin => {
          if (isMounted && cloudPin) {
            setUserPinnedCoords(cloudPin);
            setActivePinSource('user');
            setPinnedGreenCoords(cloudPin);
          }
        });
      }
    }

    setLiveGreenDistance(null);
    return () => { isMounted = false; };
  }, [currentHole, course.id, holeData.greenLat, holeData.greenLng, currentUser?.id]);

  const handleSelectPinSource = (source) => {
    if (source === 'user' && userPinnedCoords) {
      setActivePinSource('user');
      setPinnedGreenCoords(userPinnedCoords);
      setLiveGreenDistance(null);
    } else if (source === 'course' && courseGreenCoords) {
      setActivePinSource('course');
      setPinnedGreenCoords(courseGreenCoords);
      setLiveGreenDistance(null);
    }
  };

  // Request Live GPS Distance to Green Pin
  const handleRefreshGreenDistance = async () => {
    if (!pinnedGreenCoords) {
      setGpsError('Pin the green location first to enable live GPS distance.');
      setTimeout(() => setGpsError(''), 4000);
      return;
    }
    setIsCalculatingGreen(true);
    setGpsError('');
    try {
      const pos = await getCurrentPosition();
      const yards = getDistanceYards(pos.lat, pos.lng, pinnedGreenCoords.lat, pinnedGreenCoords.lng);
      setLiveGreenDistance(yards);
    } catch (err) {
      setGpsError(err.message || 'GPS signal unavailable.');
    } finally {
      setIsCalculatingGreen(false);
    }
  };

  // Pin Green at current location (e.g. while walking off the green)
  const handlePinGreenAtCurrentLocation = async () => {
    setIsCalculatingGreen(true);
    setGpsError('');
    try {
      const pos = await getCurrentPosition();
      const coords = { lat: pos.lat, lng: pos.lng };
      setUserPinnedCoords(coords);
      setActivePinSource('user');
      setPinnedGreenCoords(coords);
      saveGreenPin(course.id, currentHole, coords, currentUser?.id);
      setLiveGreenDistance(0);
    } catch (err) {
      setGpsError(err.message || 'Could not pin green.');
    } finally {
      setIsCalculatingGreen(false);
    }
  };

  // Reset / Clear pinned green coordinates
  const handleResetGreenPin = () => {
    try {
      localStorage.removeItem(greenPinStorageKey);
    } catch (e) {}
    setUserPinnedCoords(null);
    if (courseGreenCoords) {
      setActivePinSource('course');
      setPinnedGreenCoords(courseGreenCoords);
    } else {
      setActivePinSource(null);
      setPinnedGreenCoords(null);
    }
    setLiveGreenDistance(null);
  };

  // 1. Mark Lie (Tee or Ball position) - 1 instantaneous GPS fix, NO battery drain while walking
  const handleMarkLie = async () => {
    setGpsLoading(true);
    setGpsError('');
    try {
      const pos = await getCurrentPosition();
      setStartShotCoords({ lat: pos.lat, lng: pos.lng, time: Date.now() });
      setShotDistance('');
      setIsGpsTracking(true);
    } catch (err) {
      setGpsError(err.message || 'Could not access GPS.');
    } finally {
      setGpsLoading(false);
    }
  };

  // 2. At Ball - 1 instantaneous GPS fix to compute distance from Lie 1 to Lie 2
  const handleAtBall = async () => {
    if (!startShotCoords) return;
    setGpsLoading(true);
    setGpsError('');
    try {
      const currentPos = await getCurrentPosition();
      const yards = getDistanceYards(
        startShotCoords.lat,
        startShotCoords.lng,
        currentPos.lat,
        currentPos.lng
      );
      // Auto-populate distance if moved, or retain manual input
      if (yards > 0) {
        setShotDistance(yards.toString());
      } else if (!shotDistance) {
        setShotDistance('0');
      }
      setIsGpsTracking(false);
      // Auto-prime this spot as the starting lie for next shot!
      setStartShotCoords({ lat: currentPos.lat, lng: currentPos.lng, time: Date.now() });
    } catch (err) {
      setIsGpsTracking(false);
      setGpsError('Could not get ball position.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleRecordShot = () => {
    addShot(selectedClub || 'Unknown', shotDistance);
    setShotDistance('');
    // If not tracking, keep startShotCoords ready
  };

  const nextHole = () => {
    if (currentHole < 18) {
      const nextNum = currentHole + 1;
      setCurrentHole(nextNum);
      setActiveRound(p => ({ ...p, currentHole: nextNum }));
      setSelectedClub('');
      setShotDistance('');
      setIsGpsTracking(false);
      setStartShotCoords(null);
      setGpsError('');
      window.scrollTo(0, 0);
    } else {
      setShowEndModal(true);
      setActivePinSource(null);
      setPinnedGreenCoords(null);
    }
    setLiveGreenDistance(null);
  };


  // Collect all holes played so far when finishing round
  const handleSaveAndCompleteRound = () => {
    const holesPlayed = [];
    let grossTotal = 0;

    for (let h = 1; h <= 18; h++) {
      const key = `round_${activeRound?.id}_hole_${h}`;
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          holesPlayed.push({
            number: h,
            par: getHoleInfo(course, h).par,
            score: parsed.user || getHoleInfo(course, h).par,
            shots: parsed.shots || [],
          });
          grossTotal += parsed.user || getHoleInfo(course, h).par;
        }
      } catch (e) {}
    }

    // Fallback if no holes were parsed from storage
    if (holesPlayed.length === 0) {
      holesPlayed.push({
        number: currentHole,
        par: holeData.par,
        score: scores.user,
        shots: scores.shots || [],
      });
      grossTotal = scores.user;
    }

    const completed = {
      id: activeRound?.id || `round_${Date.now()}`,
      courseId: course.id,
      courseName: course.name,
      courseLocation: course.location,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      totalScore: grossTotal,
      holes: holesPlayed,
    };

    if (onFinishRound) {
      onFinishRound(completed);
    } else {
      setActiveRound(null);
      navigate('dashboard');
    }
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen flex flex-col relative pb-32">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 px-1">
        <h2 className="font-bold text-gray-500 uppercase tracking-widest text-xs truncate max-w-[200px]">
          {course.name}
        </h2>
        <button
          onClick={() => setShowEndModal(true)}
          className="text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 px-3.5 py-1.5 rounded-full transition"
        >
          Pause / Finish
        </button>
      </div>

      {/* Hero Hole Card */}
      <div className="bg-green-800 text-white rounded-2xl p-6 text-center shadow-lg mb-4 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>

        <div className="flex justify-between text-green-200 text-xs font-bold mb-2">
          <span>HCP Index {holeData.handicap}</span>
          <span>Par {holeData.par}</span>
        </div>

        <h1 className="text-xl font-bold tracking-wide">HOLE {currentHole}</h1>

        {/* Big Hero Distance */}
        <div className="my-2">
          <h2 className="text-7xl font-black tracking-tighter">
            {liveGreenDistance !== null ? liveGreenDistance : holeData.distance}
          </h2>
          <p className="text-xs font-semibold opacity-80 mt-1 uppercase tracking-[0.2em]">
            {liveGreenDistance !== null
              ? activePinSource === 'user'
                ? 'Yds to Center (My Marker GPS)'
                : 'Yds to Center (Course GPS)'
              : 'Yds to Center (Scorecard)'}
          </p>
        </div>

        {/* Dual Source Switcher (When both user marker and course data are available) */}
        {userPinnedCoords && courseGreenCoords && (
          <div className="inline-flex items-center bg-green-950/60 p-1 rounded-full my-1 border border-green-700/60">
            <button
              onClick={() => handleSelectPinSource('user')}
              className={`text-[10px] font-bold px-3 py-1 rounded-full transition ${
                activePinSource === 'user'
                  ? 'bg-white text-green-900 shadow-sm'
                  : 'text-green-300 hover:text-white'
              }`}
            >
              ★ My Marker
            </button>
            <button
              onClick={() => handleSelectPinSource('course')}
              className={`text-[10px] font-bold px-3 py-1 rounded-full transition ${
                activePinSource === 'course'
                  ? 'bg-white text-green-900 shadow-sm'
                  : 'text-green-300 hover:text-white'
              }`}
            >
              🏛️ Course Data
            </button>
          </div>
        )}

        {/* GPS Live Distance Actions */}
        <div className="flex flex-col items-center gap-2 mt-4 pt-3 border-t border-green-700/60">
          <div className="flex flex-wrap justify-center items-center gap-2">
            {pinnedGreenCoords ? (
              <>
                <button
                  onClick={handleRefreshGreenDistance}
                  disabled={isCalculatingGreen}
                  className="text-xs font-bold bg-green-900/80 hover:bg-green-900 text-green-100 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                >
                  <Icons.RotateCcw />
                  {isCalculatingGreen ? 'Calculating...' : 'Live GPS to Green'}
                </button>
                <button
                  onClick={handlePinGreenAtCurrentLocation}
                  disabled={isCalculatingGreen}
                  title="Overrule / update marker from current position"
                  className="text-xs font-bold bg-green-900/60 hover:bg-green-900 text-green-200 px-3 py-1.5 rounded-full flex items-center gap-1 transition active:scale-95"
                >
                  <Icons.MapPin />
                  {userPinnedCoords ? 'Re-pin' : 'Overrule Pin'}
                </button>
                {userPinnedCoords && (
                  <button
                    onClick={handleResetGreenPin}
                    title="Remove custom marker and revert to course data"
                    className="text-xs font-bold bg-red-900/50 hover:bg-red-900/80 text-red-200 px-3 py-1.5 rounded-full flex items-center gap-1 transition active:scale-95"
                  >
                    ✕ Reset Pin
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={handlePinGreenAtCurrentLocation}
                disabled={isCalculatingGreen}
                className="text-xs font-bold bg-green-900/80 hover:bg-green-900 text-green-100 px-3.5 py-1.5 rounded-full flex items-center gap-1 transition active:scale-95 shadow-sm"
              >
                <Icons.MapPin />
                {isCalculatingGreen ? 'Pinning...' : '📍 Pin Green Here (GPS)'}
              </button>
            )}
          </div>
          <p className="text-[10px] text-green-200/80 text-center max-w-xs font-medium leading-tight">
            {activePinSource === 'user'
              ? '✓ Using your custom marker. Tap "Live GPS to Green" on approach, "Re-pin", or "Reset Pin".'
              : activePinSource === 'course'
              ? '🏛️ Using official course data. Tap "Live GPS to Green" or stand on green to overrule.'
              : '💡 Scorecard yardage shown. Stand on the green center and tap to permanently save GPS coords for live approach distance.'}
          </p>
        </div>
      </div>

      {gpsError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-xl text-xs font-semibold mb-3 animate-in fade-in text-center">
          ⚠️ {gpsError}
        </div>
      )}

      {/* Prep & Log Shot Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 mb-4">
        <h3 className="font-bold text-lg text-gray-800 mb-3">Prep & Log Shot</h3>

        {/* Club Selection */}
        <select
          value={selectedClub}
          onChange={(e) => setSelectedClub(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 text-base font-semibold mb-3 focus:outline-none focus:ring-2 focus:ring-green-600"
        >
          <option value="">Select a Club (Optional)...</option>
          {bag.map(c => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Club Swing & Stance Cues (only shown when notes/cues exist) */}
        {clubData && (clubData.swing?.trim() || clubData.stance?.trim()) && (
          <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100 mb-3 animate-in fade-in">
            {clubData.swing && (
              <>
                <p className="text-[10px] font-black text-blue-800 uppercase tracking-wider mb-0.5">Swing Thought</p>
                <p className="text-xs font-medium text-gray-700 mb-2">{clubData.swing}</p>
              </>
            )}
            {clubData.stance && (
              <>
                <p className="text-[10px] font-black text-blue-800 uppercase tracking-wider mb-0.5">Stance Cue</p>
                <p className="text-xs font-medium text-gray-700">{clubData.stance}</p>
              </>
            )}
          </div>
        )}

        {/* 2-Tap GPS Shot Tracking Controls */}
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2 items-start">
            <div className="w-1/2 flex flex-col">
              {!isGpsTracking ? (
                <button
                  type="button"
                  onClick={handleMarkLie}
                  disabled={gpsLoading}
                  className="w-full py-3 px-2 bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 rounded-xl font-bold text-xs text-gray-700 flex flex-col items-center justify-center transition active:scale-95"
                >
                  <Icons.Target />
                  <span>{gpsLoading ? 'Getting GPS...' : '📍 Mark Lie (Tee/Ball)'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAtBall}
                  disabled={gpsLoading}
                  className="w-full py-3 px-2 bg-green-50 hover:bg-green-100 border-2 border-green-500 text-green-800 rounded-xl font-black text-xs flex flex-col items-center justify-center transition animate-pulse active:scale-95"
                >
                  <Icons.Check />
                  <span>{gpsLoading ? 'Calculating...' : '🎯 At Ball (Get Dist)'}</span>
                </button>
              )}
              {isGpsTracking && (
                <button
                  onClick={() => setIsGpsTracking(false)}
                  className="text-[10px] text-gray-400 mt-1 underline text-center"
                >
                  Cancel Tracking
                </button>
              )}
            </div>

            {/* Distance Input (Auto-calculated or Manual Override) */}
            <div className="w-1/2">
              <input
                type="number"
                placeholder="Dist (y)"
                value={shotDistance}
                onChange={e => setShotDistance(e.target.value)}
                className="w-full h-[54px] p-2 border border-gray-300 rounded-xl text-center font-black text-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 bg-white"
              />
            </div>
          </div>

          {isGpsTracking && (
            <div className="bg-green-50 border border-green-200 text-green-900 text-xs p-3 rounded-xl flex flex-col items-center gap-1.5 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-green-600"></span>
                <span>Lie 1 Pinned!</span>
              </div>
              <p className="text-[11px] text-gray-600 text-center leading-tight">
                Walk to your ball and tap <strong>"🎯 At Ball (Get Dist)"</strong> to compute the exact yardage from your lie.
              </p>
            </div>
          )}

          <button
            onClick={handleRecordShot}
            className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-black active:scale-95 transition"
          >
            + Record Shot
          </button>
        </div>
      </div>

      {/* Hole Scorecard & Logged Shots */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 mb-4">
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
          <h3 className="font-bold text-lg text-gray-800">Hole Scorecard</h3>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${needsSync ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
            {needsSync ? 'Saving...' : 'Synced'}
          </span>
        </div>

        {/* Recorded Shots for this Hole */}
        {scores.shots?.length > 0 && (
          <div className="mb-4 space-y-2">
            {scores.shots.map((shot, i) => (
              editingShotId === shot.id ? (
                <div key={shot.id} className="bg-white border border-blue-200 p-2.5 rounded-xl text-sm shadow-sm flex flex-col gap-2 animate-in fade-in">
                  <div className="flex gap-2">
                    <select
                      value={editShotData.club}
                      onChange={e => setEditShotData({ ...editShotData, club: e.target.value })}
                      className="flex-1 p-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 font-semibold"
                    >
                      <option value="Unknown">Unknown</option>
                      {bag.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <input
                      type="number"
                      placeholder="Yards"
                      value={editShotData.distance}
                      onChange={e => setEditShotData({ ...editShotData, distance: e.target.value })}
                      className="w-20 p-1.5 border border-gray-200 rounded-lg text-sm text-center font-bold"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingShotId(null)}
                      className="text-gray-500 text-xs font-bold px-2.5 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        editShot(shot.id, editShotData.club, editShotData.distance);
                        setEditingShotId(null);
                      }}
                      className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-lg"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div key={shot.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-2.5 px-3 rounded-xl text-sm">
                  <span className="font-bold text-gray-700">
                    Shot {i + 1}: {shot.club}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-bold bg-white px-2 py-0.5 rounded border border-gray-200 text-xs">
                      {shot.distance > 0 ? `${shot.distance}y` : 'No yardage'}
                    </span>
                    <button
                      onClick={() => {
                        setEditingShotId(shot.id);
                        setEditShotData({ club: shot.club, distance: shot.distance || '' });
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <Icons.Pencil />
                    </button>
                    <button
                      onClick={() => removeShot(shot.id)}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* Player Score Counter */}
        <div className="flex items-center justify-between">
          <div>
            <span className="font-black text-gray-800 block text-base">My Score</span>
            <span className="text-[10px] text-gray-400 uppercase font-bold">Auto-tallied by shots</span>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => updateScore('user', -1)}
              className="bg-gray-100 hover:bg-gray-200 w-10 h-10 rounded-xl font-black text-xl transition active:scale-95"
            >
              -
            </button>
            <span className="text-3xl font-black w-8 text-center text-gray-900">{scores.user}</span>
            <button
              onClick={() => updateScore('user', 1)}
              className="bg-gray-100 hover:bg-gray-200 w-10 h-10 rounded-xl font-black text-xl transition active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        {/* Guest Players Counter */}
        {Array.from({ length: activeRound?.guestCount || 0 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-t border-gray-100 pt-3.5 mt-3.5">
            <span className="font-semibold text-gray-600 text-sm">Guest {i + 1}</span>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => updateScore(`guest${i + 1}`, -1)}
                className="bg-gray-50 text-gray-500 w-9 h-9 rounded-xl font-bold text-lg"
              >
                -
              </button>
              <span className="text-xl font-black w-8 text-center text-gray-700">{scores[`guest${i + 1}`]}</span>
              <button
                onClick={() => updateScore(`guest${i + 1}`, 1)}
                className="bg-gray-50 text-gray-500 w-9 h-9 rounded-xl font-bold text-lg"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Sticky Hole Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-50 border-t border-gray-200 max-w-md mx-auto flex gap-3 z-40">
        {currentHole > 1 && (
          <button
            onClick={() => {
              setCurrentHole(h => h - 1);
              window.scrollTo(0, 0);
            }}
            className="w-1/3 bg-white border border-gray-300 text-gray-700 font-bold py-4 rounded-xl active:bg-gray-100 transition text-sm"
          >
            ← Prev
          </button>
        )}
        <button
          onClick={nextHole}
          className={`${currentHole > 1 ? 'w-2/3' : 'w-full'} bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition text-base`}
        >
          {currentHole === 18 ? 'Finish Round 🏆' : 'Next Hole →'}
        </button>
      </div>

      {/* Finish / Pause Round Confirmation Modal */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-gray-900 mb-1">Finish Round?</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Your scorecard and all logged shots will be permanently saved to your game history.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSaveAndCompleteRound}
                className="w-full bg-green-600 text-white font-black py-4 rounded-xl text-base hover:bg-green-700 shadow-md transition active:scale-95"
              >
                Save & Complete Round
              </button>
              <button
                onClick={() => navigate('dashboard')}
                className="w-full bg-blue-50 text-blue-700 font-bold py-3.5 rounded-xl text-sm transition"
              >
                Pause & Return Home
              </button>
              <button
                onClick={() => setShowEndModal(false)}
                className="w-full text-gray-400 font-bold py-3 hover:text-gray-600 transition text-sm"
              >
                Resume Hole {currentHole}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
