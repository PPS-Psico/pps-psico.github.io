import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  options: {
    label: string;
    icon: string;
    onClick: () => void;
    variant?: "default" | "danger";
  }[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, options }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Use capture phase to handle clicks immediately
    document.addEventListener("mousedown", handleClickOutside, true);

    // Close on window resize or scroll to avoid floating menu
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  // Ajustar posición para que no se salga de los bordes del viewport
  const menuWidth = 220; // Ancho aproximado del menú
  const menuHeight = options.length * 45 + 20; // Altura estimada

  let adjustedX = x;
  let adjustedY = y;

  // Si se sale a la derecha, mover a la izquierda del cursor
  if (x + menuWidth > window.innerWidth) {
    adjustedX = x - menuWidth;
  }

  // Si se sale por abajo, mover hacia arriba del cursor
  if (y + menuHeight > window.innerHeight) {
    adjustedY = y - menuHeight;
  }

  // Asegurar que no sea negativo (fuera por arriba o izquierda)
  adjustedX = Math.max(10, adjustedX);
  adjustedY = Math.max(10, adjustedY);

  return createPortal(
    <div
      ref={menuRef}
      className="dbe dbe-menu"
      style={{ top: adjustedY, left: adjustedX }}
      onContextMenu={(e) => e.preventDefault()} // Prevenir menú nativo del navegador sobre este menú
    >
      {options.map((opt, idx) => (
        <button
          key={idx}
          onClick={(e) => {
            e.stopPropagation();
            opt.onClick();
            onClose();
          }}
          className="dbe-menu-item"
          data-variant={opt.variant === "danger" ? "danger" : "default"}
        >
          <span className="material-icons">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>,
    document.body
  );
};

export default ContextMenu;
