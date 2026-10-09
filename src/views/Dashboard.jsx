import React, { useState } from 'react';
import { MOCK_USER } from '../data/mockData';
import { Icons } from '../components/Icons';

export default function Dashboard({
  navigate,
  activeRound,
  setActiveRound,
  currentUser = MOCK_USER,
  rounds = [],
  onDeleteRound,
  onUpdateRound,
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [editingRound, setEditingRound] = useState(null);
  const [deletingRoundId, setDeletingRoundId] = useState(null);

  const userHandicap = currentUser?.handicap !== null && currentUser?.handicap !== undefined && !isNaN(currentUser.handicap)
    ? Number(currentUser.handicap)
    : null;

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingRound) return;
    if (onUpdateRound) {
      onUpdateRound({
        ...editingRound,
        totalScore: parseInt(editingRound.totalScore) || 0,
      });
    }
    setEditingRound(null);
  };

  const handleConfirmDelete = () => {
    if (deletingRoundId && onDeleteRound) {
      onDeleteRound(deletingRoundId);
    }
    setDeletingRoundId(null);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header Greeting */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Welcome back</span>
          <h2 className="text-3xl font-black text-gray-800">
            {currentUser?.first_name || currentUser?.username || 'Golfer'}
          </h2>
        </div>
        <div className="bg-white border border-gray-200 px-3.5 py-1.5 rounded-full text-right shadow-sm">
          <span className="text-[10px] uppercase font-black text-gray-400 block leading-tight">HCP</span>
          <span className="text-sm font-black text-green-700">{userHandicap !== null ? userHandicap : '--'}</span>
        </div>
      </div>
      
      {/* Active In-Progress Round Banner */}
      {activeRound && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2 relative z-10">
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">In Progress</span>
            <span className="text-xs text-blue-800 font-bold bg-blue-100 px-2 py-1 rounded-full">Hole {activeRound.currentHole}</span>
          </div>
          <h3 className="text-xl font-bold text-blue-900 mb-1 relative z-10">{activeRound.courseName}</h3>
          <p className="text-sm text-blue-700 mb-4 relative z-10">Started {activeRound.dateStarted} • {activeRound.guestCount} Guests</p>
          <button
            onClick={() => navigate('active', activeRound)}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-sm hover:bg-blue-700 transition active:scale-95"
          >
            Resume Round
          </button>
        </div>
      )}

      {/* Start Round & Analytics CTAs */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => activeRound ? setShowPrompt(true) : navigate('start')}
          className="flex-1 bg-green-600 text-white text-base font-black py-4 rounded-xl shadow-md hover:bg-green-700 transition active:scale-95 flex items-center justify-center gap-2"
        >
          <span>+</span> Start New Round
        </button>
        <button
          onClick={() => navigate('analytics')}
          className="bg-white border border-gray-200 text-gray-800 font-bold px-4 py-4 rounded-xl shadow-sm hover:border-green-500 hover:text-green-700 transition active:scale-95 flex items-center justify-center gap-1.5"
          title="View Analytics & Reports"
        >
          <Icons.BarChart />
          <span className="text-xs uppercase tracking-wider font-black">Stats</span>
        </button>
      </div>

      {/* Recent Rounds Section */}
      {(() => {
        const uniqueRounds = (rounds || []).filter((round, index, self) =>
          index === self.findIndex((r) => (
            r.id === round.id || (r.courseName === round.courseName && r.totalScore === round.totalScore && r.date === round.date)
          ))
        );

        return (
          <>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Recent Rounds</h3>
              {uniqueRounds.length > 0 && (
                <span className="text-xs font-semibold text-gray-400">{uniqueRounds.length} Total</span>
              )}
            </div>

            {uniqueRounds.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                <div className="w-12 h-12 bg-green-50 text-green-700 rounded-full flex items-center justify-center mx-auto text-xl mb-3">
                  ⛳
                </div>
                <h4 className="font-bold text-gray-800 text-base">No Rounds Recorded Yet</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Your recorded scorecards and hole-by-hole shot stats will appear here. Hit "+ Start New Round" to play your first round!
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                {uniqueRounds.map((round, idx) => (
            <div
              key={round.id}
              className={`flex justify-between items-center py-4 px-4 hover:bg-gray-50/70 transition ${
                idx !== rounds.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div
                onClick={() => navigate('analysis', round.id)}
                className="text-left flex-1 cursor-pointer pr-3"
              >
                <p className="font-bold text-gray-800 flex items-center gap-2">{round.courseName}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {round.date || 'Recent'}
                  {userHandicap !== null ? (
                    <span className="text-green-600 font-bold ml-2">Net {round.totalScore - userHandicap}</span>
                  ) : (
                    <span className="text-gray-400 font-medium ml-2">Gross {round.totalScore}</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  onClick={() => navigate('analysis', round.id)}
                  className="font-black text-2xl text-gray-800 cursor-pointer"
                >
                  {round.totalScore}
                </span>

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-1 border-l border-gray-100 pl-3">
                  <button
                    onClick={() => setEditingRound({ ...round })}
                    className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition"
                    title="Edit Round"
                  >
                    <Icons.Pencil />
                  </button>
                  <button
                    onClick={() => setDeletingRoundId(round.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                    title="Delete Round"
                  >
                    <Icons.Trash />
                  </button>
                  <button
                    onClick={() => navigate('analysis', round.id)}
                    className="text-gray-400 hover:text-gray-600 pl-1"
                  >
                    <Icons.ChevronRight />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
    );
  })()}

      {/* Edit Round Modal */}
      {editingRound && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-xl font-black text-gray-900">Edit Round</h3>
              <button
                type="button"
                onClick={() => setEditingRound(null)}
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
                value={editingRound.courseName}
                onChange={(e) => setEditingRound({ ...editingRound, courseName: e.target.value })}
                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-medium text-sm focus:outline-none focus:border-green-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Date</label>
                <input
                  type="text"
                  value={editingRound.date}
                  onChange={(e) => setEditingRound({ ...editingRound, date: e.target.value })}
                  placeholder="e.g. Oct 9, 2026"
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-medium text-sm focus:outline-none focus:border-green-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Total Score</label>
                <input
                  required
                  type="number"
                  value={editingRound.totalScore}
                  onChange={(e) => setEditingRound({ ...editingRound, totalScore: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-black text-sm text-center focus:outline-none focus:border-green-600"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRound(null)}
                className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition text-sm"
              >
                Save Round
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingRoundId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-gray-900 mb-2">Delete Round?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this round scorecard? This action cannot be undone.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleConfirmDelete}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition"
              >
                Yes, Delete Scorecard
              </button>
              <button
                onClick={() => setDeletingRoundId(null)}
                className="w-full text-gray-400 hover:text-gray-600 font-bold py-3 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Round In-Progress Warning Prompt */}
      {showPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-gray-900 mb-2">Active Round Found</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              You have a round in progress at {activeRound?.courseName}. Save or discard it before starting a new one.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setActiveRound(null); navigate('start'); }}
                className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 transition"
              >
                Save & Start New
              </button>
              <button
                onClick={() => { setActiveRound(null); navigate('start'); }}
                className="w-full bg-red-50 text-red-600 font-bold py-3.5 rounded-xl hover:bg-red-100 transition"
              >
                Discard & Start New
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                className="w-full text-gray-400 font-bold py-3 hover:text-gray-600 transition"
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
