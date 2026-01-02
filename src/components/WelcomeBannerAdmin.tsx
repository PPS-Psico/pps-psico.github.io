
import React, { useState, useEffect } from 'react';

interface WelcomeBannerAdminProps {
  name: string;
}

const WelcomeBannerAdmin: React.FC<WelcomeBannerAdminProps> = ({ name }) => {
  const [greeting, setGreeting] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting('Buenos días');
    } else if (hour >= 12 && hour < 20) {
      setGreeting('Buenas tardes');
    } else {
      setGreeting('Buenas noches');
    }

    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = new Date().toLocaleDateString('es-ES', options);
    setCurrentDate(dateStr.charAt(0).toUpperCase() + dateStr.slice(1));
  }, []);

  return (
    <div className="relative mb-8 px-2 mt-4 animate-fade-in-up">
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">
                    Panel de Control
                  </span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight">
                {greeting}, <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
                    {name.split(' ')[0]}
                </span>.
              </h1>
          </div>
          
          <div className="text-left md:text-right relative z-10">
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 shadow-sm backdrop-blur-md">
                  <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-300">
                      <span className="material-icons !text-xl">calendar_month</span>
                  </div>
                  <div className="text-left">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha Actual</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize">{currentDate}</p>
                  </div>
              </div>
          </div>
       </div>
    </div>
  );
};

export default WelcomeBannerAdmin;
