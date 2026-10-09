import React, { useState } from 'react';
import { MOCK_COURSES } from '../data/mockData';
import { Icons } from '../components/Icons';
import { useOfflineScore } from '../hooks/useOfflineScore';

export default function ActiveHole({ activeRound, navigate, setActiveRound, bag, onFinishRound }) {
  const [currentHole, setCurrentHole] = useState(activeRound?.currentHole || 1);
  const [selectedClub, setSelectedClub] = useState('');
  const [shotDistance, setShotDistance] = useState('');
  const [gpsState, setGpsState] = useState('idle');
  
  const [editingShotId, setEditingShotId] = useState(null);
  const [editShotData, setEditShotData] = useState({ club: '', distance: '' });
  const [showEndModal, setShowEndModal] = useState(false);
  
  const course = MOCK_COURSES.find(c => c.id === activeRound?.courseId) || MOCK_COURSES[0];
  const clubData = bag.find(c => c.name === selectedClub);
  const holeData = { par: currentHole % 3 === 0 ? 3 : 4, distance: 420 - (currentHole * 12) };

  const { scores, updateScore, addShot, editShot, removeShot, needsSync } = useOfflineScore(activeRound?.courseId, currentHole, holeData.par, activeRound?.guestCount || 0);

  const nextHole = () => {
    if (currentHole < 18) {
      setCurrentHole(h => h + 1); setActiveRound(p => ({...p, currentHole: p.currentHole + 1}));
      setSelectedClub(''); setShotDistance(''); setGpsState('idle'); window.scrollTo(0,0);
    } else setShowEndModal(true);
  };

  const handleGpsToggle = () => {
    if (gpsState === 'idle') {
      setGpsState('manual');
    } else {
      setShotDistance((Math.floor(Math.random() * 150) + 100).toString());
      setGpsState('idle'); 
    }
  };

  const handleRecordShot = () => {
    addShot(selectedClub || 'Unknown', shotDistance);
    setShotDistance(''); setGpsState('auto');
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen flex flex-col relative pb-32">
      <div className="flex justify-between items-center mb-3 px-1">
        <h2 className="font-bold text-gray-500 uppercase tracking-widest text-xs truncate max-w-[200px]">{course.name}</h2>
        <button onClick={() => setShowEndModal(true)} className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1.5 rounded-full">Pause / Finish</button>
      </div>
      
      <div className="bg-green-800 text-white rounded-2xl p-6 text-center shadow-lg mb-4 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
        <div className="flex justify-between text-green-200 text-xs font-bold mb-2">
          <span>HCP Index 4</span><span>Par {holeData.par}</span>
        </div>
        <h1 className="text-xl font-bold tracking-wide">HOLE {currentHole}</h1>
        <h2 className="text-7xl font-black mt-1 tracking-tighter">{holeData.distance}</h2>
        <p className="text-sm font-semibold opacity-80 mt-1 uppercase tracking-[0.2em]">Yds to Center</p>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 mb-4">
        <h3 className="font-bold text-lg text-gray-800 mb-3">Prep & Log Shot</h3>
        <select value={selectedClub} onChange={(e) => setSelectedClub(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 text-lg font-semibold mb-3 focus:outline-none focus:ring-2 focus:ring-green-600">
          <option value="">Select a Club (Optional)...</option>
          {bag.map(c => <option key={c.id} value={c.name}>{c.name} ({c.carry}y)</option>)}
        </select>

        {clubData && (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-3 animate-in fade-in">
            <p className="text-[10px] font-black text-blue-800 uppercase tracking-wider mb-1">Swing Thought</p>
            <p className="text-sm font-medium text-gray-700">{clubData.swing}</p>
            <p className="text-[10px] font-black text-blue-800 uppercase tracking-wider mt-2 mb-1">Stance Notes</p>
            <p className="text-sm font-medium text-gray-700">{clubData.stance}</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-start">
            <div className="w-1/3 flex flex-col">
              <button onClick={handleGpsToggle} className={`w-full flex flex-col items-center justify-center rounded-xl font-bold text-xs transition border-2 py-2 ${gpsState === 'manual' ? 'bg-blue-50 border-blue-500 text-blue-700 animate-pulse' : gpsState === 'auto' ? 'bg-green-50 border-green-500 text-green-700 animate-pulse' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                <Icons.Target /> 
                {gpsState === 'idle' ? 'Mark Start' : gpsState === 'auto' ? 'Dist (Auto)' : 'Get Dist'}
              </button>
              {gpsState !== 'idle' && <button onClick={() => setGpsState('idle')} className="text-[10px] text-gray-400 mt-1 underline text-center w-full">Reset Pin</button>}
            </div>
            <input type="number" placeholder="Dist (y)" value={shotDistance} onChange={e => setShotDistance(e.target.value)} className="w-2/3 h-[52px] p-3 border border-gray-300 rounded-xl text-center font-black text-xl text-gray-800 focus:outline-none focus:border-green-500" />
          </div>
          <button onClick={handleRecordShot} className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-black active:scale-95 transition mt-1">+ Record {selectedClub || 'Unknown'}</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 mb-4">
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
          <h3 className="font-bold text-lg text-gray-800">Scorecard</h3>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${needsSync ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{needsSync ? 'Saving...' : 'Synced'}</span>
        </div>
        
        {scores.shots?.length > 0 && (
          <div className="mb-4 space-y-2">
            {scores.shots.map((shot, i) => (
              editingShotId === shot.id ? (
                <div key={shot.id} className="bg-white border border-blue-200 p-2 px-3 rounded-lg text-sm shadow-sm flex flex-col gap-2 animate-in fade-in">
                  <div className="flex gap-2">
                    <select value={editShotData.club} onChange={e => setEditShotData({...editShotData, club: e.target.value})} className="flex-1 p-1 border border-gray-200 rounded text-sm bg-gray-50">
                      <option value="Unknown">Unknown</option>
                      {bag.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <input type="number" placeholder="Yards" value={editShotData.distance} onChange={e => setEditShotData({...editShotData, distance: e.target.value})} className="w-16 p-1 border border-gray-200 rounded text-sm text-center font-bold" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingShotId(null)} className="text-gray-500 text-xs font-bold px-2 py-1">Cancel</button>
                    <button onClick={() => { editShot(shot.id, editShotData.club, editShotData.distance); setEditingShotId(null); }} className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded">Save</button>
                  </div>
                </div>
              ) : (
                <div key={shot.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-2 px-3 rounded-lg text-sm">
                  <span className="font-bold text-gray-700">{i + 1}. {shot.club}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-medium mr-1">{shot.distance > 0 ? `${shot.distance}y` : '-'}</span>
                    <button onClick={() => { setEditingShotId(shot.id); setEditShotData({ club: shot.club, distance: shot.distance || '' }); }} className="text-gray-400 hover:text-gray-600 p-1"><Icons.Pencil /></button>
                    <button onClick={() => removeShot(shot.id)} className="text-red-400 hover:text-red-600 p-1"><Icons.Trash /></button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div><span className="font-bold text-gray-700 block">Me</span><span className="text-[10px] text-gray-400 uppercase">Auto-tracked</span></div>
          <div className="flex gap-3 items-center">
            <button onClick={() => updateScore('user', -1)} className="bg-gray-100 w-10 h-10 rounded-full font-black text-xl">-</button>
            <span className="text-3xl font-black w-8 text-center">{scores.user}</span>
            <button onClick={() => updateScore('user', 1)} className="bg-gray-100 w-10 h-10 rounded-full font-black text-xl">+</button>
          </div>
        </div>

        {Array.from({length: activeRound?.guestCount || 0}).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
            <span className="font-medium text-gray-500">Guest {i+1}</span>
            <div className="flex gap-3 items-center">
              <button onClick={() => updateScore(`guest${i+1}`, -1)} className="bg-gray-50 text-gray-500 w-10 h-10 rounded-full font-bold text-lg">-</button>
              <span className="text-xl font-bold w-8 text-center text-gray-600">{scores[`guest${i+1}`]}</span>
              <button onClick={() => updateScore(`guest${i+1}`, 1)} className="bg-gray-50 text-gray-500 w-10 h-10 rounded-full font-bold text-lg">+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-50 border-t border-gray-200 max-w-md mx-auto flex gap-3 z-40">
        {currentHole > 1 && <button onClick={() => setCurrentHole(h => h - 1)} className="w-1/3 bg-white border border-gray-300 text-gray-700 font-bold py-4 rounded-xl active:bg-gray-100">← Prev</button>}
        <button onClick={nextHole} className={`${currentHole > 1 ? 'w-2/3' : 'w-full'} bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg active:bg-green-700 transition`}>{currentHole === 18 ? 'Finish Round 🏆' : 'Next Hole →'}</button>
      </div>

      {showEndModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-gray-900 mb-2">Finish Round?</h3>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => {
                  const completed = {
                    id: activeRound?.id || `round_${Date.now()}`,
                    courseId: activeRound?.courseId,
                    courseName: activeRound?.courseName || 'Custom Course',
                    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    totalScore: scores?.user ? Math.max(1, scores.user) : 72,
                    holes: [],
                  };
                  if (onFinishRound) {
                    onFinishRound(completed);
                  } else {
                    setActiveRound(null);
                    navigate('dashboard');
                  }
                }}
                className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl text-lg hover:bg-green-700 transition"
              >
                Save & Complete
              </button>
              <button onClick={() => navigate('dashboard')} className="w-full bg-blue-50 text-blue-700 font-bold py-3.5 rounded-xl text-lg transition">Pause (Home)</button>
              <button onClick={() => setShowEndModal(false)} className="w-full text-gray-400 font-bold py-3 hover:text-gray-600 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
