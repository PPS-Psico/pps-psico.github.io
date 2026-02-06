import { motion, AnimatePresence } from "framer-motion";
import React, { ReactNode, useRef, useEffect, useState } from "react";

interface Tab {
  id: string;
  label: string;
  icon?: string;
  content: ReactNode;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  onTabClose?: (tabId: string) => void;
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  className = "",
}) => {
  // Track previous tab for slide direction
  const previousTabRef = useRef(activeTabId);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");

  // Track button measurements for accurate positioning
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    const previousIndex = tabs.findIndex((t) => t.id === previousTabRef.current);

    if (currentIndex > previousIndex) {
      setSlideDirection("right");
    } else if (currentIndex < previousIndex) {
      setSlideDirection("left");
    }

    previousTabRef.current = activeTabId;
  }, [activeTabId, tabs]);

  // Update indicator position based on actual button measurements
  useEffect(() => {
    const activeButton = buttonRefs.current[activeTabId];
    if (!activeButton) return;

    const updateIndicator = () => {
      const container = activeButton.parentElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();

      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    };

    updateIndicator();

    // Also update on resize
    const handleResize = () => {
      requestAnimationFrame(updateIndicator);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeTabId]);

  return (
    <div
      className={`flex flex-col w-full glass-panel rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative transition-all duration-300 ${className}`}
    >
      {/* --- HEADER: NAVIGATION BAR --- */}
      <div className="flex-shrink-0 px-4 sm:px-8 py-6 border-b border-slate-100 dark:border-slate-800/50 bg-white/80 dark:bg-[#0F172A]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Mobile Segmented Control (Premium Design) */}
          <div className="md:hidden w-full">
            <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
              {tabs.map((tab) => {
                const isActive = activeTabId === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`relative flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                      isActive
                        ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-lg shadow-slate-200/50 dark:shadow-black/20"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    {tab.icon && (
                      <span
                        className={`material-icons !text-lg transition-colors ${isActive ? "text-blue-600 dark:text-blue-400" : ""}`}
                      >
                        {tab.icon}
                      </span>
                    )}
                    <span className="relative z-10">{tab.label}</span>
                    {/* Active indicator line */}
                    {isActive && (
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop Animated Tabs (Premium Segmented Control Look) */}
          <div
            role="tablist"
            ref={(el) => {
              if (el) {
                // Force a measurement on mount
                setTimeout(() => {
                  const activeButton = buttonRefs.current[activeTabId];
                  if (activeButton && activeButton.parentElement) {
                    const containerRect = activeButton.parentElement.getBoundingClientRect();
                    const buttonRect = activeButton.getBoundingClientRect();
                    setIndicatorStyle({
                      left: buttonRect.left - containerRect.left,
                      width: buttonRect.width,
                    });
                  }
                }, 0);
              }
            }}
            className="hidden md:flex p-1.5 bg-slate-100/80 dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-slate-800 mx-auto relative"
          >
            {/* Active Tab Background - Positioned based on actual measurements */}
            <div
              className="absolute inset-y-1.5 bg-white dark:bg-slate-700/80 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-none ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300 ease-out"
              style={{
                left: `${indicatorStyle.left}px`,
                width: `${indicatorStyle.width}px`,
              }}
            />

            {tabs.map((tab) => {
              const isActive = activeTabId === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    buttonRefs.current[tab.id] = el;
                  }}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                                relative flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors duration-200 z-10 outline-none whitespace-nowrap
                                ${isActive ? "text-slate-800 dark:text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}
                            `}
                >
                  <span
                    className={`material-icons !text-lg relative z-10 transition-colors duration-200 ${isActive ? "text-blue-600 dark:text-blue-400" : ""}`}
                  >
                    {tab.icon}
                  </span>
                  <span className="relative z-10">{tab.label}</span>

                  {onTabClose && (tab as any).isClosable && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onTabClose(tab.id);
                      }}
                      className="ml-2 p-0.5 hover:bg-rose-100 text-slate-400 hover:text-rose-500 rounded-full transition-colors relative z-10"
                    >
                      <span className="material-icons !text-sm">close</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- BODY: CONTENT AREA --- */}
      {/* Reduced min-h from 600px to 300px to fix excessive whitespace on desktop */}
      <div className="flex-grow bg-slate-50/50 dark:bg-[#0B1120]/50 min-h-[300px] w-full relative overflow-hidden">
        {/* Render active content with horizontal slide animation */}
        <div className="w-full h-full p-4 sm:p-8">
          <AnimatePresence mode="wait" initial={false}>
            {tabs.map((tab) => {
              if (activeTabId !== tab.id) return null;

              const xOffset = slideDirection === "right" ? 50 : -50;

              return (
                <motion.div
                  key={tab.id}
                  initial={{ opacity: 0, x: xOffset }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -xOffset }}
                  transition={{
                    duration: 0.3,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  className="w-full max-w-7xl mx-auto"
                >
                  {tab.content}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Tabs;
