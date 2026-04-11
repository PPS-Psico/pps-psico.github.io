import { useState, useCallback, useRef, useEffect } from "react";

interface SwipeConfig {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  enabled?: boolean;
}

interface SwipeState {
  isSwiping: boolean;
  deltaX: number;
  deltaY: number;
  direction: "left" | "right" | "up" | "down" | null;
}

const INTERACTIVE_TARGET_SELECTOR = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  "[role='button']",
  "[role='link']",
  "[contenteditable='true']",
  "[data-no-swipe='true']",
].join(", ");

export function isInteractiveTouchTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(INTERACTIVE_TARGET_SELECTOR);
}

export function useSwipe(config: SwipeConfig = {}) {
  const {
    threshold = 50,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    enabled = true,
  } = config;

  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwiping: false,
    deltaX: 0,
    deltaY: 0,
    direction: null,
  });

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeTriggered = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || isInteractiveTouchTarget(e.target)) return;

      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
      swipeTriggered.current = false;

      setSwipeState({
        isSwiping: true,
        deltaX: 0,
        deltaY: 0,
        direction: null,
      });
    },
    [enabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !touchStart.current || swipeTriggered.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;

      // Determine primary direction
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY && absX > threshold) {
        // Horizontal swipe detected
        const direction = deltaX > 0 ? "right" : "left";
        swipeTriggered.current = true;

        setSwipeState({
          isSwiping: false,
          deltaX: 0,
          deltaY: 0,
          direction,
        });

        // Trigger callbacks
        if (direction === "left" && onSwipeLeft) {
          onSwipeLeft();
        } else if (direction === "right" && onSwipeRight) {
          onSwipeRight();
        }
      } else if (absY > absX && absY > threshold) {
        // Vertical swipe detected
        const direction = deltaY > 0 ? "down" : "up";
        swipeTriggered.current = true;

        setSwipeState({
          isSwiping: false,
          deltaX: 0,
          deltaY: 0,
          direction,
        });

        // Trigger callbacks
        if (direction === "up" && onSwipeUp) {
          onSwipeUp();
        } else if (direction === "down" && onSwipeDown) {
          onSwipeDown();
        }
      } else {
        // Still swiping
        setSwipeState((prev) => ({
          ...prev,
          deltaX,
          deltaY,
          direction: absX > absY ? (deltaX > 0 ? "right" : "left") : deltaY > 0 ? "down" : "up",
        }));
      }
    },
    [enabled, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]
  );

  const handleTouchEnd = useCallback(() => {
    touchStart.current = null;
    setSwipeState({
      isSwiping: false,
      deltaX: 0,
      deltaY: 0,
      direction: null,
    });
    swipeTriggered.current = false;
  }, []);

  const swipeHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  return { swipeState, swipeHandlers };
}

// Hook specifically for tab navigation with swipe
interface TabSwipeConfig {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  enabled?: boolean;
}

export function useTabSwipe(config: TabSwipeConfig) {
  const { tabs, activeTab, onTabChange, enabled = true } = config;

  const currentIndex = tabs.indexOf(activeTab);

  const handleSwipeLeft = useCallback(() => {
    if (currentIndex < tabs.length - 1) {
      onTabChange(tabs[currentIndex + 1]);
    }
  }, [currentIndex, tabs, onTabChange]);

  const handleSwipeRight = useCallback(() => {
    if (currentIndex > 0) {
      onTabChange(tabs[currentIndex - 1]);
    }
  }, [currentIndex, tabs, onTabChange]);

  const { swipeState, swipeHandlers } = useSwipe({
    threshold: 60,
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    enabled,
  });

  // Add visual feedback during swipe
  const style = {
    transform: swipeState.isSwiping ? `translateX(${swipeState.deltaX * 0.3}px)` : undefined,
    transition: swipeState.isSwiping ? "none" : "transform 0.3s ease-out",
  };

  return { swipeHandlers, style, swipeState };
}
