import React, { useState, useRef, useEffect } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Reset cuando cambia la URL
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsLoading(true);
  }, [url]);

  const handleImageLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const zoomIn = () => setScale((prev) => Math.min(prev * 1.25, 5));
  const zoomOut = () => {
    setScale((prev) => {
      const newScale = Math.max(prev / 1.25, 0.5);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  };
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  const fitToScreen = () => {
    if (containerRef.current && imageRef.current) {
      const container = containerRef.current.getBoundingClientRect();
      const image = imageRef.current;

      const scaleX = (container.width - 40) / image.naturalWidth;
      const scaleY = (container.height - 40) / image.naturalHeight;
      const newScale = Math.min(scaleX, scaleY, 1);

      setScale(newScale);
      setPosition({ x: 0, y: 0 });
    }
  };

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

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
            title="Alejar"
          >
            <span className="material-icons">zoom_out</span>
          </button>
          <span className="text-white text-sm font-medium min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
            title="Acercar"
          >
            <span className="material-icons">zoom_in</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetZoom}
            className="px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white text-sm"
            title="Tamaño original"
          >
            1:1
          </button>
          <button
            onClick={fitToScreen}
            className="px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white text-sm"
            title="Ajustar a pantalla"
          >
            <span className="material-icons text-sm">fit_screen</span>
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className="flex-grow overflow-hidden relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          </div>
        )}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
          }}
        >
          <img
            ref={imageRef}
            src={url}
            alt="Preview"
            className="max-w-none select-none"
            style={{
              transform: `scale(${scale})`,
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
            onLoad={handleImageLoad}
            draggable={false}
          />
        </div>
      </div>

      {/* Help text */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full text-white/70 text-xs">
        Scroll para zoom • Arrastrar para mover
      </div>
    </div>
  );
};

export default ImageViewer;
