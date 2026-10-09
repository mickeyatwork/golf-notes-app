import React, { useState } from 'react';
import { MOCK_COURSES } from '../data/mockData';
import { Icons } from '../components/Icons';

export default function StartRound({ navigate, setActiveRound }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ buggy: false, range: false });
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [guestCount, setGuestCount] = useState(0);

  const filteredCourses = MOCK_COURSES.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBuggy = !filters.buggy || c.facilities.includes('buggy');
    const matchesRange = !filters.range || c.facilities.includes('range');
    return matchesSearch && matchesBuggy && matchesRange;
  });

  const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

  const handleTeeOff = () => {
    setActiveRound({ id: `r_${Date.now()}`, courseId: selectedCourse.id, courseName: selectedCourse.name, currentHole: 1, guestCount, dateStarted: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    navigate('active');
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen relative">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate('dashboard')} className="text-green-700 font-bold mr-4 text-xl">←</button>
        <h2 className="text-3xl font-black text-gray-800">Select Course</h2>
      </div>

      <input type="text" placeholder="Search local courses..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-4 rounded-xl border border-gray-200 shadow-sm mb-4 text-lg focus:outline-none focus:ring-2 focus:ring-green-600" />
      
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button onClick={() => toggleFilter('buggy')} className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap transition ${filters.buggy ? 'bg-green-100 border-green-600 text-green-800' : 'bg-white border-gray-200 text-gray-500'}`}>
          {filters.buggy && <Icons.Check />} 🛒 Buggy Hire
        </button>
        <button onClick={() => toggleFilter('range')} className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap transition ${filters.range ? 'bg-green-100 border-green-600 text-green-800' : 'bg-white border-gray-200 text-gray-500'}`}>
          {filters.range && <Icons.Check />} 🎯 Driving Range
        </button>
      </div>
      
      <div className="space-y-3">
        {filteredCourses.map(course => (
          <button key={course.id} onClick={() => setSelectedCourse(course)} className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-left flex justify-between items-center hover:border-green-500 transition active:scale-95">
            <div>
              <span className="block font-bold text-lg text-gray-800">{course.name}</span>
              <span className="text-sm text-gray-500 flex items-center gap-1 mt-1"><Icons.MapPin /> {searchTerm ? course.location : `${course.distance} away`}</span>
            </div>
            <Icons.ChevronRight />
          </button>
        ))}
      </div>

      {selectedCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 duration-300">
            <h3 className="text-2xl font-black text-gray-900 mb-1">{selectedCourse.name}</h3>
            <p className="text-gray-500 mb-6 font-medium">Guests playing with you:</p>
            <div className="flex gap-2 mb-6">
              {[0,1,2,3].map(num => (
                <button key={num} onClick={() => setGuestCount(num)} className={`flex-1 py-4 rounded-xl font-black text-2xl transition ${guestCount === num ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}>{num}</button>
              ))}
            </div>
            <button onClick={handleTeeOff} className="w-full bg-gray-900 text-white text-lg font-bold py-4 rounded-xl shadow-lg active:scale-95 transition">Tee Off</button>
            <button onClick={() => setSelectedCourse(null)} className="w-full text-gray-400 font-bold py-4 mt-2 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
