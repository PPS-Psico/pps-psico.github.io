import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isInteractiveTouchTarget } from "../../hooks/useSwipe";

type SlideDirection = "left" | "right" | "up" | "down";

interface SlideTransitionProps {
  children: React.ReactNode;
  direction?: SlideDirection;
  duration?: number;
  delay?: number;
  className?: string;
  key?: string | number;
}

export const SlideTransition: React.FC<SlideTransitionProps> = ({
  children,
  direction = "up",
  duration = 0.35,
  delay = 0,
  className = "",
  key,
}) => {
  const variants = {
    hidden: {
      opacity: 0,
      x: direction === "left" ? 20 : direction === "right" ? -20 : 0,
      y: direction === "up" ? 15 : direction === "down" ? -15 : 0,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
    },
    exit: {
      opacity: 0,
      x: direction === "left" ? -20 : direction === "right" ? 20 : 0,
      y: direction === "up" ? -15 : direction === "down" ? 15 : 0,
    },
  };

  return (
    <motion.div
      key={key}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variants}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94], // Ease-out-cubic
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface TabTransitionWrapperProps {
  children: React.ReactNode;
  activeTabId: string;
  tabOrder: string[];
  className?: string;
}

export const TabTransitionWrapper: React.FC<TabTransitionWrapperProps> = ({
  children,
  activeTabId,
  tabOrder,
  className = "",
}) => {
  const [direction, setDirection] = useState<SlideDirection>("up");
  const previousTabRef = useRef(activeTabId);

  useEffect(() => {
    const currentIndex = tabOrder.indexOf(activeTabId);
    const previousIndex = tabOrder.indexOf(previousTabRef.current);

    if (currentIndex > previousIndex) {
      setDirection("left");
    } else if (currentIndex < previousIndex) {
      setDirection("right");
    }

    previousTabRef.current = activeTabId;
  }, [activeTabId, tabOrder]);

  return (
    <AnimatePresence mode="wait">
      <SlideTransition key={activeTabId} direction={direction} duration={0.3} className={className}>
        {children}
      </SlideTransition>
    </AnimatePresence>
  );
};

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  className = "",
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const threshold = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isInteractiveTouchTarget(e.target)) return;

    if (window.scrollY === 0 && !isRefreshing) {
      startYRef.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;

    if (diff > 0) {
      e.preventDefault();
      // Add resistance to the pull
      const resistedDistance = Math.min(diff * 0.5, threshold * 1.5);
      setPullDistance(resistedDistance);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    setIsPulling(false);
    setPullDistance(0);
  };

  const handleTouchCancel = () => {
    setIsPulling(false);
    setPullDistance(0);
  };

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 z-10"
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 20 ? 1 : 0,
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
              isRefreshing
                ? "border-blue-500 border-t-transparent animate-spin"
                : progress >= 1
                  ? "bg-blue-500 border-blue-500"
                  : "border-slate-300 dark:border-slate-600"
            }`}
            style={{
              transform: `rotate(${isRefreshing ? 0 : rotation}deg)`,
            }}
          >
            {!isRefreshing && progress < 1 && (
              <span className="material-icons text-slate-400 dark:text-slate-500 !text-base">
                arrow_downward
              </span>
            )}
            {(progress >= 1 || isRefreshing) && (
              <span className="material-icons text-white !text-base">
                {isRefreshing ? "refresh" : "check"}
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isRefreshing
              ? "Actualizando..."
              : progress >= 1
                ? "Suelta para actualizar"
                : "Desliza para actualizar"}
          </span>
        </div>
      </div>

      {/* Content with transform */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? "none" : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// Header that hides on scroll down and shows on scroll up
interface SmartHeaderProps {
  children: React.ReactNode;
  className?: string;
  threshold?: number;
}

export const SmartHeader: React.FC<SmartHeaderProps> = ({
  children,
  className = "",
  threshold = 50,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          if (currentScrollY < threshold) {
            setIsVisible(true);
          } else if (currentScrollY > lastScrollY.current) {
            // Scrolling down
            setIsVisible(false);
          } else {
            // Scrolling up
            setIsVisible(true);
          }

          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 ${className}`}
      initial={{ y: 0 }}
      animate={{ y: isVisible ? 0 : -100 }}
      transition={{
        duration: 0.35,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      {children}
    </motion.header>
  );
};

export default SlideTransition;
