import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ImageViewerProps {
  url: string;
  onLoad?: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ url, onLoad }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [rotation, setRotation] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsLoading(true);
    setRotation(0);
  }, [url]);

  const handleImageLoad = () => {
    setIsLoading(false);
    if (imageRef.current) {
      setImageSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
    }
    onLoad?.();
  };

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev * 1.25, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => {
      const newScale = Math.max(prev / 1.25, 0.5);
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  const rotateClockwise = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const rotateCounterClockwise = useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  }, []);

  const fitToScreen = useCallback(() => {
    if (containerRef.current && imageRef.current) {
      const container = containerRef.current.getBoundingClientRect();
      const img = imageRef.current;

      const scaleX = (container.width - 80) / img.naturalWidth;
      const scaleY = (container.height - 80) / img.naturalHeight;
      const newScale = Math.min(scaleX, scaleY, 1);

      setScale(newScale);
      setPosition({ x: 0, y: 0 });
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => {
      const newScale = Math.min(Math.max(prev * delta, 0.5), 5);
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        resetZoom();
      } else if (e.key === "r" || e.key === "R") {
        rotateClockwise();
      } else if (e.key === "+" || e.key === "=") {
        zoomIn();
      } else if (e.key === "-") {
        zoomOut();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetZoom, rotateClockwise, zoomIn, zoomOut]);

  return (
    <div className="flex flex-col h-full">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-md border-b border-white/10"
      >
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={zoomOut}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
            title="Alejar"
          >
            <span className="material-icons">zoom_out</span>
          </motion.button>

          <div className="w-16 text-center">
            <span className="text-white text-sm font-medium">{Math.round(scale * 100)}%</span>
          </div>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={zoomIn}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
            title="Acercar"
          >
            <span className="material-icons">zoom_in</span>
          </motion.button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={resetZoom}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white text-sm font-medium"
            title="Tamaño original (Ctrl+0)"
          >
            1:1
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={fitToScreen}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
            title="Ajustar a pantalla"
          >
            <span className="material-icons">fit_screen</span>
          </motion.button>
        </div>

        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={rotateCounterClockwise}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
            title="Rotar izquierda"
          >
            <span className="material-icons">rotate_left</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={rotateClockwise}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
            title="Rotar derecha (R)"
          >
            <span className="material-icons">rotate_right</span>
          </motion.button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <div className="text-xs text-gray-400 hidden md:block">
            {imageSize.width > 0 && `${imageSize.width} × ${imageSize.height}`}
          </div>
        </div>
      </motion.div>

      <div
        ref={containerRef}
        className="flex-grow overflow-hidden relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-slate-950/50"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-white/60 text-sm">Cargando imagen...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{
            x: position.x,
            y: position.y,
          }}
          transition={{ type: "tween", duration: 0.1 }}
        >
          <motion.img
            ref={imageRef}
            src={url}
            alt="Preview"
            className="max-w-none select-none shadow-2xl"
            animate={{
              scale: scale,
              rotate: rotation,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onLoad={handleImageLoad}
            draggable={false}
          />
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white/70 text-sm border border-white/10"
      >
        Scroll para zoom • Arrastrar para mover
      </motion.div>
    </div>
  );
};

export default ImageViewer;
