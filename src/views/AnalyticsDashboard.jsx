import React, { useState } from 'react';
import { Icons } from '../components/Icons';

export default function AnalyticsDashboard({
  navigate,
  rounds = [],
  bag = [],
  currentUser = null,
}) {
  const [filterRange, setFilterRange] = useState('all'); // 'all' | '5' | '10'

  // Filter rounds based on selected range
  const sortedRounds = [...rounds].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const activeRounds = filterRange === '5'
    ? sortedRounds.slice(0, 5)
    : filterRange === '10'
    ? sortedRounds.slice(0, 10)
    : sortedRounds;

  const totalRoundsCount = activeRounds.length;

  // 1. Scoring KPIs
  const totalScoresSum = activeRounds.reduce((acc, r) => acc + (r.totalScore || 72), 0);
  const scoringAverage = totalRoundsCount > 0 ? (totalScoresSum / totalRoundsCount).toFixed(1) : '--';

  const bestRound = activeRounds.length > 0
    ? activeRounds.reduce((min, r) => (r.totalScore < min.totalScore ? r : min), activeRounds[0])
    : null;

  const userHcp = currentUser?.handicap !== null && currentUser?.handicap !== undefined && !isNaN(currentUser.handicap)
    ? Number(currentUser.handicap)
    : null;

  // 2. Par 3, 4, 5 Breakdowns & Score Distribution
  let par3Scores = [], par4Scores = [], par5Scores = [];
  let eaglesCount = 0, birdiesCount = 0, parsCount = 0, bogeysCount = 0, doublesPlusCount = 0;
  let totalHolesAnalyzed = 0;

  activeRounds.forEach(round => {
    (round.holes || []).forEach(hole => {
      totalHolesAnalyzed++;
      const par = hole.par || 4;
      const score = hole.score || par;
      const diff = score - par;

      if (par === 3) par3Scores.push(score);
      else if (par === 5) par5Scores.push(score);
      else par4Scores.push(score);

      if (diff <= -2) eaglesCount++;
      else if (diff === -1) birdiesCount++;
      else if (diff === 0) parsCount++;
      else if (diff === 1) bogeysCount++;
      else doublesPlusCount++;
    });
  });

  const avgPar3 = par3Scores.length > 0 ? (par3Scores.reduce((a, b) => a + b, 0) / par3Scores.length).toFixed(2) : '--';
  const avgPar4 = par4Scores.length > 0 ? (par4Scores.reduce((a, b) => a + b, 0) / par4Scores.length).toFixed(2) : '--';
  const avgPar5 = par5Scores.length > 0 ? (par5Scores.reduce((a, b) => a + b, 0) / par5Scores.length).toFixed(2) : '--';

  const pct = (count) => totalHolesAnalyzed > 0 ? Math.round((count / totalHolesAnalyzed) * 100) : 0;

  // 3. Cross-Round Club Dispersion (Bag Performance across all rounds)
  const clubStats = bag.filter(c => c.name !== 'Putter').map(club => {
    let totalYards = 0;
    let shotCount = 0;
    let maxDist = 0;

    activeRounds.forEach(r => {
      (r.holes || []).forEach(h => {
        (h.shots || []).forEach(s => {
          if (s.club === club.name && s.distance > 0) {
            totalYards += s.distance;
            shotCount++;
            if (s.distance > maxDist) maxDist = s.distance;
          }
        });
      });
    });

    const actualAvg = shotCount > 0 ? Math.round(totalYards / shotCount) : null;
    return {
      name: club.name,
      stock: club.carry,
      actual: actualAvg,
      count: shotCount,
      max: maxDist,
    };
  }).filter(c => c.actual !== null || c.stock > 0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center">
          <button
            onClick={() => navigate('dashboard')}
            className="text-gray-500 font-bold mr-3 text-sm hover:text-gray-900 transition"
          >
            ← Back
          </button>
          <h2 className="text-2xl font-black text-gray-900">Analytics & Reports</h2>
        </div>
      </div>

      {/* Filter Range Selector */}
      <div className="bg-gray-200 p-1 rounded-2xl flex mb-6">
        <button
          onClick={() => setFilterRange('all')}
          className={`flex-1 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
            filterRange === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          All Rounds ({rounds.length})
        </button>
        <button
          onClick={() => setFilterRange('10')}
          className={`flex-1 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
            filterRange === '10' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          Last 10
        </button>
        <button
          onClick={() => setFilterRange('5')}
          className={`flex-1 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
            filterRange === '5' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          Last 5
        </button>
      </div>

      {rounds.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-gray-200 shadow-sm">
          <div className="w-14 h-14 bg-green-50 text-green-700 rounded-full flex items-center justify-center mx-auto text-2xl mb-3">
            📊
          </div>
          <h3 className="font-black text-lg text-gray-800 mb-1">No Rounds Recorded Yet</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto mb-5 leading-relaxed">
            Complete your first round of golf to generate career scoring averages, par breakdowns, and cross-round club gapping insights.
          </p>
          <button
            onClick={() => navigate('start')}
            className="bg-green-600 text-white font-black text-xs px-6 py-3 rounded-xl shadow-md hover:bg-green-700 transition"
          >
            + Start First Round
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key KPI Hero Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
              <span className="text-[10px] uppercase font-black tracking-wider text-gray-400 block mb-1">
                Scoring Average
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-gray-900">{scoringAverage}</span>
                <span className="text-xs text-gray-400 font-bold">shots</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
              <span className="text-[10px] uppercase font-black tracking-wider text-gray-400 block mb-1">
                Best Round
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-green-700">
                  {bestRound ? bestRound.totalScore : '--'}
                </span>
                {bestRound && userHcp !== null && (
                  <span className="text-xs font-bold text-gray-400">
                    (Net {bestRound.totalScore - userHcp})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Par Breakdown: Par 3s, Par 4s, Par 5s */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="font-black text-base text-gray-900 mb-1">Scoring by Par</h3>
            <p className="text-xs text-gray-400 mb-4">Your average strokes per hole type</p>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">
                  Par 3s
                </span>
                <span className="text-2xl font-black text-gray-800">{avgPar3}</span>
                <span className={`text-[10px] font-bold block mt-0.5 ${parseFloat(avgPar3) > 3 ? 'text-red-500' : 'text-green-600'}`}>
                  {avgPar3 !== '--' ? `${parseFloat(avgPar3) > 3 ? '+' : ''}${(parseFloat(avgPar3) - 3).toFixed(2)}` : ''}
                </span>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">
                  Par 4s
                </span>
                <span className="text-2xl font-black text-gray-800">{avgPar4}</span>
                <span className={`text-[10px] font-bold block mt-0.5 ${parseFloat(avgPar4) > 4 ? 'text-red-500' : 'text-green-600'}`}>
                  {avgPar4 !== '--' ? `${parseFloat(avgPar4) > 4 ? '+' : ''}${(parseFloat(avgPar4) - 4).toFixed(2)}` : ''}
                </span>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">
                  Par 5s
                </span>
                <span className="text-2xl font-black text-gray-800">{avgPar5}</span>
                <span className={`text-[10px] font-bold block mt-0.5 ${parseFloat(avgPar5) > 5 ? 'text-red-500' : 'text-green-600'}`}>
                  {avgPar5 !== '--' ? `${parseFloat(avgPar5) > 5 ? '+' : ''}${(parseFloat(avgPar5) - 5).toFixed(2)}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Scoring Distribution */}
          {totalHolesAnalyzed > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <h3 className="font-black text-base text-gray-900 mb-1">Scoring Distribution</h3>
              <p className="text-xs text-gray-400 mb-4">{totalHolesAnalyzed} holes analyzed</p>

              {/* Progress Stack Bar */}
              <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex mb-4">
                {pct(birdiesCount + eaglesCount) > 0 && (
                  <div style={{ width: `${pct(birdiesCount + eaglesCount)}%` }} className="bg-yellow-400" title="Birdies+" />
                )}
                {pct(parsCount) > 0 && (
                  <div style={{ width: `${pct(parsCount)}%` }} className="bg-green-500" title="Pars" />
                )}
                {pct(bogeysCount) > 0 && (
                  <div style={{ width: `${pct(bogeysCount)}%` }} className="bg-orange-400" title="Bogeys" />
                )}
                {pct(doublesPlusCount) > 0 && (
                  <div style={{ width: `${pct(doublesPlusCount)}%` }} className="bg-red-500" title="Double+" />
                )}
              </div>

              <div className="grid grid-cols-4 gap-1 text-center">
                <div className="p-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block mb-1"></span>
                  <span className="text-[10px] font-black text-gray-400 block uppercase">Birdie+</span>
                  <span className="text-sm font-black text-gray-800">{pct(birdiesCount + eaglesCount)}%</span>
                </div>
                <div className="p-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block mb-1"></span>
                  <span className="text-[10px] font-black text-gray-400 block uppercase">Par</span>
                  <span className="text-sm font-black text-gray-800">{pct(parsCount)}%</span>
                </div>
                <div className="p-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block mb-1"></span>
                  <span className="text-[10px] font-black text-gray-400 block uppercase">Bogey</span>
                  <span className="text-sm font-black text-gray-800">{pct(bogeysCount)}%</span>
                </div>
                <div className="p-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block mb-1"></span>
                  <span className="text-[10px] font-black text-gray-400 block uppercase">Double+</span>
                  <span className="text-sm font-black text-gray-800">{pct(doublesPlusCount)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Cross-Round Club Dispersion / True Averages */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="font-black text-base text-gray-900 mb-1">True Club Yardages</h3>
            <p className="text-xs text-gray-400 mb-5">
              Stock target yardage vs. your real shot carry across all rounds
            </p>

            {clubStats.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                No shot yardages logged yet. Track shots during rounds to unlock club averages.
              </p>
            ) : (
              <div className="space-y-4">
                {clubStats.map(club => {
                  const hasActual = club.actual !== null;
                  const diff = hasActual ? club.actual - club.stock : null;

                  return (
                    <div key={club.name} className="relative">
                      <div className="flex justify-between text-xs mb-1 font-bold">
                        <span className="text-gray-800">{club.name}</span>
                        {hasActual ? (
                          <span className={diff >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {club.actual}y actual ({diff > 0 ? `+${diff}` : diff}y vs {club.stock}y) • {club.count} shots
                          </span>
                        ) : (
                          <span className="text-gray-400">Target: {club.stock}y (No shots logged)</span>
                        )}
                      </div>
                      <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden relative">
                        {/* Target Stock Line */}
                        <div
                          className="absolute top-0 bottom-0 border-l-2 border-dashed border-gray-600 z-10"
                          style={{ left: `${Math.min(100, (club.stock / 300) * 100)}%` }}
                        ></div>
                        {hasActual && (
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              diff >= 0 ? 'bg-green-500' : 'bg-orange-400'
                            }`}
                            style={{ width: `${Math.min(100, (club.actual / 300) * 100)}%` }}
                          ></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Round History List */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-black text-sm text-gray-900 uppercase tracking-wider">Round History</h3>
              <span className="text-xs text-gray-400 font-bold">{activeRounds.length} Rounds</span>
            </div>
            <div className="divide-y divide-gray-100">
              {activeRounds.map(r => (
                <div
                  key={r.id}
                  onClick={() => navigate('analysis', r.id)}
                  className="p-4 flex justify-between items-center hover:bg-gray-50 transition cursor-pointer"
                >
                  <div>
                    <h4 className="font-bold text-sm text-gray-800">{r.courseName}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">{r.date || 'Recent'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-gray-900 block">{r.totalScore}</span>
                    {userHcp !== null ? (
                      <span className="text-[10px] font-bold text-green-700">Net {r.totalScore - userHcp}</span>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-bold">Gross</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
