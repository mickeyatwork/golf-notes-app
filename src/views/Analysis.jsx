import React, { useState } from 'react';
import { MOCK_PAST_ROUNDS } from '../data/mockData';
import { Icons } from '../components/Icons';

export default function Analysis({
  roundId,
  navigate,
  bag = [],
  rounds = [],
  onDeleteRound,
  onUpdateRound,
}) {
  const [tab, setTab] = useState('insights');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const round = rounds.find(r => r.id === roundId) || MOCK_PAST_ROUNDS.find(r => r.id === roundId) || null;

  const [editForm, setEditForm] = useState({
    courseName: round?.courseName || '',
    date: round?.date || '',
    totalScore: round?.totalScore || 0,
  });

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

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (onUpdateRound) {
      onUpdateRound({
        ...round,
        courseName: editForm.courseName.trim(),
        date: editForm.date.trim(),
        totalScore: parseInt(editForm.totalScore) || 0,
      });
    }
    setIsEditing(false);
  };

  const handleConfirmDelete = () => {
    if (onDeleteRound) {
      onDeleteRound(round.id);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-10">
      {/* Header */}
      <div className="bg-white p-6 shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={() => navigate('dashboard')} className="text-gray-500 font-bold mr-4 text-sm hover:text-gray-800">
              ← Back
            </button>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Scorecard Recap</h2>
          </div>

          {/* Action buttons (Edit / Delete) */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setEditForm({
                  courseName: round.courseName,
                  date: round.date || '',
                  totalScore: round.totalScore,
                });
                setIsEditing(true);
              }}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition"
              title="Edit Round"
            >
              <Icons.Pencil />
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
        <p className="text-gray-500 text-sm mt-1">{round.date || 'Recent'}</p>
        
        <div className="mt-6 flex justify-between items-end">
          <div className="bg-green-50 px-4 py-2 rounded-xl border border-green-100">
            <span className="block text-xs font-bold text-green-800 uppercase tracking-wider mb-0.5">Total Score</span>
            <span className="text-4xl font-black text-green-700">{round.totalScore}</span>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setTab('insights')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                tab === 'insights' ? 'bg-white shadow text-blue-700' : 'text-gray-500'
              }`}
            >
              Insights
            </button>
            <button
              onClick={() => setTab('scorecard')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                tab === 'scorecard' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              Card
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {tab === 'insights' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-6">
            <div>
              <h3 className="font-black text-gray-900 mb-1">Club Gapping</h3>
              <p className="text-xs text-gray-500 mb-5">
                Compare your stock yardages (dashed lines) vs. what you actually hit in this round.
              </p>
              
              {clubStats.length === 0 ? (
                <div className="p-6 bg-gray-50 rounded-xl text-center text-gray-400 text-xs font-medium">
                  No shot yardages logged for this round yet.
                </div>
              ) : (
                <div className="space-y-5">
                  {clubStats.map(stat => {
                    const diff = stat.actual - stat.stock;
                    return (
                      <div key={stat.name} className="relative">
                        <div className="flex justify-between text-sm mb-1 font-bold">
                          <span className="text-gray-700">{stat.name}</span>
                          <span className={diff >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {stat.actual}y <span className="text-xs opacity-70">({diff > 0 ? '+' : ''}{diff})</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-6 rounded overflow-hidden relative">
                          <div
                            className="absolute top-0 bottom-0 border-l-2 border-dashed border-gray-600 z-10"
                            style={{ left: `${Math.min(100, (stat.stock / 300) * 100)}%` }}
                          ></div>
                          <div
                            className={`h-full rounded-r transition-all duration-1000 ${
                              diff >= 0 ? 'bg-green-500' : 'bg-red-400'
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
                <h4 className="text-xs font-black text-blue-800 uppercase tracking-wider mb-2">Strategy Insight</h4>
                <p className="text-sm text-blue-900 font-medium leading-relaxed">
                  Review your actual carry distances compared to stock numbers above to dial in club selection on future approach shots.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {(!round.holes || round.holes.length === 0) ? (
              <div className="p-8 text-center text-gray-400 text-xs font-medium">
                No hole breakdown recorded for this round.
              </div>
            ) : (
              round.holes.map((hole, i) => (
                <div
                  key={hole.number || i}
                  className={`p-4 flex items-center justify-between ${i !== 0 ? 'border-t border-gray-100' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-black text-gray-700">
                      {hole.number || i + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Par {hole.par}</p>
                      <p className="text-sm font-medium text-gray-600 truncate max-w-[180px]">
                        {hole.shots?.map(s => s.club).join(' • ') || 'No shots logged'}
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-gray-800">{hole.score}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Round Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-xl font-black text-gray-900">Edit Round</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Course Name</label>
              <input
                required
                type="text"
                value={editForm.courseName}
                onChange={(e) => setEditForm({ ...editForm, courseName: e.target.value })}
                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-medium text-sm focus:outline-none focus:border-green-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Date</label>
                <input
                  type="text"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  placeholder="e.g. Oct 9, 2026"
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-medium text-sm focus:outline-none focus:border-green-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Total Score</label>
                <input
                  required
                  type="number"
                  value={editForm.totalScore}
                  onChange={(e) => setEditForm({ ...editForm, totalScore: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-black text-sm text-center focus:outline-none focus:border-green-600"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition text-sm"
              >
                Save Changes
              </button>
            </div>
          </form>
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
