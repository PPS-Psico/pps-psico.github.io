import React, { useState, useEffect, useCallback } from "react";
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPressed, setIsPressed] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const index = tabs.findIndex((tab) => tab.id === activeTabId);
    setActiveIndex(index >= 0 ? index : 0);
  }, [activeTabId, tabs]);

  useEffect(() => {
    // Small delay for entrance animation
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handlePress = useCallback((tabId: string) => {
    setIsPressed(tabId);
    setTimeout(() => setIsPressed(null), 150);
  }, []);

  const handleNavigate = useCallback(
    (tab: NavTab, index: number) => {
      handlePress(tab.id);
      if (location.pathname !== tab.path) {
        // Add haptic feedback if available
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(10);
        }
        navigate(tab.path);
      }
    },
    [navigate, location.pathname, handlePress]
  );

  return (
    <>
      {/* Safe area spacer for iPhone notch */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
        {/* Top gradient border for better visibility in light mode */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />

        {/* Main navigation container */}
        <div className="h-[80px] bg-white dark:bg-[#0B1120] backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.3)]">
          <div className="flex justify-around items-center h-full pb-1 relative">
            {tabs.map((tab, index) => {
              const isActive = tab.id === activeTabId;
              const isBeingPressed = isPressed === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleNavigate(tab, index)}
                  onTouchStart={() => handlePress(tab.id)}
                  onTouchEnd={() => setIsPressed(null)}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  className="relative flex flex-col items-center justify-center w-full h-full group focus:outline-none active:bg-transparent"
                  aria-label={tab.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  {/* Active indicator pill - More visible in light mode */}
                  {isActive && (
                    <>
                      {/* Glow effect */}
                      <div className="absolute -top-1 w-12 h-1 bg-gradient-to-r from-blue-400 to-indigo-400 dark:from-blue-500 dark:to-indigo-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)] dark:shadow-[0_0_12px_rgba(59,130,246,0.4)] animate-pulse" />
                      {/* Main indicator */}
                      <div
                        className="absolute -top-1 w-12 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-lg shadow-blue-500/30"
                        style={{
                          animation: "slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                      />
                    </>
                  )}

                  {/* Icon container with spring animation */}
                  <div
                    className={`relative transition-all duration-300 ease-spring ${
                      isActive ? "-translate-y-1" : ""
                    } ${isBeingPressed ? "scale-90" : "scale-100"}`}
                  >
                    {/* Active background circle - More visible in light mode */}
                    <div
                      className={`absolute inset-0 -m-2 rounded-2xl transition-all duration-300 ${
                        isActive
                          ? "bg-blue-100 dark:bg-blue-900/30 scale-100 shadow-md dark:shadow-none"
                          : "bg-transparent scale-75 opacity-0"
                      }`}
                    />

                    {/* Icon */}
                    <div
                      className={`relative p-2 rounded-xl transition-all duration-300 ${
                        isActive
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-500 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400"
                      }`}
                    >
                      <span
                        className={`material-icons transition-all duration-300 ${
                          isActive
                            ? "!text-[28px] drop-shadow-sm dark:drop-shadow-md"
                            : "!text-[24px]"
                        }`}
                        style={{
                          transform: isBeingPressed ? "scale(0.85)" : "scale(1)",
                          transition: "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        }}
                      >
                        {tab.icon}
                      </span>
                    </div>
                  </div>

                  {/* Label with fade animation - Better contrast in light mode */}
                  <span
                    className={`text-[10px] font-semibold transition-all duration-300 leading-none mt-0.5 ${
                      isActive
                        ? "text-blue-700 dark:text-blue-100 font-bold"
                        : "text-slate-500 dark:text-slate-500 font-medium"
                    }`}
                    style={{
                      opacity: isActive ? 1 : 0.8,
                      transform: isActive ? "translateY(0)" : "translateY(1px)",
                    }}
                  >
                    {tab.label}
                  </span>

                  {/* Subtle scale effect when pressed - More visible in light mode */}
                  <div
                    className={`absolute inset-0 bg-slate-100 dark:bg-slate-800 rounded-xl transition-all duration-150 -z-10 ${
                      isBeingPressed ? "opacity-100 scale-95" : "opacity-0 scale-90"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CSS for spring easing */}
      <style>{`
        .ease-spring {
          transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(4px) scaleX(0.5);
          }
          to {
            opacity: 1;
            transform: translateY(0) scaleX(1);
          }
        }
      `}</style>
    </>
  );
};

export default MobileBottomNav;
