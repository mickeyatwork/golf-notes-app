import React, { useState, useEffect } from 'react';

// Supabase client & Mock Data
import { supabase } from './lib/supabase';
import { MOCK_USER, MOCK_PAST_ROUNDS } from './data/mockData';

// Views
import AuthView from './views/AuthView';
import Dashboard from './views/Dashboard';
import StartRound from './views/StartRound';
import ActiveHole from './views/ActiveHole';
import Analysis from './views/Analysis';
import AnalyticsDashboard from './views/AnalyticsDashboard';
import SettingsView from './views/SettingsView';
import { Icons } from './components/Icons';
import { saveCompletedRound, fetchUserRounds, deleteRound } from './services/roundService';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [activeRound, setActiveRound] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);

  // Authentication State
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Bag State (Persisted in LocalStorage per user session, starts empty for new users)
  const [bag, setBag] = useState(() => {
    try {
      const saved = localStorage.getItem('golf_notes_bag');
      if (saved !== null) return JSON.parse(saved);
    } catch (e) { }
    return []; // Blank bag for new users
  });

  // Recorded Rounds State (Starts empty for real users. Guest gets mock rounds to test)
  const [rounds, setRounds] = useState(() => {
    try {
      const saved = localStorage.getItem('golf_notes_rounds');
      if (saved !== null) return JSON.parse(saved);
    } catch (e) { }
    return []; // Blank for users
  });

  // Persist bag
  useEffect(() => {
    try {
      localStorage.setItem('golf_notes_bag', JSON.stringify(bag));
    } catch (e) { }
  }, [bag]);

  // Persist rounds
  useEffect(() => {
    try {
      localStorage.setItem('golf_notes_rounds', JSON.stringify(rounds));
    } catch (e) { }
  }, [rounds]);

  // Password Recovery State
  const [showPasswordRecoveryModal, setShowPasswordRecoveryModal] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [recoveryShowPassword, setRecoveryShowPassword] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  // Load user profile from Supabase profiles table
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch profile:', error.message);
      } else if (data) {
        setUserProfile(data);
      } else {
        // If profile row does not exist yet, attempt to create it
        const userMeta = session?.user?.user_metadata || {};
        const { data: created, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            username: userMeta.username || session?.user?.email?.split('@')[0],
            first_name: userMeta.first_name || '',
            last_name: userMeta.last_name || '',
            handicap: userMeta.handicap ? Number(userMeta.handicap) : null,
            role: userMeta.role || 'user',
          })
          .select()
          .maybeSingle();

        if (created && !insertError) {
          setUserProfile(created);
        }
      }
    } catch (err) {
      console.warn('Could not fetch profile:', err);
    }
  };

  useEffect(() => {
    // 1. Check current session on mount
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id);
        fetchUserRounds(initialSession.user.id).then(userRounds => {
          if (userRounds && userRounds.length > 0) setRounds(userRounds);
        });
      }
      setAuthLoading(false);
    }).catch(() => {
      setAuthLoading(false);
    });

    // 2. Subscribe to auth changes (sign in, sign out, token refresh, password recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordRecoveryModal(true);
      }
      if (newSession?.user) {
        setIsGuest(false);
        fetchProfile(newSession.user.id);
        fetchUserRounds(newSession.user.id).then(userRounds => {
          if (userRounds && userRounds.length > 0) setRounds(userRounds);
        });
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleCompletePasswordRecovery = async (e) => {
    e.preventDefault();
    setRecoverySuccess('');
    setRecoveryError('');

    if (recoveryPassword.length < 6) {
      setRecoveryError('Password must be at least 6 characters long.');
      return;
    }

    if (recoveryPassword !== recoveryConfirm) {
      setRecoveryError('Passwords do not match.');
      return;
    }

    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: recoveryPassword,
      });

      if (error) throw error;
      setRecoverySuccess('Password successfully updated! You are now logged in.');
      setTimeout(() => {
        setShowPasswordRecoveryModal(false);
        setRecoveryPassword('');
        setRecoveryConfirm('');
      }, 2000);
    } catch (err) {
      setRecoveryError(err.message || 'Failed to update password.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const navigate = (view, data = null) => {
    if (view === 'analysis') setAnalysisId(data);
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    setSession(null);
    setUserProfile(null);
    setIsGuest(false);
    setCurrentView('dashboard');
  };

  // Round management
  const handleUpdateRound = async (updatedRound) => {
    const canonicalRound = {
      ...updatedRound,
      id: ensureValidUuid(updatedRound.id),
    };
    setRounds(prev => {
      const filtered = prev.filter(r => r.id !== updatedRound.id && r.id !== canonicalRound.id);
      return [canonicalRound, ...filtered];
    });
    if (session?.user?.id) {
      await saveCompletedRound(canonicalRound, session.user.id);
      fetchUserRounds(session.user.id).then(setRounds);
    }
  };

  const handleDeleteRound = async (roundId) => {
    setRounds(prev => prev.filter(r => r.id !== roundId));
    if (session?.user?.id) {
      deleteRound(roundId, session.user.id);
    }
    if (analysisId === roundId) {
      navigate('dashboard');
    }
  };

  const handleFinishRound = async (completedRound) => {
    const canonicalRound = {
      ...completedRound,
      id: ensureValidUuid(completedRound.id),
    };
    // 1. Instant local/optimistic update (strictly de-duplicated)
    setRounds(prev => {
      const filtered = prev.filter(r =>
        r.id !== canonicalRound.id &&
        r.id !== completedRound.id &&
        !(r.courseName === canonicalRound.courseName && r.totalScore === canonicalRound.totalScore && r.date === canonicalRound.date)
      );
      return [canonicalRound, ...filtered];
    });
    setActiveRound(null);
    navigate('dashboard');

    // 2. Persist to Supabase if authenticated
    if (session?.user?.id) {
      const res = await saveCompletedRound(canonicalRound, session.user.id);
      if (res && res.success) {
        // Refresh rounds cleanly from database
        fetchUserRounds(session.user.id).then(setRounds);
      }
    }
  };

  // Loading screen while checking existing session
  if (authLoading) {
    return (
      <div className="bg-gray-900 min-h-screen flex justify-center items-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-bold text-sm tracking-wider uppercase">Loading Golf Notes...</p>
        </div>
      </div>
    );
  }

  // Active user data: strictly use authentic signed-in data, NEVER fake John Doe data
  const metadata = session?.user?.user_metadata || {};
  const currentUser = session?.user
    ? {
      id: session.user.id,
      email: session.user.email,
      username: userProfile?.username || metadata.username || session.user.email?.split('@')[0],
      first_name: userProfile?.first_name ?? (metadata.first_name || ''),
      last_name: userProfile?.last_name ?? (metadata.last_name || ''),
      handicap: userProfile?.handicap !== undefined && userProfile?.handicap !== null
        ? userProfile.handicap
        : (metadata.handicap !== undefined && metadata.handicap !== null && metadata.handicap !== ''
          ? Number(metadata.handicap)
          : null),
      role: (
        userProfile?.role ||
        metadata.role ||
        session?.user?.app_metadata?.role ||
        'user'
      ).toString().toLowerCase(),
      status: userProfile?.status || 'active',
    }
    : (isGuest
      ? { ...MOCK_USER }
      : null);

  // If in guest mode and rounds are empty, supply demo rounds for testing
  const displayedRounds = isGuest && rounds.length === 0 ? MOCK_PAST_ROUNDS : rounds;

  return (
    <div className="bg-gray-900 min-h-screen flex justify-center items-start font-sans text-gray-900">
      <div className="w-full max-w-md bg-white min-h-screen relative overflow-x-hidden shadow-2xl pb-20">

        {/* If not authenticated and not in guest mode, show Auth Screen */}
        {!session && !isGuest ? (
          <AuthView onGuestMode={() => setIsGuest(true)} />
        ) : currentUser?.status === 'disabled' && currentUser?.role !== 'admin' ? (
          <div className="p-8 text-center flex flex-col items-center justify-center min-h-[85vh] animate-in fade-in">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mb-4 shadow-sm">
              🚫
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">Account Deactivated</h2>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed max-w-xs">
              Your account has been deactivated by an administrator. Please reach out to your club administrator to regain access.
            </p>
            <button
              onClick={handleSignOut}
              className="bg-gray-900 hover:bg-black text-white font-bold py-3.5 px-8 rounded-xl text-sm transition shadow-md active:scale-95"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <>
            {/* Router Views */}
            {currentView === 'dashboard' && (
              <Dashboard
                navigate={navigate}
                activeRound={activeRound}
                setActiveRound={setActiveRound}
                currentUser={currentUser}
                rounds={displayedRounds}
                onDeleteRound={handleDeleteRound}
                onUpdateRound={handleUpdateRound}
              />
            )}
            {currentView === 'start' && (
              <StartRound
                navigate={navigate}
                setActiveRound={setActiveRound}
                currentUser={currentUser}
                rounds={displayedRounds}
                isGuest={isGuest}
              />
            )}
            {currentView === 'active' && (
              <ActiveHole
                navigate={navigate}
                activeRound={activeRound}
                setActiveRound={setActiveRound}
                bag={bag}
                currentUser={currentUser}
                onFinishRound={handleFinishRound}
              />
            )}
            {currentView === 'analysis' && (
              <Analysis
                navigate={navigate}
                roundId={analysisId}
                bag={bag}
                rounds={displayedRounds}
                onDeleteRound={handleDeleteRound}
                onUpdateRound={handleUpdateRound}
              />
            )}
            {currentView === 'analytics' && (
              <AnalyticsDashboard
                navigate={navigate}
                rounds={displayedRounds}
                bag={bag}
                currentUser={currentUser}
              />
            )}
            {currentView === 'settings' && (
              <SettingsView
                navigate={navigate}
                bag={bag}
                setBag={setBag}
                currentUser={currentUser}
                session={session}
                isGuest={isGuest}
                onSignOut={handleSignOut}
                onProfileUpdated={(updated) => {
                  setUserProfile(p => ({ ...p, ...updated }));
                }}
                onSwitchToAuth={() => setIsGuest(false)}
              />
            )}

            {/* Global Floating Action Button */}
            {(currentView === 'dashboard' || currentView === 'start' || currentView === 'analytics') && (
              <button
                onClick={() => navigate('settings')}
                className="fixed bottom-6 right-[calc(50%-10rem)] md:right-[calc(50%-13rem)] w-14 h-14 bg-gray-900 text-white rounded-full flex items-center justify-center shadow-xl border-4 border-white hover:bg-gray-800 transition z-50"
                aria-label="Settings"
              >
                <Icons.Settings />
              </button>
            )}
          </>
        )}

        {/* Password Recovery Modal (Triggered by clicking reset link in email) */}
        {showPasswordRecoveryModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <form
              onSubmit={handleCompletePasswordRecovery}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <h3 className="text-xl font-black text-gray-900">Choose New Password</h3>
                <button
                  type="button"
                  onClick={() => setShowPasswordRecoveryModal(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Welcome back! Enter a new secure password for your Golf Notes account below.
              </p>

              {recoverySuccess && (
                <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
                  {recoverySuccess}
                </div>
              )}
              {recoveryError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
                  ⚠️ {recoveryError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">New Password *</label>
                <div className="relative">
                  <input
                    required
                    type={recoveryShowPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={recoveryPassword}
                    onChange={(e) => setRecoveryPassword(e.target.value)}
                    className="w-full p-3.5 pl-11 pr-11 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-600 font-medium text-sm"
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icons.Lock />
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecoveryShowPassword(!recoveryShowPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {recoveryShowPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Confirm Password *</label>
                <div className="relative">
                  <input
                    required
                    type={recoveryShowPassword ? 'text' : 'password'}
                    placeholder="Re-type new password"
                    value={recoveryConfirm}
                    onChange={(e) => setRecoveryConfirm(e.target.value)}
                    className="w-full p-3.5 pl-11 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-600 font-medium text-sm"
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icons.Lock />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPasswordRecoveryModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recoveryLoading || !recoveryPassword}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition flex justify-center items-center gap-2"
                >
                  {recoveryLoading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    'Set Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
