import React, { useState } from 'react';
import { MOCK_PAST_ROUNDS } from '../data/mockData';
import { Icons } from '../components/Icons';

const STANDARD_CLUBS = [
  'Driver', '3 Wood', '5 Wood', '7 Wood',
  '2 Hybrid', '3 Hybrid', '4 Hybrid', '5 Hybrid',
  '3 Iron', '4 Iron', '5 Iron', '6 Iron', '7 Iron', '8 Iron', '9 Iron',
  'Pitching Wedge', 'Gap Wedge', 'Sand Wedge', 'Lob Wedge',
  '52° Wedge', '56° Wedge', '60° Wedge',
  'Putter'
];

const LIE_OPTIONS = ['Tee', 'Fairway', 'Rough', 'Sand', 'Green', 'Hazard', 'Trees'];
const RESULT_OPTIONS = ['Target', 'Fairway', 'Green', 'Miss Left', 'Miss Right', 'Long', 'Short', 'Slice', 'Hook'];

export default function Analysis({
  roundId,
  navigate,
  bag = [],
  rounds = [],
  onDeleteRound,
  onUpdateRound,
}) {
  const [tab, setTab] = useState('insights'); // 'insights' | 'scorecard'
  const [isEditing, setIsEditing] = useState(false);
  const [editTab, setEditTab] = useState('overview'); // 'overview' | 'holes' | 'shots'
  const [editingHoleNum, setEditingHoleNum] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // New Shot Form state for editing
  const [newShotClub, setNewShotClub] = useState('');
  const [newShotDist, setNewShotDist] = useState('');
  const [newShotLie, setNewShotLie] = useState('Fairway');
  const [newShotResult, setNewShotResult] = useState('Target');

  const round = rounds.find(r => r.id === roundId) || MOCK_PAST_ROUNDS.find(r => r.id === roundId) || null;

  // Club options combining player bag and standard clubs
  const availableClubs = [
    ...bag.map(b => b.name),
    ...STANDARD_CLUBS.filter(c => !bag.some(b => b.name === c))
  ];

  // Build full 18-hole template for editing
  const getInitialEditForm = () => {
    const existingHoles = round?.holes || [];
    const filledHoles = Array.from({ length: 18 }).map((_, i) => {
      const holeNum = i + 1;
      const found = existingHoles.find(h => h.number === holeNum);
      if (found) {
        return {
          number: holeNum,
          par: found.par || 4,
          score: found.score || found.par || 4,
          fir: found.fir || null,
          putts: found.putts !== null && found.putts !== undefined ? found.putts : null,
          penalties: found.penalties || 0,
          notes: found.notes || '',
          guestScores: found.guestScores || {},
          shots: (found.shots || []).map((s, sIdx) => ({
            id: s.id || `shot_${holeNum}_${sIdx}_${Date.now()}`,
            club: s.club || 'Unknown',
            distance: Number(s.distance) || 0,
            lie: s.lie || (sIdx === 0 ? 'Tee' : 'Fairway'),
            result: s.result || 'Target',
            notes: s.notes || '',
          })),
        };
      }
      return {
        number: holeNum,
        par: 4,
        score: 4,
        fir: null,
        putts: null,
        penalties: 0,
        notes: '',
        guestScores: {},
        shots: [],
      };
    });

    return {
      courseName: round?.courseName || '',
      courseLocation: round?.courseLocation || '',
      date: round?.date || '',
      guestCount: round?.guestCount || 0,
      totalScore: round?.totalScore || 72,
      tee: round?.tee || 'White',
      weather: round?.weather || 'Sunny ☀️',
      notes: round?.notes || '',
      holes: filledHoles,
    };
  };

  const [editForm, setEditForm] = useState(getInitialEditForm);

  if (!round) {
    return (
      <div className="bg-gray-50 min-h-screen p-6 flex flex-col justify-center items-center text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Round Not Found</h2>
        <p className="text-sm text-gray-500 mb-6">This round may have been deleted.</p>
        <button
          onClick={() => navigate('dashboard')}
          className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl shadow-md"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Calculate actual club stats across this round
  const clubStats = bag.filter(c => c.name !== 'Putter').map(club => {
    let totalDist = 0, count = 0;
    (round.holes || []).forEach(h => {
      (h.shots || []).forEach(s => {
        if (s.club === club.name && s.distance > 0) {
          totalDist += s.distance;
          count++;
        }
      });
    });
    return { name: club.name, stock: club.carry, actual: count > 0 ? Math.round(totalDist / count) : null, count };
  }).filter(c => c.actual !== null);

  // Helper: Open editor directly on a specific hole
  const handleOpenEditHole = (holeNum, targetSubTab = 'shots') => {
    setEditForm(getInitialEditForm());
    setEditingHoleNum(holeNum);
    setEditTab(targetSubTab);
    setIsEditing(true);
  };

  // Helper: Open general editor
  const handleOpenEdit = () => {
    setEditForm(getInitialEditForm());
    setEditTab('overview');
    setIsEditing(true);
  };

  // Hole score adjustment in edit mode
  const handleHoleScoreChange = (holeNum, delta) => {
    const updatedHoles = editForm.holes.map(h => {
      if (h.number === holeNum) {
        return { ...h, score: Math.max(1, (h.score || 4) + delta) };
      }
      return h;
    });
    const calculatedTotal = updatedHoles.reduce((acc, h) => acc + (h.score || 0), 0);
    setEditForm({ ...editForm, holes: updatedHoles, totalScore: calculatedTotal });
  };

  // Hole par adjustment in edit mode
  const handleHoleParChange = (holeNum, newPar) => {
    const updatedHoles = editForm.holes.map(h => {
      if (h.number === holeNum) {
        return { ...h, par: Number(newPar) };
      }
      return h;
    });
    setEditForm({ ...editForm, holes: updatedHoles });
  };

  // Hole FIR (Fairway in Regulation) toggle
  const handleHoleFirChange = (holeNum, firVal) => {
    const updatedHoles = editForm.holes.map(h => {
      if (h.number === holeNum) {
        return { ...h, fir: h.fir === firVal ? null : firVal };
      }
      return h;
    });
    setEditForm({ ...editForm, holes: updatedHoles });
  };

  // Hole Putts adjustment
  const handleHolePuttsChange = (holeNum, puttsVal) => {
    const updatedHoles = editForm.holes.map(h => {
      if (h.number === holeNum) {
        return { ...h, putts: puttsVal };
      }
      return h;
    });
    setEditForm({ ...editForm, holes: updatedHoles });
  };

  // Hole Penalties adjustment
  const handleHolePenaltiesChange = (holeNum, delta) => {
    const updatedHoles = editForm.holes.map(h => {
      if (h.number === holeNum) {
        return { ...h, penalties: Math.max(0, (h.penalties || 0) + delta) };
      }
      return h;
    });
    setEditForm({ ...editForm, holes: updatedHoles });
  };

  // Hole Notes change
  const handleHoleNotesChange = (holeNum, notesVal) => {
    const updatedHoles = editForm.holes.map(h => {
      if (h.number === holeNum) {
        return { ...h, notes: notesVal };
      }
      return h;
    });
    setEditForm({ ...editForm, holes: updatedHoles });
  };

  // Guest score adjustment
  const handleHoleGuestScoreChange = (holeNum, guestKey, delta) => {
    const updatedHoles = editForm.holes.map(h => {
      if (h.number === holeNum) {
        const cur = (h.guestScores && h.guestScores[guestKey]) || h.par || 4;
        return {
          ...h,
          guestScores: {
            ...(h.guestScores || {}),
            [guestKey]: Math.max(1, cur + delta),
          },
        };
      }
      return h;
    });
    setEditForm({ ...editForm, holes: updatedHoles });
  };

  // Auto match hole score to shots + penalties
  const handleAutoMatchHoleScore = (holeNum) => {
    const updatedHoles = editForm.holes.map(h => {
      if (h.number === holeNum) {
        const calculatedHoleScore = Math.max(1, (h.shots?.length || 0) + (h.penalties || 0));
        return { ...h, score: calculatedHoleScore };
      }
      return h;
    });
    const calculatedTotal = updatedHoles.reduce((acc, h) => acc + (h.score || 0), 0);
    setEditForm({ ...editForm, holes: updatedHoles, totalScore: calculatedTotal });
  };

  // Add shot to hole in edit mode
  const handleAddShotToHole = (e) => {
    e.preventDefault();
    if (!newShotClub && !newShotDist) return;

    const clubToUse = newShotClub || (availableClubs[0] || '7 Iron');
    const distToUse = parseInt(newShotDist) || 0;

    const updatedHoles = editForm.holes.map(h => {
      if (h.number === editingHoleNum) {
        const currentShots = h.shots || [];
        const newShot = {
          id: `shot_${editingHoleNum}_${Date.now()}`,
          club: clubToUse,
          distance: distToUse,
          lie: newShotLie || (currentShots.length === 0 ? 'Tee' : 'Fairway'),
          result: newShotResult || 'Target',
        };
        const newShots = [...currentShots, newShot];
        return {
          ...h,
          shots: newShots,
          // If score is currently 0 or smaller than shots, auto-tally score
          score: Math.max(h.score, newShots.length),
        };
      }
      return h;
    });

    const calculatedTotal = updatedHoles.reduce((acc, h) => acc + (h.score || 0), 0);
    setEditForm({ ...editForm, holes: updatedHoles, totalScore: calculatedTotal });
    setNewShotDist('');
  };

  // Remove shot from hole in edit mode
  const handleDeleteShotFromHole = (holeNum, shotId) => {
    const updatedHoles = editForm.holes.map(h => {
      if (h.number === holeNum) {
        return { ...h, shots: (h.shots || []).filter(s => s.id !== shotId) };
      }
      return h;
    });
    setEditForm({ ...editForm, holes: updatedHoles });
  };

  // Move shot order up or down
  const handleMoveShot = (holeNum, shotIndex, direction) => {
    const updatedHoles = editForm.holes.map(h => {
      if (h.number === holeNum) {
        const shots = [...(h.shots || [])];
        const targetIndex = direction === 'up' ? shotIndex - 1 : shotIndex + 1;
        if (targetIndex >= 0 && targetIndex < shots.length) {
          const temp = shots[shotIndex];
          shots[shotIndex] = shots[targetIndex];
          shots[targetIndex] = temp;
        }
        return { ...h, shots };
      }
      return h;
    });
    setEditForm({ ...editForm, holes: updatedHoles });
  };

  // Edit an existing shot's club, distance, lie, or result
  const handleUpdateShot = (holeNum, shotId, field, value) => {
    const updatedHoles = editForm.holes.map(h => {
      if (h.number === holeNum) {
        const updatedShots = (h.shots || []).map(s => {
          if (s.id === shotId) {
            return {
              ...s,
              [field]: field === 'distance' ? (parseInt(value) || 0) : value,
            };
          }
          return s;
        });
        return { ...h, shots: updatedShots };
      }
      return h;
    });
    setEditForm({ ...editForm, holes: updatedHoles });
  };

  // Save all edits to round
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (onUpdateRound) {
      onUpdateRound({
        ...round,
        courseName: editForm.courseName.trim(),
        courseLocation: editForm.courseLocation.trim(),
        date: editForm.date.trim(),
        guestCount: Number(editForm.guestCount) || 0,
        tee: editForm.tee,
        weather: editForm.weather,
        notes: editForm.notes,
        totalScore: parseInt(editForm.totalScore) || 0,
        holes: editForm.holes,
      });
    }
    setIsEditing(false);
  };

  const handleConfirmDelete = () => {
    if (onDeleteRound) {
      onDeleteRound(round.id);
    }
  };

  const calculatedSum = editForm.holes.reduce((sum, h) => sum + (h.score || 0), 0);
  const currentEditingHole = editForm.holes.find(h => h.number === editingHoleNum) || editForm.holes[0];

  return (
    <div className="bg-gray-50 min-h-screen pb-16">
      {/* Header */}
      <div className="bg-white p-6 shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={() => navigate('dashboard')} className="text-gray-500 font-bold mr-4 text-sm hover:text-gray-800 transition">
              ← Back
            </button>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Scorecard Recap</h2>
          </div>

          {/* Action buttons (Edit / Delete) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleOpenEdit}
              className="px-3.5 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold text-xs rounded-xl border border-green-200 transition flex items-center gap-1.5 shadow-xs"
              title="Edit Round & Scorecard"
            >
              <Icons.Pencil /> Edit Round
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
              title="Delete Round"
            >
              <Icons.Trash />
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-black text-gray-900 leading-tight">{round.courseName}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500 font-medium">
          <span>{round.date || 'Recent'}</span>
          {round.courseLocation && <span>• {round.courseLocation}</span>}
          {round.tee && <span className="bg-gray-100 text-gray-700 font-bold px-2 py-0.5 rounded-full">• {round.tee} Tees</span>}
          {round.weather && <span>• {round.weather}</span>}
          {round.guestCount > 0 && <span>• {round.guestCount} Guest{round.guestCount > 1 ? 's' : ''}</span>}
        </div>

        {round.notes && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200/80 rounded-xl text-xs text-gray-700 italic">
            "{round.notes}"
          </div>
        )}

        <div className="mt-5 flex justify-between items-end">
          <div className="bg-green-50 px-4 py-2.5 rounded-2xl border border-green-100">
            <span className="block text-[10px] font-black text-green-800 uppercase tracking-wider mb-0.5">Total Score</span>
            <span className="text-4xl font-black text-green-700 tracking-tight">{round.totalScore}</span>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setTab('insights')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                tab === 'insights' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'
              }`}
            >
              Insights
            </button>
            <button
              onClick={() => setTab('scorecard')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                tab === 'scorecard' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              Card
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {tab === 'insights' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-6">
            <div>
              <h3 className="font-black text-gray-900 mb-1">Club Gapping</h3>
              <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                Compare your stock yardages (dashed lines) vs. what you actually logged in this round.
              </p>

              {clubStats.length === 0 ? (
                <div className="p-6 bg-gray-50 rounded-xl text-center text-gray-400 text-xs font-medium">
                  No shot yardages logged for this round yet. You can add them via "Edit Round" anytime!
                </div>
              ) : (
                <div className="space-y-4">
                  {clubStats.map(stat => {
                    const diff = stat.actual - stat.stock;
                    return (
                      <div key={stat.name} className="relative">
                        <div className="flex justify-between text-sm mb-1 font-bold">
                          <span className="text-gray-700">{stat.name}</span>
                          <span className={diff >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {stat.actual}y <span className="text-xs opacity-70 font-semibold">({diff > 0 ? '+' : ''}{diff})</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-5 rounded-lg overflow-hidden relative">
                          <div
                            className="absolute top-0 bottom-0 border-l-2 border-dashed border-gray-600 z-10"
                            style={{ left: `${Math.min(100, (stat.stock / 300) * 100)}%` }}
                          ></div>
                          <div
                            className={`h-full rounded-r transition-all duration-700 ${
                              diff >= 0 ? 'bg-green-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${Math.min(100, (stat.actual / 300) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {clubStats.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                <h4 className="text-xs font-black text-blue-800 uppercase tracking-wider mb-1">Strategy Insight</h4>
                <p className="text-xs text-blue-900 font-medium leading-relaxed">
                  Review your actual carry distances compared to stock numbers above to dial in club selection on future approach shots.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {(!round.holes || round.holes.length === 0) ? (
              <div className="p-8 text-center text-gray-400 text-xs font-medium">
                No hole breakdown recorded for this round. Tap "Edit Round" to add holes and scores!
              </div>
            ) : (
              round.holes.map((hole, i) => {
                const diff = (hole.score || hole.par || 4) - (hole.par || 4);
                const diffLabel = diff < 0 ? 'Birdie' : diff === 0 ? 'Par' : diff === 1 ? 'Bogey' : `+${diff}`;
                const diffClass = diff < 0 ? 'text-red-600 bg-red-50' : diff === 0 ? 'text-blue-600 bg-blue-50' : 'text-gray-600 bg-gray-100';

                return (
                  <div
                    key={hole.number || i}
                    className="p-4 flex flex-col gap-2 hover:bg-gray-50/50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center font-black text-gray-800 text-sm">
                          {hole.number || i + 1}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-500">Par {hole.par || 4}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${diffClass}`}>
                              {diffLabel}
                            </span>
                            {hole.fir && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                                {hole.fir === 'hit' ? '🎯 FIR' : hole.fir === 'miss_left' ? '⬅️ Miss L' : hole.fir === 'miss_right' ? '➡️ Miss R' : 'FIR: N/A'}
                              </span>
                            )}
                            {hole.putts !== null && hole.putts !== undefined && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                ⛳ {hole.putts} Putt{hole.putts !== 1 ? 's' : ''}
                              </span>
                            )}
                            {hole.penalties > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                                ⚠️ +{hole.penalties} Pen
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {hole.shots?.length || 0} shot{hole.shots?.length !== 1 ? 's' : ''} logged
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-gray-900">{hole.score}</span>
                        <button
                          onClick={() => handleOpenEditHole(hole.number || i + 1, 'holes')}
                          className="text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-lg border border-green-200 transition"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    {/* Display hole notes if present */}
                    {hole.notes && (
                      <p className="text-xs text-gray-500 italic pl-12">"{hole.notes}"</p>
                    )}

                    {/* Display guest scores if present */}
                    {hole.guestScores && Object.keys(hole.guestScores).length > 0 && (
                      <div className="text-[11px] text-gray-500 font-medium pl-12 flex gap-2">
                        {Object.entries(hole.guestScores).map(([gk, gval]) => (
                          <span key={gk} className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-bold">
                            {gk.replace('guest', 'Guest ')}: {gval}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Display recorded shots if present */}
                    {hole.shots && hole.shots.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1 pl-12">
                        {hole.shots.map((s, idx) => (
                          <span
                            key={s.id || idx}
                            className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded-md"
                          >
                            <span className="font-bold text-gray-900">{s.club}</span>
                            {s.distance > 0 && <span className="text-gray-500 font-mono">({s.distance}y)</span>}
                            {s.lie && s.lie !== 'Fairway' && <span className="text-[9px] text-gray-400 uppercase">[{s.lie}]</span>}
                            {s.result && s.result !== 'Target' && <span className="text-[9px] text-gray-400">({s.result})</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Expanded Edit Round & Scorecard Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
              <div>
                <h3 className="text-lg font-black text-gray-900">Edit Round & Attributes</h3>
                <p className="text-xs text-gray-500 font-medium">
                  {editForm.courseName} • Total Score: <strong className="text-green-700 font-black">{editForm.totalScore}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 font-bold flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Segmented Sub-Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-100/60 p-1">
              <button
                type="button"
                onClick={() => setEditTab('overview')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  editTab === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                📋 Overview
              </button>
              <button
                type="button"
                onClick={() => setEditTab('holes')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  editTab === 'holes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                ⛳ Holes (1-18)
              </button>
              <button
                type="button"
                onClick={() => setEditTab('shots')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  editTab === 'shots' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                🎯 Shots & Clubs
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* TAB 1: OVERVIEW */}
              {editTab === 'overview' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Course Name</label>
                    <input
                      required
                      type="text"
                      value={editForm.courseName}
                      onChange={(e) => setEditForm({ ...editForm, courseName: e.target.value })}
                      className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Course Location</label>
                    <input
                      type="text"
                      value={editForm.courseLocation}
                      placeholder="e.g. Surrey, UK"
                      onChange={(e) => setEditForm({ ...editForm, courseLocation: e.target.value })}
                      className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Date Played</label>
                      <input
                        type="text"
                        value={editForm.date}
                        placeholder="e.g. Oct 9, 2026"
                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Playing Guests</label>
                      <select
                        value={editForm.guestCount}
                        onChange={(e) => setEditForm({ ...editForm, guestCount: Number(e.target.value) })}
                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      >
                        <option value={0}>0 Guests (Solo)</option>
                        <option value={1}>1 Guest</option>
                        <option value={2}>2 Guests</option>
                        <option value={3}>3 Guests</option>
                      </select>
                    </div>
                  </div>

                  {/* Tee Box & Weather Attributes */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Tee Box</label>
                      <select
                        value={editForm.tee}
                        onChange={(e) => setEditForm({ ...editForm, tee: e.target.value })}
                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      >
                        <option value="White">White Tees</option>
                        <option value="Yellow">Yellow Tees</option>
                        <option value="Blue">Blue Tees</option>
                        <option value="Red">Red Tees</option>
                        <option value="Black">Black Tees</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Weather Conditions</label>
                      <select
                        value={editForm.weather}
                        onChange={(e) => setEditForm({ ...editForm, weather: e.target.value })}
                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                      >
                        <option value="Sunny ☀️">Sunny ☀️</option>
                        <option value="Mild ⛅">Mild ⛅</option>
                        <option value="Windy 💨">Windy 💨</option>
                        <option value="Rain 🌧️">Rain 🌧️</option>
                        <option value="Cold ❄️">Cold ❄️</option>
                      </select>
                    </div>
                  </div>

                  {/* Round Notes & Thoughts */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Round Notes & Strategy Reflections</label>
                    <textarea
                      rows={3}
                      value={editForm.notes}
                      placeholder="Takeaways from the round, swing thoughts, key holes..."
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>

                  {/* Total Score card */}
                  <div className="bg-green-50/70 border border-green-200 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-black text-green-800 uppercase tracking-wider">Total Gross Score</span>
                      <span className="text-xs text-gray-500 font-medium">Sum of all 18 holes: <strong>{calculatedSum}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editForm.totalScore}
                        onChange={(e) => setEditForm({ ...editForm, totalScore: parseInt(e.target.value) || 0 })}
                        className="w-20 p-2 border border-green-300 rounded-xl bg-white font-black text-xl text-center focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                      {editForm.totalScore !== calculatedSum && (
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, totalScore: calculatedSum })}
                          className="text-[10px] font-bold text-green-700 bg-white border border-green-300 px-2.5 py-1.5 rounded-lg shadow-xs hover:bg-green-100"
                        >
                          Use {calculatedSum}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: HOLES & ATTRIBUTES (1-18) */}
              {editTab === 'holes' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 font-medium mb-1">
                    Edit score, par, fairways (FIR), putts, penalties, notes, and guest scores for each hole.
                  </p>

                  <div className="space-y-3">
                    {editForm.holes.map(hole => (
                      <div
                        key={hole.number}
                        className="bg-gray-50 border border-gray-200 p-3.5 rounded-2xl space-y-3"
                      >
                        {/* Top row: Hole number, Par buttons, My Score counter */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-gray-900 text-white font-black text-xs flex items-center justify-center">
                              {hole.number}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase mr-0.5">Par</span>
                              {[3, 4, 5, 6].map(pVal => (
                                <button
                                  key={pVal}
                                  type="button"
                                  onClick={() => handleHoleParChange(hole.number, pVal)}
                                  className={`px-2 py-0.5 text-xs font-bold rounded-md transition ${
                                    hole.par === pVal ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                                  }`}
                                >
                                  {pVal}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* My Gross Score */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-gray-400 uppercase mr-1">Score</span>
                            <button
                              type="button"
                              onClick={() => handleHoleScoreChange(hole.number, -1)}
                              className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 font-black text-sm flex items-center justify-center transition active:scale-95"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-black text-base text-gray-900">{hole.score}</span>
                            <button
                              type="button"
                              onClick={() => handleHoleScoreChange(hole.number, 1)}
                              className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 font-black text-sm flex items-center justify-center transition active:scale-95"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Middle row: Fairway (FIR), Putts, Penalties */}
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-200/60">
                          {/* FIR */}
                          <div>
                            <span className="block text-[9px] font-black text-gray-400 uppercase mb-1">Fairway (FIR)</span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleHoleFirChange(hole.number, 'hit')}
                                className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition ${
                                  hole.fir === 'hit' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'
                                }`}
                                title="Fairway Hit"
                              >
                                🎯
                              </button>
                              <button
                                type="button"
                                onClick={() => handleHoleFirChange(hole.number, 'miss_left')}
                                className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition ${
                                  hole.fir === 'miss_left' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200'
                                }`}
                                title="Missed Left"
                              >
                                ⬅️
                              </button>
                              <button
                                type="button"
                                onClick={() => handleHoleFirChange(hole.number, 'miss_right')}
                                className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition ${
                                  hole.fir === 'miss_right' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200'
                                }`}
                                title="Missed Right"
                              >
                                ➡️
                              </button>
                            </div>
                          </div>

                          {/* Putts */}
                          <div>
                            <span className="block text-[9px] font-black text-gray-400 uppercase mb-1">Putts</span>
                            <div className="flex items-center gap-1">
                              <select
                                value={hole.putts !== null && hole.putts !== undefined ? hole.putts : ''}
                                onChange={(e) => handleHolePuttsChange(hole.number, e.target.value === '' ? null : Number(e.target.value))}
                                className="w-full p-1 border border-gray-200 rounded-lg text-xs font-bold bg-white text-center"
                              >
                                <option value="">--</option>
                                <option value={0}>0 Putts</option>
                                <option value={1}>1 Putt</option>
                                <option value={2}>2 Putts</option>
                                <option value={3}>3 Putts</option>
                                <option value={4}>4+ Putts</option>
                              </select>
                            </div>
                          </div>

                          {/* Penalties */}
                          <div>
                            <span className="block text-[9px] font-black text-gray-400 uppercase mb-1">Penalties</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleHolePenaltiesChange(hole.number, -1)}
                                className="w-6 h-6 rounded bg-gray-200 text-xs font-bold"
                              >
                                -
                              </button>
                              <span className="flex-1 text-center font-bold text-xs">{hole.penalties || 0}</span>
                              <button
                                type="button"
                                onClick={() => handleHolePenaltiesChange(hole.number, 1)}
                                className="w-6 h-6 rounded bg-gray-200 text-xs font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Guest Scores row if guestCount > 0 */}
                        {editForm.guestCount > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-200/60 items-center">
                            <span className="text-[9px] font-black text-gray-400 uppercase">Guests:</span>
                            {Array.from({ length: editForm.guestCount }).map((_, gIdx) => {
                              const gKey = `guest${gIdx + 1}`;
                              const gScore = (hole.guestScores && hole.guestScores[gKey]) || hole.par || 4;
                              return (
                                <div key={gKey} className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-gray-200">
                                  <span className="text-[10px] font-bold text-gray-500">G{gIdx + 1}:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleHoleGuestScoreChange(hole.number, gKey, -1)}
                                    className="w-5 h-5 rounded bg-gray-100 text-[10px] font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-black w-4 text-center">{gScore}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleHoleGuestScoreChange(hole.number, gKey, 1)}
                                    className="w-5 h-5 rounded bg-gray-100 text-[10px] font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Hole Notes & Quick Shot Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="Hole note (e.g. pulled into bunker)..."
                            value={hole.notes || ''}
                            onChange={(e) => handleHoleNotesChange(hole.number, e.target.value)}
                            className="flex-1 p-1.5 px-2 text-xs border border-gray-200 rounded-lg bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditingHoleNum(hole.number);
                              setEditTab('shots');
                            }}
                            className="shrink-0 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-200 transition"
                          >
                            🎯 {hole.shots?.length || 0} Shots →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: SHOTS & CLUBS */}
              {editTab === 'shots' && (
                <div className="space-y-4">
                  {/* Hole selector pills */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">Select Hole</label>
                    <div className="flex gap-1.5 overflow-x-auto pb-2">
                      {editForm.holes.map(h => {
                        const shotCount = h.shots?.length || 0;
                        return (
                          <button
                            key={h.number}
                            type="button"
                            onClick={() => setEditingHoleNum(h.number)}
                            className={`min-w-[42px] h-10 px-2 rounded-xl font-black text-xs shrink-0 transition flex flex-col items-center justify-center ${
                              editingHoleNum === h.number
                                ? 'bg-green-700 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            <span>H{h.number}</span>
                            <span className={`text-[9px] font-bold ${editingHoleNum === h.number ? 'text-green-200' : 'text-gray-400'}`}>
                              {shotCount} sh
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Hole Card */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base text-gray-900">Hole {currentEditingHole.number}</span>
                        <span className="text-xs font-bold text-gray-400">Par {currentEditingHole.par}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full">
                          Score: {currentEditingHole.score}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAutoMatchHoleScore(currentEditingHole.number)}
                          className="text-[10px] font-bold bg-white text-gray-700 border border-gray-300 px-2 py-0.5 rounded-md hover:bg-gray-50 transition"
                          title="Auto set hole score to number of shots logged + penalties"
                        >
                          ⚡ Auto-Tally Score
                        </button>
                      </div>
                    </div>

                    {/* Logged Shots List for this hole */}
                    <div className="space-y-2 mb-4">
                      {(!currentEditingHole.shots || currentEditingHole.shots.length === 0) ? (
                        <p className="text-xs text-gray-400 font-medium py-4 text-center">
                          No shots logged on Hole {currentEditingHole.number} yet. Add shots below!
                        </p>
                      ) : (
                        currentEditingHole.shots.map((shot, sIdx) => (
                          <div
                            key={shot.id || sIdx}
                            className="bg-white border border-gray-200 p-2.5 rounded-xl flex flex-col gap-2 shadow-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-gray-700">Shot {sIdx + 1}</span>
                              <div className="flex items-center gap-1">
                                {sIdx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveShot(currentEditingHole.number, sIdx, 'up')}
                                    className="p-1 text-gray-400 hover:text-gray-700 text-xs font-bold"
                                    title="Move earlier"
                                  >
                                    ↑
                                  </button>
                                )}
                                {sIdx < currentEditingHole.shots.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveShot(currentEditingHole.number, sIdx, 'down')}
                                    className="p-1 text-gray-400 hover:text-gray-700 text-xs font-bold"
                                    title="Move later"
                                  >
                                    ↓
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteShotFromHole(currentEditingHole.number, shot.id)}
                                  className="text-red-400 hover:text-red-600 p-1"
                                  title="Delete shot"
                                >
                                  <Icons.Trash />
                                </button>
                              </div>
                            </div>

                            {/* Club and Distance inputs */}
                            <div className="flex gap-2">
                              <select
                                value={shot.club}
                                onChange={(e) => handleUpdateShot(currentEditingHole.number, shot.id, 'club', e.target.value)}
                                className="p-1.5 border border-gray-200 rounded-lg text-xs font-bold bg-gray-50 flex-1"
                              >
                                {availableClubs.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  placeholder="Yards"
                                  value={shot.distance || ''}
                                  onChange={(e) => handleUpdateShot(currentEditingHole.number, shot.id, 'distance', e.target.value)}
                                  className="w-16 p-1.5 border border-gray-200 rounded-lg text-xs font-bold text-center"
                                />
                                <span className="text-[10px] text-gray-400 font-bold">y</span>
                              </div>
                            </div>

                            {/* Lie and Result attributes */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[9px] font-bold text-gray-400 uppercase">Lie</span>
                                <select
                                  value={shot.lie || 'Fairway'}
                                  onChange={(e) => handleUpdateShot(currentEditingHole.number, shot.id, 'lie', e.target.value)}
                                  className="w-full p-1 border border-gray-200 rounded-lg text-[11px] font-semibold bg-gray-50 mt-0.5"
                                >
                                  {LIE_OPTIONS.map(l => (
                                    <option key={l} value={l}>{l}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-gray-400 uppercase">Result / Shape</span>
                                <select
                                  value={shot.result || 'Target'}
                                  onChange={(e) => handleUpdateShot(currentEditingHole.number, shot.id, 'result', e.target.value)}
                                  className="w-full p-1 border border-gray-200 rounded-lg text-[11px] font-semibold bg-gray-50 mt-0.5"
                                >
                                  {RESULT_OPTIONS.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Shot Form */}
                    <form onSubmit={handleAddShotToHole} className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col gap-2">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">+ Add Shot to Hole {currentEditingHole.number}</span>
                      <div className="flex gap-2 items-center">
                        <select
                          value={newShotClub}
                          onChange={(e) => setNewShotClub(e.target.value)}
                          className="p-2 border border-gray-200 rounded-lg text-xs font-semibold bg-gray-50 flex-1"
                        >
                          <option value="">Select Club...</option>
                          {availableClubs.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Dist (y)"
                          value={newShotDist}
                          onChange={(e) => setNewShotDist(e.target.value)}
                          className="w-20 p-2 border border-gray-200 rounded-lg text-xs font-bold text-center"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newShotLie}
                          onChange={(e) => setNewShotLie(e.target.value)}
                          className="p-1.5 border border-gray-200 rounded-lg text-[11px] font-semibold bg-gray-50"
                        >
                          {LIE_OPTIONS.map(l => (
                            <option key={l} value={l}>Lie: {l}</option>
                          ))}
                        </select>
                        <select
                          value={newShotResult}
                          onChange={(e) => setNewShotResult(e.target.value)}
                          className="p-1.5 border border-gray-200 rounded-lg text-[11px] font-semibold bg-gray-50"
                        >
                          {RESULT_OPTIONS.map(r => (
                            <option key={r} value={r}>Result: {r}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="bg-gray-900 hover:bg-black text-white text-xs font-bold py-2 rounded-lg transition active:scale-95"
                      >
                        + Add Shot
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-white border border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-100 transition text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition text-sm shadow-sm"
              >
                Save All Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-gray-900 mb-2">Delete Round?</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Are you sure you want to delete this scorecard for <span className="font-bold text-gray-800">{round.courseName}</span>?
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleConfirmDelete}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition"
              >
                Yes, Delete Round
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full text-gray-400 hover:text-gray-600 font-bold py-3 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
