import { useState, useEffect } from 'react';

export function useOfflineScore(roundId, holeNumber, initialPar, guestCount) {
  const storageKey = `round_${roundId}_hole_${holeNumber}`;
  
  const defaultState = { user: initialPar, shots: [] };
  for (let i = 1; i <= guestCount; i++) defaultState[`guest${i}`] = initialPar;

  const [scores, setScores] = useState(() => {
    try { 
      const saved = localStorage.getItem(storageKey); 
      return saved ? JSON.parse(saved) : defaultState; 
    } catch(e) { 
      return defaultState; 
    }
  });
  
  const [needsSync, setNeedsSync] = useState(false);

  const saveToLocal = (newState) => {
    setScores(newState);
    try { localStorage.setItem(storageKey, JSON.stringify(newState)); } catch(e) {}
    setNeedsSync(true);
  };

  const updateScore = (player, amount) => {
    saveToLocal({ ...scores, [player]: Math.max(1, (scores[player] || initialPar) + amount) });
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
    saveToLocal({ ...scores, shots: newShots, user: Math.max(1, newShots.length) });
  };

  useEffect(() => {
    const sync = () => { 
      if (needsSync) {
        // Here you will add your Supabase sync logic
        setTimeout(() => setNeedsSync(false), 800); 
      }
    };
    sync();
  }, [scores, needsSync]);

  return { scores, updateScore, addShot, editShot, removeShot, needsSync };
}
