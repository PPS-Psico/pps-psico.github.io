
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { TabId } from '../../types';

interface NavTab {
  id: TabId;
  label: string;
  icon?: string;
  path: string;
}

interface MobileBottomNavProps {
  tabs: NavTab[];
  activeTabId: TabId;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ tabs, activeTabId }) => {
  const navigate = useNavigate();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800 shadow-[0_-10px_30px_rgba(0,0,0,0.04)] z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-[65px] pb-1 relative">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className="relative flex flex-col items-center justify-center w-full h-full group focus:outline-none active:bg-transparent"
            >
              {/* Background Active Bubble (Subtle) */}
              {isActive && (
                <div className="absolute inset-x-3 top-2 bottom-1 bg-blue-50 dark:bg-blue-900/10 rounded-xl -z-10 animate-fade-in"></div>
              )}

              <div className={`transition-all duration-300 ease-out transform ${isActive ? '-translate-y-0.5' : ''}`}>
                <div className={`
                    p-1 rounded-xl transition-all duration-300 
                    ${isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }
                `}>
                  <span className={`material-icons transition-all duration-300 ${isActive ? '!text-[26px] drop-shadow-sm' : '!text-[24px]'}`}>
                    {tab.icon}
                  </span>
                </div>
              </div>

              <span className={`
                  text-[10px] font-bold transition-all duration-300 leading-none mt-0.5
                  ${isActive
                  ? 'text-blue-900 dark:text-blue-100 scale-105'
                  : 'text-slate-500 dark:text-slate-500 scale-100'
                }
              `}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
