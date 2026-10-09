import { useState, useEffect } from 'react';
import { syncHoleStrokeToSupabase } from '../services/roundService';

export function useOfflineScore(roundId, holeNumber, initialPar, guestCount, activeRound = null, userId = null) {
  const storageKey = `round_${roundId}_hole_${holeNumber}`;
  
  const defaultState = { user: 0, shots: [] };
  for (let i = 1; i <= guestCount; i++) defaultState[`guest${i}`] = 0;

  const [scores, setScores] = useState(() => {
    try { 
      const saved = localStorage.getItem(storageKey); 
      return saved ? JSON.parse(saved) : defaultState; 
    } catch(e) { 
      return defaultState; 
    }
  });
  
  const [needsSync, setNeedsSync] = useState(false);

  // Re-sync when hole or round changes so initial score cleanly starts at 0
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setScores(JSON.parse(saved));
      } else {
        const fresh = { user: 0, shots: [] };
        for (let i = 1; i <= guestCount; i++) fresh[`guest${i}`] = 0;
        setScores(fresh);
      }
    } catch (e) {
      const fresh = { user: 0, shots: [] };
      for (let i = 1; i <= guestCount; i++) fresh[`guest${i}`] = 0;
      setScores(fresh);
    }
  }, [storageKey, guestCount]);

  const saveToLocal = (newState) => {
    setScores(newState);
    try { localStorage.setItem(storageKey, JSON.stringify(newState)); } catch(e) {}
    setNeedsSync(true);
  };

  const updateScore = (player, amount) => {
    saveToLocal({ ...scores, [player]: Math.max(0, (scores[player] ?? 0) + amount) });
  };

  const addShot = (clubName, distance) => {
    const newShots = [...(scores.shots || []), { id: Date.now(), club: clubName, distance: parseInt(distance) || 0 }];
    saveToLocal({ ...scores, shots: newShots, user: newShots.length }); 
  };

  const editShot = (shotId, newClub, newDistance) => {
    const newShots = (scores.shots || []).map(s => 
      s.id === shotId ? { ...s, club: newClub, distance: parseInt(newDistance) || 0 } : s
    );
    saveToLocal({ ...scores, shots: newShots });
  };

  const removeShot = (shotId) => {
    const newShots = (scores.shots || []).filter(s => s.id !== shotId);
    saveToLocal({ ...scores, shots: newShots, user: newShots.length });
  };

  // Live autosave stroke to Supabase (debounced 600ms)
  useEffect(() => {
    if (!needsSync) return;
    let isCancelled = false;

    const timer = setTimeout(async () => {
      if (userId && roundId && activeRound) {
        await syncHoleStrokeToSupabase({
          roundId,
          holeNumber,
          holePar: initialPar,
          scores,
          activeRound,
          userId,
        });
      }
      if (!isCancelled) {
        setNeedsSync(false);
      }
    }, 600);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [scores, needsSync, roundId, holeNumber, initialPar, activeRound, userId]);

  return { scores, updateScore, addShot, editShot, removeShot, needsSync };
}
