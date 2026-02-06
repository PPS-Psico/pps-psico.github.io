import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import type { TabId } from "../../types";

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
  const location = useLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleNavigate = useCallback(
    (tab: NavTab) => {
      if (location.pathname !== tab.path) {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(10);
        }
        navigate(tab.path);
      }
    },
    [navigate, location.pathname]
  );

  const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);

  return (
    <>
      {/* Safe area spacer */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
        {/* Navigation Container - Floating Pill Style */}
        <div className="mx-4 mb-4">
          <div className="h-[72px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-700/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="relative flex items-center justify-around h-full px-2">
              {/* Animated Background Pill */}
              <motion.div
                className="absolute h-[48px] bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl shadow-lg shadow-blue-500/25"
                initial={false}
                animate={{
                  x: mounted ? `calc(${activeIndex} * (100% + 0px) + 8px)` : 0,
                  width: `calc(${100 / tabs.length}% - 16px)`,
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
                style={{
                  left: 0,
                  top: "50%",
                  y: "-50%",
                }}
              />

              {tabs.map((tab, index) => {
                const isActive = tab.id === activeTabId;

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleNavigate(tab)}
                    style={{ WebkitTapHighlightColor: "transparent" }}
                    className="relative flex flex-col items-center justify-center w-full h-full z-10 focus:outline-none"
                    aria-label={tab.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <motion.div
                      className="flex flex-col items-center justify-center"
                      animate={{
                        scale: isActive ? 1.05 : 1,
                        y: isActive ? -2 : 0,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                      }}
                    >
                      {/* Icon */}
                      <span
                        className={`material-icons text-2xl transition-colors duration-300 ${
                          isActive
                            ? "text-white drop-shadow-md"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {tab.icon}
                      </span>

                      {/* Label */}
                      <span
                        className={`text-[11px] font-semibold mt-0.5 transition-colors duration-300 ${
                          isActive
                            ? "text-white font-bold"
                            : "text-slate-500 dark:text-slate-400 font-medium"
                        }`}
                      >
                        {tab.label}
                      </span>
                    </motion.div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileBottomNav;
