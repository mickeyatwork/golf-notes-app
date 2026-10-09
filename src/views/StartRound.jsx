import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icons';
import {
  getMyPlayedCourses,
  searchCourses,
  createCustomCourse,
  searchCourseSuggestions,
  isGolfCourseApiConfigured,
  getFavoriteCourses,
  toggleFavoriteCourse,
} from '../services/courseService';
import { getCurrentPosition } from '../utils/geo';

export default function StartRound({
  navigate,
  setActiveRound,
  currentUser = null,
  rounds = [],
  isGuest = false,
}) {
  const [activeTab, setActiveTab] = useState('my_courses'); // 'my_courses' (default) | 'discover'
  const [myCourses, setMyCourses] = useState([]);
  const [discoverCourses, setDiscoverCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const favs = getFavoriteCourses(currentUser?.id);
      return new Set(favs.map(c => c.id));
    } catch (e) {
      return new Set();
    }
  });

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ buggy: false, range: false });
  const [userCoords, setUserCoords] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Course Selection & Tee Off Modal
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [guestCount, setGuestCount] = useState(0);

  // "+ Add Course" Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseLocation, setNewCourseLocation] = useState('');
  const [newCoursePar, setNewCoursePar] = useState(72);
  const [suggestions, setSuggestions] = useState([]);
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [addModalError, setAddModalError] = useState('');

  // 1. Initial Load: Load "My Courses" (Zero API calls, no dummy courses unless guest)
  // If no saved/played courses exist, auto-default to "Discover" tab for better UX
  useEffect(() => {
    let isMounted = true;
    const loadMyCourses = async () => {
      setIsLoading(true);
      try {
        const list = await getMyPlayedCourses(currentUser?.id, rounds, isGuest);
        if (isMounted) {
          setMyCourses(list);
          if (list.length === 0) {
            setActiveTab('discover');
          }
        }
      } catch (err) {
        console.warn('Failed loading my courses:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadMyCourses();
    return () => { isMounted = false; };
  }, [currentUser?.id, rounds, isGuest]);

  // 2. Discover Tab Search (Debounced, Supabase cache-first + Golf Course API)
  useEffect(() => {
    if (activeTab !== 'discover') return;
    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchCourses(searchTerm, userCoords, currentUser?.id, isGuest);
        if (isMounted) setDiscoverCourses(results);
      } catch (err) {
        console.warn('Discover courses failed:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      isMounted = false;
    };
  }, [activeTab, searchTerm, userCoords, currentUser?.id, isGuest]);

  // Handle GPS location click
  const handleGetLocation = async () => {
    setIsLocating(true);
    setLocationError('');
    try {
      const pos = await getCurrentPosition();
      setUserCoords(pos);
      // Trigger instant refresh with new coords
      const results = await searchCourses(searchTerm, pos, currentUser?.id, isGuest);
      setDiscoverCourses(results);
    } catch (err) {
      setLocationError(err.message || 'Unable to retrieve GPS location.');
    } finally {
      setIsLocating(false);
    }
  };

  const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

  // Autocomplete suggestion fetch for custom course modal
  useEffect(() => {
    if (!showAddModal || newCourseName.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const matches = await searchCourseSuggestions(newCourseName);
        setSuggestions(matches);
      } catch (e) {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newCourseName, showAddModal]);

  // Apply suggestion to form
  const handleSelectSuggestion = (sug) => {
    setNewCourseName(sug.name);
    setNewCourseLocation(sug.location || '');
    if (sug.par) setNewCoursePar(sug.par);
    setSuggestions([]);
  };

  // Submit custom course
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourseName.trim()) {
      setAddModalError('Course name is required.');
      return;
    }
    setIsSavingCustom(true);
    setAddModalError('');
    try {
      const created = await createCustomCourse({
        name: newCourseName,
        location: newCourseLocation,
        par: newCoursePar,
      }, currentUser?.id);

      // Add to lists
      setMyCourses(prev => [created, ...prev]);
      setDiscoverCourses(prev => [created, ...prev]);
      setShowAddModal(false);
      setNewCourseName('');
      setNewCourseLocation('');
      setNewCoursePar(72);
      setSelectedCourse(created); // Immediately open tee-off modal for convenience
    } catch (err) {
      setAddModalError(err.message || 'Could not save course.');
    } finally {
      setIsSavingCustom(false);
    }
  };

  const handleTeeOff = () => {
    if (!selectedCourse) return;
    setActiveRound({
      id: `r_${Date.now()}`,
      courseId: selectedCourse.id,
      courseName: selectedCourse.name,
      courseLocation: selectedCourse.location,
      par: selectedCourse.par || 72,
      currentHole: 1,
      guestCount,
      dateStarted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    navigate('active');
  };

  const handleToggleFavorite = async (course, e) => {
    e.stopPropagation();
    const updated = toggleFavoriteCourse(course, currentUser?.id);
    setFavoriteIds(new Set(updated.map(c => c.id)));
    try {
      const refreshed = await getMyPlayedCourses(currentUser?.id, rounds, isGuest);
      setMyCourses(refreshed);
    } catch (err) {
      console.warn('Could not refresh courses after starring:', err);
    }
  };

  // Active courses based on tab and filters
  const currentList = activeTab === 'my_courses' ? myCourses : discoverCourses;
  const filteredCourses = currentList.filter(c => {
    const matchesSearch = activeTab === 'my_courses'
      ? c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.location && c.location.toLowerCase().includes(searchTerm.toLowerCase()))
      : true; // In discover, search is handled in service
    const matchesBuggy = !filters.buggy || (c.facilities && c.facilities.includes('buggy'));
    const matchesRange = !filters.range || (c.facilities && c.facilities.includes('range'));
    return matchesSearch && matchesBuggy && matchesRange;
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen relative pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center">
          <button
            onClick={() => navigate('dashboard')}
            className="text-gray-500 font-bold mr-3 text-sm hover:text-gray-900 transition"
          >
            ← Back
          </button>
          <h2 className="text-2xl font-black text-gray-900">Select Course</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-green-50 text-green-700 hover:bg-green-100 font-black text-xs px-3 py-2 rounded-xl border border-green-200 transition flex items-center gap-1 active:scale-95"
        >
          <Icons.Plus /> Add Course
        </button>
      </div>

      {/* Segmented Tab Switch (My Courses vs Discover) */}
      <div className="bg-gray-200 p-1 rounded-2xl flex mb-4">
        <button
          onClick={() => setActiveTab('my_courses')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${activeTab === 'my_courses'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-800'
            }`}
        >
          ⛳ My Courses ({myCourses.length})
        </button>
        <button
          onClick={() => setActiveTab('discover')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${activeTab === 'discover'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-800'
            }`}
        >
          🔍 Discover Courses
        </button>
      </div>

      {/* Discover Options: GPS Location Button */}
      {activeTab === 'discover' && (
        <div className="mb-4">
          <button
            onClick={handleGetLocation}
            disabled={isLocating}
            className={`w-full py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition ${userCoords
              ? 'bg-green-50 border-green-300 text-green-800'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
          >
            <Icons.Compass />
            {isLocating
              ? 'Locating via GPS...'
              : userCoords
                ? 'GPS Active • Sorted by Distance'
                : 'Find Courses Near Me (GPS)'}
          </button>
          {locationError && (
            <p className="text-xs text-red-600 mt-1 font-semibold text-center">{locationError}</p>
          )}
        </div>
      )}

      {/* Golf Course API indicator in Discover mode */}
      {activeTab === 'discover' && isGolfCourseApiConfigured() && (
        <div className="flex items-center justify-between bg-blue-50/70 border border-blue-100 px-3 py-2 rounded-xl mb-3 text-[11px] text-blue-900 font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Golf Course API Connected
          </span>
          <span className="text-[10px] text-blue-600 font-bold">Type 3+ letters to search online</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative mb-3">
        <input
          type="text"
          placeholder={activeTab === 'my_courses' ? 'Filter my courses...' : isGolfCourseApiConfigured() ? 'Search courses...' : 'Search course name or city...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3.5 pl-11 rounded-xl border border-gray-200 shadow-sm text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-600 bg-white"
        />
        <div className="absolute left-3.5 top-3.5 text-gray-400">
          <Icons.Search />
        </div>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 text-sm font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Badges */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        <button
          onClick={() => toggleFilter('buggy')}
          className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition ${filters.buggy ? 'bg-green-100 border-green-600 text-green-800' : 'bg-white border-gray-200 text-gray-500'
            }`}
        >
          {filters.buggy && <Icons.Check />} 🛒 Buggy Hire
        </button>
        <button
          onClick={() => toggleFilter('range')}
          className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition ${filters.range ? 'bg-green-100 border-green-600 text-green-800' : 'bg-white border-gray-200 text-gray-500'
            }`}
        >
          {filters.range && <Icons.Check />} 🎯 Driving Range
        </button>
      </div>

      {/* Course List */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
          <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Loading Courses...</p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 shadow-sm">
          <p className="text-3xl mb-2">⛳</p>
          <h4 className="font-bold text-gray-800 text-base mb-1">
            {activeTab === 'my_courses' ? 'No Saved Courses Yet' : 'No Courses Found'}
          </h4>
          <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto leading-relaxed">
            {activeTab === 'my_courses'
              ? 'Courses you play will automatically appear here. You can also add your home course manually!'
              : 'Try a different search term or add your home course manually.'}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-sm hover:bg-green-700 transition"
          >
            + Add Custom Course
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCourses.map(course => {
            const isFav = favoriteIds.has(course.id) || course.is_favorite;
            return (
              <div
                key={course.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCourse(course)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedCourse(course); }}
                className="w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-200 text-left flex justify-between items-center hover:border-green-500 transition active:scale-[0.99] group cursor-pointer"
              >
                <div className="flex-1 pr-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-gray-900 group-hover:text-green-700 transition">
                      {course.name}
                    </span>
                    {isFav && (
                      <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-200 flex items-center gap-1">
                        ★ Favorited
                      </span>
                    )}
                    {course.is_custom && (
                      <span className="bg-purple-50 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-purple-200">
                        My Course
                      </span>
                    )}
                    {course.playedCount > 0 && (
                      <span className="bg-green-50 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-green-200">
                        Played {course.playedCount}x
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Icons.MapPin /> {course.location || 'Local Course'}
                    </span>
                    {course.distance && (
                      <span className="font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        {course.distance}
                      </span>
                    )}
                    <span className="text-gray-400">Par {course.par || 72}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => handleToggleFavorite(course, e)}
                    className={`p-2 rounded-xl hover:bg-gray-100 transition active:scale-90 ${
                      isFav ? 'text-amber-500' : 'text-gray-300 hover:text-gray-500'
                    }`}
                    title={isFav ? 'Remove from favorites' : 'Add to favorite courses'}
                  >
                    <Icons.Star filled={isFav} />
                  </button>
                  <div className="text-gray-400 group-hover:text-green-600 transition p-1">
                    <Icons.ChevronRight />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Course / Tee-Off Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-6 duration-200">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-black text-green-800 bg-green-100 uppercase tracking-widest px-2.5 py-1 rounded-full">
                Ready to Play
              </span>
              <span className="text-xs font-bold text-gray-400">Par {selectedCourse.par || 72}</span>
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-1">{selectedCourse.name}</h3>
            <p className="text-xs text-gray-500 mb-6 flex items-center gap-1 font-medium">
              <Icons.MapPin /> {selectedCourse.location || 'Course selected'}
            </p>

            <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              Guest Players with You:
            </p>
            <div className="flex gap-2 mb-6">
              {[0, 1, 2, 3].map(num => (
                <button
                  key={num}
                  onClick={() => setGuestCount(num)}
                  className={`flex-1 py-3.5 rounded-xl font-black text-xl transition ${guestCount === num
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <button
              onClick={handleTeeOff}
              className="w-full bg-gray-900 text-white text-base font-black py-4 rounded-xl shadow-lg hover:bg-black active:scale-95 transition"
            >
              Tee Off Hole 1 →
            </button>
            <button
              onClick={() => setSelectedCourse(null)}
              className="w-full text-gray-400 font-bold py-3 mt-1 hover:text-gray-600 text-sm transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* "+ Add Custom Course" Modal with Smart Suggestions */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <form
            onSubmit={handleCreateCourse}
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <div>
                <h3 className="text-lg font-black text-gray-900">Add Golf Course</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Private to your account
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {addModalError && (
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg font-semibold">{addModalError}</p>
            )}

            {/* Course Name with Autocomplete */}
            <div className="relative">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                Course / Club Name *
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Pine Valley Golf Club"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-300 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />

              {/* Suggestions Dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-gray-100 animate-in fade-in">
                  <div className="p-2 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                    Matching Courses (Click to Auto-fill):
                  </div>
                  {suggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSuggestion(sug)}
                      className="w-full text-left p-3 hover:bg-green-50 transition flex justify-between items-center"
                    >
                      <div>
                        <p className="font-bold text-xs text-gray-800">{sug.name}</p>
                        <p className="text-[10px] text-gray-400">{sug.location || sug.source}</p>
                      </div>
                      <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        Use
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                Location / City
              </label>
              <input
                type="text"
                placeholder="e.g. Surrey, England"
                value={newCourseLocation}
                onChange={(e) => setNewCourseLocation(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-300 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            {/* Par */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                Course Par
              </label>
              <input
                type="number"
                min="60"
                max="80"
                value={newCoursePar}
                onChange={(e) => setNewCoursePar(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-300 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              🔒 Custom courses are saved privately to your profile so only you see them.
            </p>

            <button
              type="submit"
              disabled={isSavingCustom}
              className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-green-700 transition active:scale-95 disabled:opacity-50"
            >
              {isSavingCustom ? 'Saving Course...' : 'Save Course & Select'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
