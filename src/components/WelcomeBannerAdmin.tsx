
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
    setCurrentDate(new Date().toLocaleDateString('es-ES', options));
  }, []);

  return (
    <div className="relative mb-2 px-2">
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                  Panel de Control
              </p>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">{name.split(' ')[0]}</span>.
              </h1>
          </div>
          <div className="text-left md:text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="material-icons text-slate-400 !text-lg">calendar_today</span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 capitalize">{currentDate}</span>
              </div>
          </div>
       </div>
       <div className="h-px w-full bg-gradient-to-r from-slate-200 via-slate-100 to-transparent dark:from-slate-800 dark:via-slate-900 mt-6"></div>
    </div>
  );
};

export default WelcomeBannerAdmin;
