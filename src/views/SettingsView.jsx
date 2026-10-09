import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MOCK_USERS_DB, INITIAL_BAG } from '../data/mockData';
import { Icons } from '../components/Icons';

export default function SettingsView({
  navigate,
  bag,
  setBag,
  currentUser,
  session,
  isGuest,
  onSignOut,
  onProfileUpdated,
  onSwitchToAuth,
}) {
  const [tab, setTab] = useState('profile');

  // --- Profile State ---
  const [firstName, setFirstName] = useState(currentUser?.first_name || currentUser?.firstName || '');
  const [lastName, setLastName] = useState(currentUser?.last_name || currentUser?.lastName || '');
  const [handicap, setHandicap] = useState(currentUser?.handicap !== null && currentUser?.handicap !== undefined ? currentUser.handicap.toString() : '');

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // --- Username State ---
  const [newUsername, setNewUsername] = useState(currentUser?.username || '');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // --- Email State ---
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');

  // --- Password State ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // --- Sign Out Confirmation ---
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // --- Admin State ---
  const [syncState, setSyncState] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [userList, setUserList] = useState(MOCK_USERS_DB);

  // --- My Bag State ---
  const [editingClub, setEditingClub] = useState(null);

  // Keep local form in sync if currentUser updates
  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.first_name || currentUser.firstName || '');
      setLastName(currentUser.last_name || currentUser.lastName || '');
      setNewUsername(currentUser.username || '');
      setHandicap(currentUser.handicap !== null && currentUser.handicap !== undefined ? currentUser.handicap.toString() : '');
    }
  }, [currentUser]);

  // Handle Username Update with Uniqueness Check
  const handleUsernameSave = async (e) => {
    e.preventDefault();
    setUsernameSuccess('');
    setUsernameError('');

    const cleaned = newUsername.trim().toLowerCase();
    if (!cleaned) {
      setUsernameError('Username cannot be empty.');
      return;
    }

    if (cleaned === (currentUser?.username || '').toLowerCase()) {
      setUsernameError('This is already your current username.');
      return;
    }

    // Format validation (letters, numbers, underscores)
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(cleaned)) {
      setUsernameError('Username must be 3-20 characters and contain only letters, numbers, hyphens, or underscores.');
      return;
    }

    setUsernameSaving(true);

    if (session?.user) {
      try {
        // Check uniqueness in Supabase profiles
        const { data: existing, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', cleaned)
          .neq('id', session.user.id)
          .maybeSingle();

        if (checkError) {
          console.warn('Username check warning:', checkError);
        }

        if (existing) {
          setUsernameError(`@${cleaned} is already taken. Please choose another username.`);
          setUsernameSaving(false);
          return;
        }

        // Update profiles table
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            username: cleaned,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.user.id);

        if (updateError) throw updateError;

        // Sync auth metadata
        await supabase.auth.updateUser({
          data: { username: cleaned },
        });

        if (onProfileUpdated) onProfileUpdated({ username: cleaned });
        setUsernameSuccess(`Username updated to @${cleaned}!`);
      } catch (err) {
        setUsernameError(err.message || 'Failed to update username.');
      } finally {
        setUsernameSaving(false);
      }
    } else {
      // Guest mode
      if (onProfileUpdated) onProfileUpdated({ username: cleaned });
      setUsernameSuccess(`Username updated to @${cleaned}!`);
      setUsernameSaving(false);
    }
  };

  // Handle Profile Save (Names & Handicap)
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');
    setProfileSaving(true);

    const trimmedHcp = handicap.trim();
    const parsedHandicap = trimmedHcp !== '' && !isNaN(parseFloat(trimmedHcp)) ? parseFloat(trimmedHcp) : null;

    const updatedData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      handicap: parsedHandicap,
    };

    if (session?.user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            ...updatedData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.user.id);

        if (error) throw error;

        // Also update auth user metadata
        await supabase.auth.updateUser({
          data: {
            first_name: updatedData.first_name,
            last_name: updatedData.last_name,
            handicap: updatedData.handicap,
          },
        });

        if (onProfileUpdated) onProfileUpdated(updatedData);
        setProfileSuccess('Profile saved successfully!');
      } catch (err) {
        setProfileError(err.message || 'Failed to update profile.');
      } finally {
        setProfileSaving(false);
      }
    } else {
      // Guest mode update
      if (onProfileUpdated) onProfileUpdated(updatedData);
      setProfileSuccess('Profile details saved (Guest session)!');
      setProfileSaving(false);
    }

    setTimeout(() => {
      setProfileSuccess('');
      setProfileError('');
    }, 4000);
  };

  // Handle Email Update
  const handleEmailSave = async (e) => {
    e.preventDefault();
    setEmailSuccess('');
    setEmailError('');

    if (isGuest || !session?.user) {
      setEmailError('Please create an account to configure a permanent email address.');
      return;
    }

    if (!newEmail || !newEmail.includes('@')) {
      setEmailError('Please provide a valid email address.');
      return;
    }

    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      setEmailSuccess('Confirmation link sent! Check your new email inbox to complete the update.');
      setNewEmail('');
    } catch (err) {
      setEmailError(err.message || 'Failed to update email address.');
    } finally {
      setEmailSaving(false);
    }
  };

  // Handle Password Update with Current Password Verification
  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (isGuest || !session?.user) {
      setPasswordError('Please create an account to change your password.');
      return;
    }

    if (!currentPassword) {
      setPasswordError('Please enter your existing password.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from your existing password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      // 1. Verify existing password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError('Existing password is incorrect. Please try again.');
        setPasswordSaving(false);
        return;
      }

      // 2. Existing password is valid - update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setPasswordSuccess('Password successfully updated!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Admin Actions
  const toggleUserStatus = (userId) => {
    setUserList(userList.map(u => u.id === userId ? { ...u, status: u.status === 'active' ? 'disabled' : 'active' } : u));
  };

  const runSimulatedSync = () => {
    setSyncState('syncing');
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setSyncState('done');
          return 100;
        }
        return p + 10;
      });
    }, 200);
  };

  // My Bag Handlers
  const saveClub = (e) => {
    e.preventDefault();
    if (editingClub.id) {
      setBag(bag.map(c => c.id === editingClub.id ? editingClub : c));
    } else {
      setBag([...bag, { ...editingClub, id: Date.now() }]);
    }
    setEditingClub(null);
  };

  const deleteClub = (id) => {
    if (confirm('Are you sure you want to remove this club from your bag?')) {
      setBag(bag.filter(c => c.id !== id));
      setEditingClub(null);
    }
  };

  const loadStarterBag = () => {
    setBag(INITIAL_BAG);
  };

  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || (currentUser?.username?.[0] || 'G').toUpperCase();
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  return (
    <div className="p-6 bg-gray-50 min-h-screen pb-28">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900">Settings</h2>
          <p className="text-xs font-semibold text-gray-400 mt-0.5">Manage your golfer account & equipment</p>
        </div>
        <button
          onClick={() => navigate('dashboard')}
          className="text-green-700 font-bold bg-green-50 hover:bg-green-100 px-4 py-2 rounded-full text-sm transition"
        >
          Done
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex space-x-2 bg-gray-200 p-1 rounded-xl mb-6 overflow-x-auto">
        <button
          onClick={() => setTab('profile')}
          className={`flex-1 min-w-[80px] font-bold py-2.5 rounded-lg text-sm transition-all ${tab === 'profile' ? 'bg-white text-gray-900 shadow' : 'text-gray-500'
            }`}
        >
          Profile
        </button>
        <button
          onClick={() => setTab('bag')}
          className={`flex-1 min-w-[80px] font-bold py-2.5 rounded-lg text-sm transition-all ${tab === 'bag' ? 'bg-white text-green-700 shadow' : 'text-gray-500'
            }`}
        >
          My Bag {bag?.length > 0 && `(${bag.length})`}
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab('admin')}
            className={`flex-1 min-w-[80px] font-bold py-2.5 rounded-lg text-sm transition-all ${tab === 'admin' ? 'bg-white text-blue-700 shadow' : 'text-gray-500'
              }`}
          >
            Admin
          </button>
        )}
      </div>

      {/* =========================================================================
          PROFILE TAB
      ========================================================================= */}
      {tab === 'profile' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Guest Mode Banner */}
          {isGuest && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="font-bold text-amber-900 text-sm">Guest Mode Active</h4>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    You are previewing without a cloud account. Create an account or sign in to permanently back up your scorecards, shots, and bag.
                  </p>
                  <button
                    onClick={onSwitchToAuth}
                    className="mt-3 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
                  >
                    Sign In or Register →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* User Profile Summary Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-green-700 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-sm">
                {initials}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">
                  {firstName || lastName ? `${firstName} ${lastName}`.trim() : (currentUser?.username ? `@${currentUser.username}` : 'Golfer')}
                </h3>
                <p className="text-xs text-gray-400 font-medium">{currentUser?.email || (isGuest ? 'Guest Golfer' : 'Member')}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block bg-green-50 text-green-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-green-200">
                {isAdmin ? 'Admin' : 'Golfer'}
              </span>
            </div>
          </div>

          {/* Form 1: Username & Golfer Handle (Unique Check) */}
          <form onSubmit={handleUsernameSave} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <div>
                <h4 className="font-bold text-gray-900 text-base">Golfer Handle</h4>
              </div>
              <span className="bg-gray-100 text-gray-600 text-xs font-mono px-2 py-1 rounded-md">
                {currentUser?.username || 'not_set'}
              </span>
            </div>

            {usernameSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
                {usernameSuccess}
              </div>
            )}
            {usernameError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
                ⚠️ {usernameError}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Change Username *</label>
              <div className="relative">
                <input
                  required
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="username"
                  className="w-full p-3 pl-8 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-600 font-medium text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={usernameSaving || !newUsername.trim() || newUsername.trim().toLowerCase() === (currentUser?.username || '').toLowerCase()}
              className="w-full bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition active:scale-[0.98] text-sm flex justify-center items-center gap-2"
            >
              {usernameSaving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Update Username'
              )}
            </button>
          </form>

          {/* Form 2: Personal Profile Info & Handicap */}
          <form onSubmit={handleProfileSave} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h4 className="font-bold text-gray-900 text-base">Player Details</h4>
              <span className="text-[11px] font-semibold text-gray-400">Name & Handicap</span>
            </div>

            {profileSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
                {profileSuccess}
              </div>
            )}
            {profileError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
                ⚠️ {profileError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your First Name"
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-600 font-medium text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Your Last Name"
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-600 font-medium text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">Handicap Index (Optional)</label>
                {handicap && (
                  <button
                    type="button"
                    onClick={() => setHandicap('')}
                    className="text-[10px] text-red-500 font-bold hover:underline"
                  >
                    Clear Handicap
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.1"
                value={handicap}
                onChange={(e) => setHandicap(e.target.value)}
                placeholder="e.g. 14.2"
                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-600 font-medium text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={profileSaving}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition active:scale-[0.98] text-sm flex justify-center items-center gap-2"
            >
              {profileSaving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Save Player Details'
              )}
            </button>
          </form>

          {/* Form 3: Account Email Update */}
          <form onSubmit={handleEmailSave} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h4 className="font-bold text-gray-900 text-base">Account Email</h4>
              <span className="text-[11px] font-semibold text-gray-400">Login & Notifications</span>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-black uppercase text-gray-400 block mb-0.5">Current Email</span>
              <span className="text-sm font-semibold text-gray-800">{currentUser?.email || 'None'}</span>
            </div>

            {emailSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
                {emailSuccess}
              </div>
            )}
            {emailError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
                ⚠️ {emailError}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">New Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="newemail@example.com"
                  disabled={isGuest}
                  className="w-full p-3 pl-10 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-600 font-medium text-sm disabled:opacity-50"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icons.Mail />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={emailSaving || isGuest || !newEmail}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition active:scale-[0.98] text-sm flex justify-center items-center gap-2"
            >
              {emailSaving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Update Email Address'
              )}
            </button>
          </form>

          {/* Form 4: Password Update */}
          <form onSubmit={handlePasswordSave} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h4 className="font-bold text-gray-900 text-base">Security & Password</h4>
              <span className="text-[11px] font-semibold text-gray-400">Update Credentials</span>
            </div>

            {passwordSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
                {passwordSuccess}
              </div>
            )}
            {passwordError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
                ⚠️ {passwordError}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Existing Password *</label>
              <div className="relative">
                <input
                  required
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter existing password"
                  disabled={isGuest}
                  className="w-full p-3 pl-10 pr-10 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-600 font-medium text-sm disabled:opacity-50"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icons.Lock />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">New Password *</label>
              <div className="relative">
                <input
                  required
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  disabled={isGuest}
                  className="w-full p-3 pl-10 pr-10 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-600 font-medium text-sm disabled:opacity-50"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icons.Lock />
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Confirm New Password *</label>
              <div className="relative">
                <input
                  required
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  disabled={isGuest}
                  className="w-full p-3 pl-10 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-600 font-medium text-sm disabled:opacity-50"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Icons.Lock />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={passwordSaving || isGuest || !currentPassword || !newPassword || !confirmPassword}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition active:scale-[0.98] text-sm flex justify-center items-center gap-2"
            >
              {passwordSaving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Save New Password'
              )}
            </button>
          </form>

          {/* Account Actions / Sign Out */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowSignOutConfirm(true)}
              className="w-full bg-white text-red-600 hover:bg-red-50 border border-red-200 font-bold py-3.5 rounded-xl transition shadow-sm text-sm flex items-center justify-center gap-2"
            >
              <Icons.LogOut />
              {isGuest ? 'Exit Guest Mode' : 'Sign Out of Account'}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MY BAG TAB
      ========================================================================= */}
      {tab === 'bag' && (
        <div className="space-y-4 animate-in fade-in">
          {!editingClub ? (
            <>
              <div className="flex justify-between items-center mb-2">
                <p className="text-gray-500 text-sm font-medium">Manage your clubs, yardages, and swing notes.</p>
              </div>

              {/* Empty Bag State */}
              {bag.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-200 text-center space-y-4">
                  <div className="w-16 h-16 bg-green-50 text-green-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                    🎒
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 text-lg">Your Bag is Empty</h4>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                      Add your custom clubs and carry distances, or load a standard starter set to get going right away.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 pt-2 max-w-xs mx-auto">
                    <button
                      onClick={loadStarterBag}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm transition shadow-sm"
                    >
                      Load Standard Starter Bag
                    </button>
                    <button
                      onClick={() => setEditingClub({ name: '', carry: '', stance: '', swing: '' })}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl text-sm transition"
                    >
                      + Add Single Club
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {bag.map(club => (
                    <div
                      key={club.id}
                      className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center group cursor-pointer hover:border-green-300 transition"
                      onClick={() => setEditingClub(club)}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-900 text-lg">{club.name}</h4>
                          <span className="bg-gray-100 text-gray-600 text-[10px] font-black px-2 py-0.5 rounded-full">{club.carry}y</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate max-w-[200px]">{club.swing || 'No swing thoughts added.'}</p>
                      </div>
                      <div className="text-gray-400 group-hover:text-green-600">
                        <Icons.Pencil />
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => setEditingClub({ name: '', carry: '', stance: '', swing: '' })}
                    className="w-full mt-4 bg-green-50 text-green-700 border-2 border-dashed border-green-200 font-bold py-4 rounded-xl hover:bg-green-100 hover:border-green-400 transition flex justify-center items-center gap-2"
                  >
                    <Icons.Plus /> Add New Club
                  </button>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={saveClub} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-2">
                <h3 className="font-bold text-gray-900 text-lg">{editingClub.id ? 'Edit Club' : 'Add New Club'}</h3>
                {editingClub.id && (
                  <button type="button" onClick={() => deleteClub(editingClub.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-full">
                    <Icons.Trash />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Club Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 5-Wood"
                    value={editingClub.name}
                    onChange={e => setEditingClub({ ...editingClub, name: e.target.value })}
                    className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Carry (y)</label>
                  <input
                    required
                    type="number"
                    placeholder="200"
                    value={editingClub.carry}
                    onChange={e => setEditingClub({ ...editingClub, carry: e.target.value })}
                    className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Stance & Setup Notes</label>
                <textarea
                  rows="2"
                  placeholder="Where does the ball go in your stance?"
                  value={editingClub.stance}
                  onChange={e => setEditingClub({ ...editingClub, stance: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-500 text-sm font-medium resize-none"
                ></textarea>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Swing Thought</label>
                <textarea
                  rows="3"
                  placeholder="What are you focusing on when swinging this club?"
                  value={editingClub.swing}
                  onChange={e => setEditingClub({ ...editingClub, swing: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-500 text-sm font-medium resize-none"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingClub(null)}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition active:scale-95"
                >
                  Save Club
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* =========================================================================
          ADMIN TAB (Visible strictly to role === 'admin')
      ========================================================================= */}
      {tab === 'admin' && isAdmin && (
        <div className="space-y-6 animate-in fade-in">
          {/* Simulated Cloud Sync Panel */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h4 className="font-bold text-gray-900 text-base">Supabase Synchronization</h4>
            <p className="text-xs text-gray-500">Run manual sync check to ensure all local rounds and clubs match Supabase tables.</p>

            {syncState === 'syncing' && (
              <div className="space-y-2">
                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full transition-all duration-200" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-xs text-blue-600 font-bold text-center">Syncing tables... {progress}%</p>
              </div>
            )}

            {syncState === 'done' && (
              <div className="bg-green-50 text-green-700 p-3 rounded-xl text-xs font-bold text-center">
                All cloud tables are synchronized!
              </div>
            )}

            <button
              onClick={runSimulatedSync}
              disabled={syncState === 'syncing'}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition text-sm"
            >
              Run Database Sync Test
            </button>
          </div>

          {/* User List Management */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h4 className="font-bold text-gray-900 text-base">Registered Users</h4>
            <div className="space-y-2.5">
              {userList.map(u => (
                <div key={u.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm">
                  <div>
                    <span className="font-bold text-gray-800">{u.username}</span>
                    <span className="text-xs text-gray-400 block">{u.firstName} {u.lastName} • HCP {u.handicap}</span>
                  </div>
                  <button
                    onClick={() => toggleUserStatus(u.id)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}
                  >
                    {u.status === 'active' ? 'Active' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-gray-900 mb-2">
              {isGuest ? 'Exit Guest Mode?' : 'Sign Out?'}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {isGuest
                ? 'You will be returned to the sign in / register screen.'
                : 'Are you sure you want to sign out of your account on this device?'}
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setShowSignOutConfirm(false);
                  onSignOut();
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition"
              >
                {isGuest ? 'Exit to Sign In' : 'Yes, Sign Out'}
              </button>
              <button
                onClick={() => setShowSignOutConfirm(false)}
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
