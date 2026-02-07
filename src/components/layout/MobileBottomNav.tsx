import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  const handleNavigate = useCallback(
    (tab: NavTab) => {
      if (location.pathname !== tab.path) {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(8);
        }
        navigate(tab.path);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [navigate, location.pathname]
  );

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      {/* Premium Glass Background */}
      <div className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border-t border-slate-200/50 dark:border-slate-800/50" />

      {/* Navigation Container */}
      <div className="relative flex items-center justify-around h-[76px] px-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <motion.button
              key={tab.id}
              onClick={() => handleNavigate(tab)}
              className="relative flex flex-col items-center justify-center flex-1 h-full focus:outline-none"
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <div className="relative flex flex-col items-center">
                {/* Premium Active Glow - Blue for light mode, Indigo for dark mode */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="glow"
                      className="absolute -inset-3 bg-blue-500/20 dark:bg-indigo-500/20 rounded-full blur-xl"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                </AnimatePresence>

                {/* Icon Container with Background */}
                <motion.div
                  className="relative flex items-center justify-center w-11 h-11 mb-0.5"
                  animate={{
                    scale: isActive ? 1.05 : 1,
                    y: isActive ? -2 : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                  }}
                >
                  {/* Active Background Circle - Blue for light mode, Indigo for dark mode */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        layoutId="circle"
                        className="absolute inset-0 bg-blue-600 dark:bg-indigo-500 rounded-2xl"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        style={{
                          boxShadow: isActive
                            ? "0 4px 14px -2px rgba(37, 99, 235, 0.4)"
                            : "0 4px 14px -2px rgba(168, 85, 247, 0.4)",
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Icon */}
                  <span
                    className={`material-icons text-2xl relative z-10 transition-colors duration-200 ${
                      isActive ? "text-white" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {tab.icon}
                  </span>
                </motion.div>

                {/* Label - Blue for light mode, Indigo for dark mode */}
                <span
                  className={`text-[10px] font-semibold transition-all duration-200 ${
                    isActive
                      ? "text-blue-600 dark:text-indigo-400"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {tab.label}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileBottomNav;
