"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [time, setTime] = useState(new Date());
  const [clockedIn, setClockedIn] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [entries, setEntries] = useState([
    { id: 1, date: "2023-03-18", timeIn: "09:00 AM", timeOut: "05:00 PM", hours: 8 },
    { id: 2, date: "2023-03-19", timeIn: "08:30 AM", timeOut: "04:30 PM", hours: 8 },
    { id: 3, date: "2023-03-20", timeIn: "09:15 AM", timeOut: "05:15 PM", hours: 8 },
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      if (clockedIn) {
        setTimeElapsed(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [clockedIn]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleClock = () => {
    if (clockedIn) {
      // Here you would save the clock out time to your records
      setClockedIn(false);
      setTimeElapsed(0);
    } else {
      setClockedIn(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#1e1b4b] text-[#f1f5f9] py-6">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <h1 className="text-3xl tracking-tight font-instrument-serif bg-clip-text text-transparent bg-gradient-to-r from-[#f9a8d4] to-[#93c5fd]">Timecard</h1>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Column - Clock In/Out */}
          <div className="bg-[#1e293b]/70 backdrop-blur-md rounded-xl border border-[#64748b]/20 p-6 shadow-xl shadow-[#6366f1]/5 transition-all duration-300 hover:shadow-[#6366f1]/10">
            <div className="flex flex-col items-center mb-8">
              <h2 className="text-2xl font-instrument-serif font-light text-[#f1f5f9] mb-6">Time Tracker</h2>
              
              <div className="text-5xl font-geist-mono mb-7 text-[#f1f5f9] drop-shadow-md animate-[pulse_4s_ease-in-out_infinite]">
                {time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
              </div>
              
              {clockedIn && (
                <div className="text-3xl font-geist-mono mb-7 text-[#5eead4] drop-shadow animate-[fadeIn_0.5s_ease-in-out]">
                  {formatTime(timeElapsed)}
                </div>
              )}
              
              <button 
                onClick={toggleClock}
                className={`w-full py-4 px-6 rounded-lg font-medium text-white text-lg transition-all duration-300 shadow-lg transform hover:scale-[1.02] ${
                  clockedIn 
                    ? "bg-gradient-to-r from-[#f43f5e] to-[#ec4899] hover:from-[#e11d48] hover:to-[#db2777] shadow-[#f43f5e]/20" 
                    : "bg-gradient-to-r from-[#059669] to-[#0d9488] hover:from-[#047857] hover:to-[#0f766e] shadow-[#059669]/20"
                }`}
              >
                {clockedIn ? "Clock Out" : "Clock In"}
              </button>
            </div>
            
            <div className="border-t border-[#64748b]/20 pt-6">
              <h3 className="text-lg font-instrument-serif text-[#f1f5f9] mb-4">Today's Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-[#334155]/80 to-[#475569]/50 p-4 rounded-lg transition-all duration-300 hover:from-[#334155]/90 hover:to-[#475569]/60">
                  <p className="text-sm text-[#94a3b8] mb-1">Hours Today</p>
                  <p className="text-2xl font-geist-mono text-[#bae6fd]">8.0</p>
                </div>
                <div className="bg-gradient-to-br from-[#334155]/80 to-[#475569]/50 p-4 rounded-lg transition-all duration-300 hover:from-[#334155]/90 hover:to-[#475569]/60">
                  <p className="text-sm text-[#94a3b8] mb-1">Week Total</p>
                  <p className="text-2xl font-geist-mono text-[#bae6fd]">24.0</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Middle Column - Time Entries */}
          <div className="bg-[#1e293b]/70 backdrop-blur-md rounded-xl border border-[#64748b]/20 p-6 shadow-xl shadow-[#6366f1]/5 transition-all duration-300 hover:shadow-[#6366f1]/10">
            <h2 className="text-2xl font-instrument-serif font-light text-[#f1f5f9] mb-6">Recent Time Entries</h2>
            
            <div className="space-y-5">
              {entries.map(entry => (
                <div key={entry.id} className="border-b border-[#64748b]/20 pb-5 last:border-0 hover:bg-[#334155]/30 transition-all duration-300 rounded-lg p-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-geist-mono text-[#94a3b8]">{entry.date}</span>
                    <span className="text-sm font-geist-mono text-[#5eead4]">{entry.hours} hrs</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="bg-[#134e4a]/40 text-[#5eead4] px-2 py-1 rounded-md text-xs font-geist-mono border border-[#115e59]/30 transition-all hover:bg-[#134e4a]/50">In: {entry.timeIn}</span>
                      <span className="bg-[#9f1239]/40 text-[#fda4af] px-2 py-1 rounded-md text-xs font-geist-mono border border-[#881337]/30 transition-all hover:bg-[#9f1239]/50">Out: {entry.timeOut}</span>
                    </div>
                    <button className="text-[#94a3b8] hover:text-[#f1f5f9] transition-colors duration-300 transform hover:scale-110">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="mt-6 w-full py-2.5 px-4 border border-[#6366f1]/30 rounded-lg text-sm font-medium text-[#f1f5f9] bg-[#334155]/50 hover:bg-[#475569]/50 transition-all duration-300 hover:border-[#818cf8]/40 transform hover:translate-y-[-2px]">
              View All Entries
            </button>
          </div>
          
          {/* Right Column - Weekly Card View */}
          <div className="bg-[#1e293b]/70 backdrop-blur-md rounded-xl border border-[#64748b]/20 p-6 shadow-xl shadow-[#6366f1]/5 transition-all duration-300 hover:shadow-[#6366f1]/10">
            <h2 className="text-2xl font-instrument-serif font-light text-[#f1f5f9] mb-6">Weekly Reports</h2>
            
            <div className="space-y-4">
              {['March 18-24, 2023', 'March 11-17, 2023', 'March 4-10, 2023'].map((week, index) => (
                <div key={index} className="border border-[#64748b]/20 rounded-lg p-4 hover:bg-[#334155]/40 transition-all duration-300 transform hover:scale-[1.01]">
                  <h3 className="font-instrument-serif text-[#f1f5f9] mb-2">{week}</h3>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-[#94a3b8]">Total Hours</span>
                    <span className="text-sm font-geist-mono text-[#f1f5f9]">40.0</span>
                  </div>
                  <div className="w-full bg-[#475569]/60 rounded-full h-1.5 mb-4 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#06b6d4] to-[#0891b2] h-1.5 rounded-full transition-all duration-1000 ease-in-out" style={{ width: '75%' }}></div>
                  </div>
                  <div className="flex space-x-2">
                    <button className="flex-1 py-2 px-3 bg-[#475569]/70 hover:bg-[#64748b]/70 rounded-md text-sm font-medium text-[#f1f5f9] transition-all duration-300 hover:shadow-lg hover:shadow-[#6366f1]/10">
                      View
                    </button>
                    <button className="flex-1 py-2 px-3 bg-gradient-to-r from-[#155e75]/30 to-[#0e7490]/30 hover:from-[#155e75]/40 hover:to-[#0e7490]/40 rounded-md text-sm font-medium text-[#7dd3fc] transition-all duration-300 hover:shadow-lg hover:shadow-[#38bdf8]/10">
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 border-t border-[#64748b]/20 pt-6">
              <h3 className="text-lg font-instrument-serif text-[#f1f5f9] mb-4">Monthly Overview</h3>
              <div className="bg-gradient-to-br from-[#334155]/80 to-[#475569]/50 rounded-lg p-4 transition-all duration-300 hover:from-[#334155]/90 hover:to-[#475569]/60">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-[#94a3b8]">March 2023</span>
                  <span className="text-sm font-geist-mono text-[#f1f5f9]">160.0 hrs</span>
                </div>
                <div className="w-full bg-[#475569]/60 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-[#6366f1] to-[#a855f7] h-1.5 rounded-full transition-all duration-1000 ease-in-out" style={{ width: '85%' }}></div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </main>
      
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
