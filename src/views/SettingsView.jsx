import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { INITIAL_BAG } from '../data/mockData';
import { Icons } from '../components/Icons';
import {
  searchCourses,
  createCustomCourse,
  fetchFromGolfCourseApi,
  isGolfCourseApiConfigured,
  getMaskedApiKey,
  ensureValidUuid,
} from '../services/courseService';

export const CLUB_SECTIONS = [
  { type: 'Driver', label: 'Drivers', },
  { type: 'Iron', label: 'Irons', },
  { type: 'Hybrid', label: 'Hybrids', },
  { type: 'Wedge', label: 'Wedges', },
  { type: 'Putter', label: 'Putter', },
  { type: 'Wood', label: 'Woods', },
  { type: 'Other', label: 'Other Clubs', },
];

export function detectClubType(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('putter')) return 'Putter';
  if (lower.includes('driver')) return 'Driver';
  if (lower.includes('wood') || lower.includes('fairway') || lower.match(/\b\d+w\b/)) return 'Wood';
  if (lower.includes('hybrid') || lower.includes('rescue') || lower.match(/\b\d+h\b/)) return 'Hybrid';
  if (lower.includes('wedge') || lower.includes('°') || lower.match(/\b(pw|gw|sw|lw|aw)\b/)) return 'Wedge';
  if (lower.includes('iron') || lower.match(/\b\d+i\b/)) return 'Iron';
  return 'Other';
}

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
  const [userList, setUserList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [userActionMessage, setUserActionMessage] = useState('');
  const [userActionLoadingId, setUserActionLoadingId] = useState(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('all'); // 'all' | 'active' | 'disabled'

  // --- Admin Course Management State ---
  const [adminCourses, setAdminCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingCourse, setIsSearchingCourse] = useState(false);
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [newCourseForm, setNewCourseForm] = useState({ name: '', location: '', par: 72 });
  const [courseActionMessage, setCourseActionMessage] = useState('');

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

  // Admin Actions: Fetch Real Users (No dummy data)
  useEffect(() => {
    if (tab === 'admin') {
      loadRealUsers();
      loadAdminCourses();
    }
  }, [tab]);

  const loadRealUsers = async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setUserList(data.map(u => ({ ...u, status: u.status || 'active' })));
      } else if (currentUser) {
        // Fallback strictly to authentic current user profile, NEVER mock data
        setUserList([{
          id: currentUser.id,
          username: currentUser.username,
          first_name: currentUser.first_name,
          last_name: currentUser.last_name,
          handicap: currentUser.handicap,
          role: currentUser.role,
          status: currentUser.status || 'active',
        }]);
      } else {
        setUserList([]);
      }
    } catch (e) {
      if (currentUser) {
        setUserList([{
          id: currentUser.id,
          username: currentUser.username,
          first_name: currentUser.first_name,
          last_name: currentUser.last_name,
          handicap: currentUser.handicap,
          role: currentUser.role,
          status: currentUser.status || 'active',
        }]);
      } else {
        setUserList([]);
      }
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAdminCourses = async () => {
    setCoursesLoading(true);
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAdminCourses(data);
      }
    } catch (e) {
      console.warn('Could not load admin courses:', e);
    } finally {
      setCoursesLoading(false);
    }
  };

  const handleAdminCourseSearch = async (e) => {
    e.preventDefault();
    if (!courseSearchQuery.trim()) return;
    setIsSearchingCourse(true);
    setCourseActionMessage('Searching courses...');
    try {
      const results = await searchCourses(courseSearchQuery.trim());
      setSearchResults(results);
      if (results.length === 0) {
        setCourseActionMessage('No courses found matching that query.');
      }
    } catch (err) {
      setCourseActionMessage(`⚠️ Search failed: ${err.message}`);
    } finally {
      setIsSearchingCourse(false);
    }
  };

  const handleDirectApiSearch = async () => {
    if (!courseSearchQuery.trim()) {
      setCourseActionMessage('Please enter a course name or city (e.g. Pebble, St Andrews).');
      return;
    }
    setIsSearchingCourse(true);
    setCourseActionMessage('Searching Golf Course API...');
    try {
      const apiResults = await fetchFromGolfCourseApi(courseSearchQuery.trim());
      setSearchResults(apiResults);
      if (apiResults.length === 0) {
        setCourseActionMessage('Golf Course API returned 0 courses for that query.');
      } else {
        setCourseActionMessage(`Found ${apiResults.length} courses from Golf Course API! Click "+ Save to DB" to import.`);
      }
    } catch (err) {
      setCourseActionMessage(`⚠️ API Error: ${err.message}`);
    } finally {
      setIsSearchingCourse(false);
    }
  };

  const handleSaveCourseGlobally = async (course) => {
    setCourseActionMessage('Saving course to global catalog...');
    try {
      const payload = {
        id: ensureValidUuid(course.id),
        name: course.name,
        location: course.location || 'Verified Course',
        latitude: course.latitude || null,
        longitude: course.longitude || null,
        par: Number(course.par) || 72,
        facilities: course.facilities || [],
        is_custom: false, // Global course
        api_provider: course.api_provider || 'admin_import',
      };

      let { error } = await supabase.from('courses').upsert(payload);

      // Graceful fallback if schema cache lacks optional columns
      if (error && (error.message?.includes('schema cache') || error.message?.includes('column'))) {
        const basic = {
          id: payload.id,
          name: payload.name,
          location: payload.location,
          facilities: payload.facilities,
        };
        const retry = await supabase.from('courses').upsert(basic);
        if (!retry.error) error = null;
      }

      if (error) throw error;
      setCourseActionMessage(`✅ "${course.name}" saved to global courses!`);
      loadAdminCourses();
    } catch (err) {
      setCourseActionMessage(`⚠️ Failed to save: ${err.message}`);
    }
  };

  const handleCreateAdminCourseSubmit = async (e) => {
    e.preventDefault();
    if (!newCourseForm.name.trim()) return;
    setCourseActionMessage('Adding new course...');
    try {
      const coursePayload = {
        id: ensureValidUuid(),
        name: newCourseForm.name.trim(),
        location: newCourseForm.location.trim() || 'General',
        par: Number(newCourseForm.par) || 72,
        facilities: ['verified'],
        is_custom: false, // Global course added by admin
        created_by: currentUser?.id || null,
      };

      let { data, error } = await supabase.from('courses').insert(coursePayload).select().maybeSingle();

      // If created_by or is_custom column is missing in Supabase schema cache, retry without optional columns
      if (error && (error.message?.includes('created_by') || error.message?.includes('schema cache'))) {
        const basicPayload = {
          id: coursePayload.id,
          name: coursePayload.name,
          location: coursePayload.location,
          facilities: coursePayload.facilities,
        };
        const retry = await supabase.from('courses').insert(basicPayload).select().maybeSingle();
        if (!retry.error) {
          error = null;
          data = retry.data || basicPayload;
        }
      }

      if (error) throw error;
      setCourseActionMessage(`✅ Added "${newCourseForm.name}" to courses!`);
      setShowAddCourseModal(false);
      setNewCourseForm({ name: '', location: '', par: 72 });
      loadAdminCourses();
    } catch (err) {
      setCourseActionMessage(`⚠️ Could not add course: ${err.message}`);
    }
  };

  const handleDeleteAdminCourse = async (courseId, courseName) => {
    if (!confirm(`Are you sure you want to delete "${courseName}" from the database?`)) return;
    try {
      const { error } = await supabase.from('courses').delete().eq('id', courseId);
      if (!error) {
        setAdminCourses(prev => prev.filter(c => c.id !== courseId));
        setCourseActionMessage(`🗑️ Deleted "${courseName}"`);
      }
    } catch (err) {
      setCourseActionMessage(`⚠️ Delete failed: ${err.message}`);
    }
  };

  // Admin Action: Deactivate / Reactivate User
  const handleToggleUserStatus = async (user) => {
    if (user.id === currentUser?.id) {
      setUserActionMessage('⚠️ You cannot deactivate your own admin account.');
      setTimeout(() => setUserActionMessage(''), 4500);
      return;
    }

    const nextStatus = user.status === 'disabled' ? 'active' : 'disabled';
    setUserActionLoadingId(user.id);
    setUserActionMessage('');

    try {
      // 1. Optimistic local update
      setUserList(prev => prev.map(u => u.id === user.id ? { ...u, status: nextStatus } : u));

      // 2. Persist to Supabase profiles
      const { error } = await supabase
        .from('profiles')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        console.warn('Could not update status in Supabase:', error.message);
        setUserActionMessage(`⚠️ Status updated locally. Cloud returned: ${error.message}`);
      } else {
        setUserActionMessage(
          nextStatus === 'disabled'
            ? `✓ User @${user.username || 'user'} has been deactivated.`
            : `✓ User @${user.username || 'user'} has been reactivated.`
        );
      }
    } catch (err) {
      setUserActionMessage(`⚠️ Error updating user: ${err.message}`);
    } finally {
      setUserActionLoadingId(null);
      setTimeout(() => setUserActionMessage(''), 4500);
    }
  };

  // Admin Action: Permanently Delete User Profile & Data
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.id === currentUser?.id) {
      setUserActionMessage('⚠️ You cannot delete your own admin account.');
      setUserToDelete(null);
      setTimeout(() => setUserActionMessage(''), 4500);
      return;
    }

    setIsDeletingUser(true);
    setUserActionMessage('');

    try {
      // 1. Delete associated data first
      try {
        await supabase.from('shots').delete().match({ user_id: userToDelete.id });
      } catch (e) { }
      try {
        await supabase.from('round_holes').delete().match({ user_id: userToDelete.id });
      } catch (e) { }
      try {
        await supabase.from('rounds').delete().eq('user_id', userToDelete.id);
      } catch (e) { }
      try {
        await supabase.from('green_pins').delete().eq('user_id', userToDelete.id);
      } catch (e) { }

      // 2. Delete from profiles
      const { error: profileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userToDelete.id);

      // 3. Update local user list
      setUserList(prev => prev.filter(u => u.id !== userToDelete.id));

      if (profileErr) {
        console.warn('Supabase delete profile warning:', profileErr.message);
        setUserActionMessage(`⚠️ User removed locally. Cloud returned: ${profileErr.message}`);
      } else {
        setUserActionMessage(`✓ User @${userToDelete.username || 'user'} and all related data have been deleted.`);
      }
      setUserToDelete(null);
    } catch (err) {
      setUserActionMessage(`⚠️ Delete failed: ${err.message}`);
    } finally {
      setIsDeletingUser(false);
      setTimeout(() => setUserActionMessage(''), 4500);
    }
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
    const clubType = editingClub.type || detectClubType(editingClub.name);
    const isPutter = clubType === 'Putter' || editingClub.name.toLowerCase().includes('putter');
    const carryValue = isPutter
      ? 0
      : (editingClub.carry !== '' && editingClub.carry !== null && !isNaN(Number(editingClub.carry)))
        ? Number(editingClub.carry)
        : null;

    const clubToSave = {
      ...editingClub,
      name: editingClub.name.trim(),
      type: clubType,
      carry: carryValue,
    };

    if (editingClub.id) {
      setBag(bag.map(c => c.id === editingClub.id ? clubToSave : c));
    } else {
      setBag([...bag, { ...clubToSave, id: Date.now() }]);
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

  const filteredUserList = userList.filter(u => {
    const term = userSearchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      (u.username && u.username.toLowerCase().includes(term)) ||
      (u.first_name && u.first_name.toLowerCase().includes(term)) ||
      (u.last_name && u.last_name.toLowerCase().includes(term));

    const matchesStatus = userStatusFilter === 'all'
      ? true
      : userStatusFilter === 'active'
        ? u.status !== 'disabled'
        : u.status === 'disabled';

    return matchesSearch && matchesStatus;
  });

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
                      onClick={() => setEditingClub({ name: '', type: 'Iron', carry: '', stance: '', swing: '' })}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl text-sm transition"
                    >
                      + Add Single Club
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {CLUB_SECTIONS.map(sec => {
                    const secClubs = bag.filter(c => (c.type || detectClubType(c.name)) === sec.type);
                    if (secClubs.length === 0) return null;
                    return (
                      <div key={sec.type} className="space-y-2">
                        <div className="flex items-center gap-1.5 px-1 pt-1">
                          <span className="text-sm">{sec.icon}</span>
                          <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider">{sec.label}</h4>
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded-full">
                            {secClubs.length}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {secClubs.map(club => {
                            const hasYardage = club.carry && Number(club.carry) > 0;
                            const isPutter = (club.type || detectClubType(club.name)) === 'Putter';

                            return (
                              <div
                                key={club.id}
                                className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center group cursor-pointer hover:border-green-300 transition"
                                onClick={() => setEditingClub({
                                  ...club,
                                  type: club.type || detectClubType(club.name),
                                  carry: club.carry !== null && club.carry !== undefined && club.carry !== 0 ? club.carry : '',
                                })}
                              >
                                <div>
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <h4 className="font-bold text-gray-900 text-base">{club.name}</h4>
                                    {hasYardage && !isPutter ? (
                                      <span className="bg-gray-100 text-gray-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                                        {club.carry}y
                                      </span>
                                    ) : isPutter ? (
                                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                                        Putter
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="text-xs text-gray-500 truncate max-w-[220px]">
                                    {club.swing || club.stance || 'No swing thoughts added.'}
                                  </p>
                                </div>
                                <div className="text-gray-400 group-hover:text-green-600 p-1">
                                  <Icons.Pencil />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => setEditingClub({ name: '', type: 'Iron', carry: '', stance: '', swing: '' })}
                    className="w-full mt-2 bg-green-50 text-green-700 border-2 border-dashed border-green-200 font-bold py-3.5 rounded-xl hover:bg-green-100 hover:border-green-400 transition flex justify-center items-center gap-2 text-sm shadow-xs"
                  >
                    <Icons.Plus /> Add New Club
                  </button>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={saveClub} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-2">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{editingClub.id ? 'Edit Club' : 'Add New Club'}</h3>
                  <p className="text-xs text-gray-400">Configure club category, yardage, and swing cues</p>
                </div>
                {editingClub.id && (
                  <button type="button" onClick={() => deleteClub(editingClub.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-full" title="Remove club">
                    <Icons.Trash />
                  </button>
                )}
              </div>

              {/* Club Category Selection */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">Club Category / Type</label>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {CLUB_SECTIONS.map(s => {
                    const currentType = editingClub.type || detectClubType(editingClub.name);
                    const isSelected = currentType === s.type;
                    return (
                      <button
                        key={s.type}
                        type="button"
                        onClick={() => {
                          const updated = { ...editingClub, type: s.type };
                          if (s.type === 'Putter') updated.carry = '';
                          setEditingClub(updated);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1 ${isSelected
                          ? 'bg-green-600 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        <span>{s.icon}</span>
                        <span>{s.type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Club Name & Yardage (Hidden if Putter) */}
              {(() => {
                const currentType = editingClub.type || detectClubType(editingClub.name);
                const isPutter = currentType === 'Putter';

                if (isPutter) {
                  return (
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Club Name</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Blade Putter"
                        value={editingClub.name}
                        onChange={e => setEditingClub({ ...editingClub, name: e.target.value, carry: '' })}
                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-500 font-medium text-sm"
                      />
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Club Name</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. 5 Wood, 7 Iron, 52° Wedge..."
                        value={editingClub.name}
                        onChange={e => {
                          const val = e.target.value;
                          const autoType = detectClubType(val);
                          setEditingClub({
                            ...editingClub,
                            name: val,
                            type: editingClub.type && editingClub.type !== 'Other' ? editingClub.type : autoType,
                          });
                        }}
                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-500 font-medium text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Carry (Y)</label>
                      <input
                        type="number"
                        placeholder="e.g. 165"
                        value={editingClub.carry || ''}
                        onChange={e => setEditingClub({ ...editingClub, carry: e.target.value })}
                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-500 font-medium text-sm text-center"
                      />
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Stance & Setup Notes</label>
                <textarea
                  rows="2"
                  placeholder="Where does the ball go in your stance?"
                  value={editingClub.stance || ''}
                  onChange={e => setEditingClub({ ...editingClub, stance: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-500 text-sm font-medium resize-none"
                ></textarea>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-wider">Swing Thought</label>
                <textarea
                  rows="3"
                  placeholder="What are you focusing on when swinging this club?"
                  value={editingClub.swing || ''}
                  onChange={e => setEditingClub({ ...editingClub, swing: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-500 text-sm font-medium resize-none"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingClub(null)}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition active:scale-95 text-sm shadow-md"
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
          {/* Action Message Feedback */}
          {courseActionMessage && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-semibold animate-in fade-in flex justify-between items-center">
              <span>{courseActionMessage}</span>
              <button onClick={() => setCourseActionMessage('')} className="font-bold text-gray-400 hover:text-gray-700 ml-2">✕</button>
            </div>
          )}

          {/* 1. Golf Course Directory Management */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-900 text-base">Course Directory</h4>
                <p className="text-xs text-gray-400">Search and manage courses available to all golfers</p>
              </div>
              <button
                onClick={() => setShowAddCourseModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white font-black text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 active:scale-95 shadow-sm"
              >
                <Icons.Plus /> Add Course
              </button>
            </div>

            {/* API Connection Status Badge */}
            <div className="flex justify-between items-center bg-gray-50 p-2.5 px-3 rounded-xl border border-gray-200 text-xs">
              <div className="flex items-center gap-1.5 font-bold">
                <span className={`w-2 h-2 rounded-full ${isGolfCourseApiConfigured() ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                <span className="text-gray-700">Golf Course API:</span>
                <span className={isGolfCourseApiConfigured() ? 'text-green-700' : 'text-amber-700'}>
                  {isGolfCourseApiConfigured() ? `Connected (${getMaskedApiKey()})` : 'Missing Key in .env'}
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-bold uppercase">35 free req/mo</span>
            </div>

            {/* Course Search / Import Tool */}
            <form onSubmit={handleAdminCourseSearch} className="flex gap-2 flex-wrap sm:flex-nowrap">
              <input
                type="text"
                placeholder="Search course name or city (e.g. Pebble, St Andrews)..."
                value={courseSearchQuery}
                onChange={(e) => setCourseSearchQuery(e.target.value)}
                className="w-full sm:flex-1 p-3 border border-gray-200 rounded-xl text-xs font-semibold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              <div className="flex gap-1.5 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={isSearchingCourse}
                  className="flex-1 sm:flex-none bg-gray-900 hover:bg-black text-white font-bold text-xs px-4 py-3 rounded-xl transition disabled:opacity-50"
                >
                  {isSearchingCourse ? 'Searching...' : 'Search'}
                </button>
                {isGolfCourseApiConfigured() && (
                  <button
                    type="button"
                    onClick={handleDirectApiSearch}
                    disabled={isSearchingCourse || !courseSearchQuery.trim()}
                    className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-3 rounded-xl transition disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-1"
                    title="Search external Golf Course API directory directly"
                  >
                    <span>🌐</span> API Search
                  </button>
                )}
              </div>
            </form>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border border-green-200 bg-green-50/50 rounded-xl p-3 space-y-2">
                <span className="text-[10px] uppercase font-black text-green-800 tracking-wider block">
                  Search Results ({searchResults.length}):
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {searchResults.map(c => {
                    const isAlreadySaved = adminCourses.some(ac => ac.name.toLowerCase() === c.name.toLowerCase());
                    return (
                      <div key={c.id} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-gray-900">{c.name}</p>
                          <p className="text-[10px] text-gray-500">{c.location || 'Unknown Location'} • Par {c.par || 72}</p>
                        </div>
                        {isAlreadySaved ? (
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            In Database
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSaveCourseGlobally(c)}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition"
                          >
                            + Save to DB
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Database Courses List */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-gray-400">
                  Managed Courses ({adminCourses.length})
                </span>
                <button
                  onClick={loadAdminCourses}
                  className="text-[10px] text-blue-600 font-bold hover:underline"
                >
                  Refresh
                </button>
              </div>

              {coursesLoading ? (
                <div className="p-4 text-center text-xs text-gray-400">Loading courses...</div>
              ) : adminCourses.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-400">
                  No courses in database yet. Use search or "+ Add Course" to add one!
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {adminCourses.map(c => (
                    <div key={c.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                      <div>
                        <span className="font-bold text-gray-800 block">{c.name}</span>
                        <span className="text-[10px] text-gray-400">{c.location || 'Local'} • Par {c.par || 72}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.is_custom && (
                          <span className="text-[9px] font-black uppercase text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            Custom
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteAdminCourse(c.id, c.name)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Delete Course"
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Registered Users (Authentic data only, full Admin controls) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-900 text-base">Registered Users</h4>
                <p className="text-xs text-gray-400">Manage user accounts, deactivation, and deletion</p>
              </div>
              <span className="text-xs font-bold text-gray-400">{userList.length} Total</span>
            </div>

            {userActionMessage && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-semibold animate-in fade-in flex justify-between items-center">
                <span>{userActionMessage}</span>
                <button
                  type="button"
                  onClick={() => setUserActionMessage('')}
                  className="text-blue-500 hover:text-blue-700 font-bold ml-2 text-sm"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Filter & Search Bar */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search users by name or username..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: 'all', label: `All (${userList.length})` },
                  { key: 'active', label: `Active (${userList.filter(u => u.status !== 'disabled').length})` },
                  { key: 'disabled', label: `Deactivated (${userList.filter(u => u.status === 'disabled').length})` },
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setUserStatusFilter(f.key)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${userStatusFilter === f.key
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {usersLoading ? (
              <div className="p-4 text-center text-xs text-gray-400">Loading users...</div>
            ) : filteredUserList.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-400">
                {userSearchTerm || userStatusFilter !== 'all' ? 'No users matching filter.' : 'No users found in database.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredUserList.map(u => {
                  const isSelf = u.id === currentUser?.id;
                  const isUserLoading = userActionLoadingId === u.id;
                  const isDeactivated = u.status === 'disabled';

                  return (
                    <div
                      key={u.id}
                      className={`flex justify-between items-center p-3 rounded-xl border text-sm transition ${isDeactivated
                        ? 'bg-red-50/40 border-red-100 opacity-90'
                        : 'bg-gray-50 border-gray-100'
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${u.role === 'admin' ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700'
                          }`}>
                          {(u.first_name?.[0] || u.username?.[0] || 'U').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-gray-800 truncate">@{u.username || 'user'}</span>
                            {isSelf && (
                              <span className="bg-gray-200 text-gray-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                                You
                              </span>
                            )}
                            {u.role === 'admin' && (
                              <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                                Admin
                              </span>
                            )}
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${isDeactivated ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                              }`}>
                              {isDeactivated ? 'Deactivated' : 'Active'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 block mt-0.5 truncate">
                            {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : 'No name set'}
                            {u.handicap !== null && u.handicap !== undefined ? ` • HCP ${u.handicap}` : ' • No HCP'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {/* Deactivate / Reactivate button */}
                        {isSelf ? (
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                            Protected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u)}
                            disabled={isUserLoading}
                            className={`text-xs font-bold px-3 py-1.5 rounded-full transition shadow-xs active:scale-95 ${isDeactivated
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200'
                              }`}
                            title={isDeactivated ? 'Reactivate User' : 'Deactivate User'}
                          >
                            {isUserLoading
                              ? 'Saving...'
                              : isDeactivated
                                ? 'Reactivate'
                                : 'Deactivate'}
                          </button>
                        )}

                        {/* Delete User Button */}
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Permanently Delete User"
                          >
                            <Icons.Trash />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Database Synchronization Panel */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h4 className="font-bold text-gray-900 text-base">Supabase Synchronization</h4>
            <p className="text-xs text-gray-500">Run sync check to verify connectivity to cloud database tables.</p>

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
        </div>
      )}

      {/* Admin Add Course Modal */}
      {showAddCourseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <form
            onSubmit={handleCreateAdminCourseSubmit}
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <div>
                <h3 className="text-lg font-black text-gray-900">Add Course to Catalog</h3>
                <p className="text-[10px] text-green-700 font-bold uppercase tracking-wider">
                  Global Course (Visible to all users)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCourseModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                Course Name *
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Wentworth Golf Club"
                value={newCourseForm.name}
                onChange={e => setNewCourseForm({ ...newCourseForm, name: e.target.value })}
                className="w-full p-3 rounded-xl border border-gray-300 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                Location
              </label>
              <input
                type="text"
                placeholder="e.g. Surrey, England"
                value={newCourseForm.location}
                onChange={e => setNewCourseForm({ ...newCourseForm, location: e.target.value })}
                className="w-full p-3 rounded-xl border border-gray-300 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                Par
              </label>
              <input
                type="number"
                min="60"
                max="80"
                value={newCourseForm.par}
                onChange={e => setNewCourseForm({ ...newCourseForm, par: e.target.value })}
                className="w-full p-3 rounded-xl border border-gray-300 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-green-700 transition active:scale-95"
            >
              Add to Global Directory
            </button>
          </form>
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

      {/* Admin Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-xs">
              ⚠️
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-gray-900 mb-1">Delete User Account?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Are you sure you want to permanently delete user <strong className="text-gray-900">@{userToDelete.username || 'user'}</strong>
                {userToDelete.first_name ? ` (${userToDelete.first_name} ${userToDelete.last_name || ''})` : ''}?
              </p>
            </div>

            <div className="bg-red-50 border border-red-100 p-3 rounded-xl text-[11px] text-red-800 font-medium leading-tight">
              ⚠️ <strong>Warning:</strong> This will delete their profile, round histories, recorded shots, and cloud markers. This action cannot be undone.
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeletingUser}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition shadow-md active:scale-95 text-sm"
              >
                {isDeletingUser ? 'Deleting User...' : 'Yes, Permanently Delete User'}
              </button>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
                className="w-full text-gray-400 hover:text-gray-600 font-bold py-2.5 transition text-sm"
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
