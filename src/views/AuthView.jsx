import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';

export default function AuthView({ onGuestMode }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration extra fields
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [handicap, setHandicap] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  const clearMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotSuccess('');
    setForgotError('');

    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: window.location.origin,
      });

      if (error) throw error;
      setForgotSuccess('Password reset link sent! Please check your email inbox.');
    } catch (err) {
      setForgotError(err.message || 'Failed to send reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      // Session will be caught by onAuthStateChange in App.jsx
    } catch (err) {
      setErrorMsg(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!username.trim()) {
      setErrorMsg('Please choose a username.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    const trimmedHcp = handicap.trim();
    const parsedHandicap = trimmedHcp !== '' && !isNaN(parseFloat(trimmedHcp)) ? parseFloat(trimmedHcp) : null;

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.trim(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            handicap: parsedHandicap,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        setSuccessMsg('Account created successfully.');
      } else {
        setSuccessMsg('Account registered! Please check your email to confirm your account before signing in.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen flex flex-col justify-between">
      <div>
        {/* Brand Header */}
        <div className="text-center mt-6 mb-8">
          <div className="w-16 h-16 bg-green-700 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-green-700/20 text-3xl">
            ⛳
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Golf Notes</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Log shots, measure yardages & track rounds</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-200 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => { setMode('signin'); clearMessages(); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'signin' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-800'
              }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); clearMessages(); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'register' ? 'bg-white text-green-700 shadow' : 'text-gray-500 hover:text-gray-800'
              }`}
          >
            Create Account
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-sm font-medium mb-4 animate-in fade-in flex items-start gap-2">
            <span className="text-base leading-none">⚠️</span>
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-3.5 rounded-xl text-sm font-medium mb-4 animate-in fade-in flex items-start gap-2">
            <span className="text-base leading-none">✅</span>
            <div className="flex-1">{successMsg}</div>
          </div>
        )}

        {/* Auth Forms */}
        {mode === 'signin' ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <input
                  required
                  type="email"
                  placeholder="golfer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3.5 pl-11 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 font-medium text-gray-800 shadow-sm"
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icons.Mail />
                </div>
              </div>
            </div>

            <div>
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3.5 pl-11 pr-11 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 font-medium text-gray-800 shadow-sm"
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icons.Lock />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider">Password *</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email || '');
                    setForgotSuccess('');
                    setForgotError('');
                    setShowForgotModal(true);
                  }}
                  className="text-[11px] font-bold text-green-700 hover:text-green-800"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-bold py-4 rounded-xl shadow-md transition duration-150 disabled:opacity-60 flex justify-center items-center gap-2 mt-2"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">Email Address *</label>
              <div className="relative">
                <input
                  required
                  type="email"
                  placeholder="golfer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3.5 pl-11 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 font-medium text-gray-800 shadow-sm"
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icons.Mail />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">Password *</label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3.5 pl-11 pr-11 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 font-medium text-gray-800 shadow-sm"
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icons.Lock />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">First Name</label>
                <input
                  type="text"
                  placeholder="Tiger"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full p-3.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-green-600 font-medium text-gray-800 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">Last Name</label>
                <input
                  type="text"
                  placeholder="Woods"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full p-3.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-green-600 font-medium text-gray-800 shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">Username *</label>
                <input
                  required
                  type="text"
                  placeholder="FairwayKing"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-3.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-green-600 font-medium text-gray-800 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">Handicap (Optional)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 14.0"
                  value={handicap}
                  onChange={(e) => setHandicap(e.target.value)}
                  className="w-full p-3.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-green-600 font-medium text-gray-800 shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-bold py-4 rounded-xl shadow-md transition duration-150 disabled:opacity-60 flex justify-center items-center gap-2 mt-2"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        )}
      </div>

      {/* Guest / Offline Access Option */}
      <div className="mt-8 text-center border-t border-gray-200 pt-5">
        <p className="text-xs text-gray-400 mb-2">Want to try the app without logging in?</p>
        <button
          type="button"
          onClick={onGuestMode}
          className="text-sm font-bold text-gray-700 hover:text-green-700 bg-white border border-gray-200 px-5 py-2.5 rounded-full shadow-sm hover:border-gray-300 transition"
        >
          Continue as Guest (Demo Mode) →
        </button>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleForgotPassword}
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h3 className="text-xl font-black text-gray-900">Reset Password</h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Enter your email address and we'll send you a secure link to reset your account password.
            </p>

            {forgotSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
                {forgotSuccess}
              </div>
            )}
            {forgotError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
                ⚠️ {forgotError}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <input
                  required
                  type="email"
                  placeholder="golfer@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full p-3.5 pl-11 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-600 font-medium text-sm"
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icons.Mail />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={forgotLoading || !forgotEmail.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition flex justify-center items-center gap-2"
              >
                {forgotLoading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
