import React, { useMemo } from "react";
import { createPortal } from "react-dom";

const NOTA_OPTIONS = ["4", "5", "6", "7", "8", "9", "10"];

interface NotaSelectorProps {
  onSelect: (nota: string) => void;
  onClose: () => void;
  currentValue: string;
  triggerRect?: DOMRect;
}

const NotaSelector: React.FC<NotaSelectorProps> = ({
  onSelect,
  onClose,
  currentValue,
  triggerRect,
}) => {
  const position = useMemo(() => {
    if (!triggerRect) return "bottom" as const;

    const menuHeight = 220;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
      return "top" as const;
    }
    return "bottom" as const;
  }, [triggerRect]);

  const handleOptionClick = (e: React.MouseEvent, nota: string) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(nota);
  };

  // Verificar que tenemos coordenadas válidas
  if (!triggerRect || triggerRect.width === 0 || triggerRect.height === 0) {
    return null;
  }

  const topPosition = position === "bottom" ? triggerRect.bottom + 12 : triggerRect.top - 220;
  const leftPosition = triggerRect.right - 112;

  // Asegurar que no salga de la pantalla por la derecha
  const adjustedLeft = Math.max(10, Math.min(leftPosition, window.innerWidth - 122));

  const menuContent = (
    <div
      style={{
        position: "fixed",
        top: `${topPosition}px`,
        left: `${adjustedLeft}px`,
      }}
      className="w-28 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in z-[9999]"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Flechita decorativa */}
      <div
        className={`
          absolute w-4 h-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transform rotate-45
          ${position === "bottom" ? "-top-2 right-4 border-t border-l" : "-bottom-2 right-4 border-b border-r"}
        `}
      ></div>

      <div className="p-2 relative z-10 grid grid-cols-2 gap-1">
        {NOTA_OPTIONS.map((nota) => {
          const isSelected = currentValue === nota;

          let colorClass =
            "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-transparent";
          if (isSelected) {
            colorClass = "bg-blue-600 text-white border-blue-600 shadow-md font-extrabold";
          } else {
            const num = parseInt(nota);
            if (num >= 7)
              colorClass =
                "hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 hover:border-emerald-200 border-slate-100 dark:border-slate-700";
            else
              colorClass =
                "hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-600 hover:border-amber-200 border-slate-100 dark:border-slate-700";
          }

          return (
            <button
              key={nota}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // Evita que el botón pierda foco antes del click
              onClick={(e) => handleOptionClick(e, nota)}
              className={`
                        h-9 w-full rounded-lg font-bold text-sm border transition-all duration-150 flex items-center justify-center
                        ${colorClass}
                    `}
            >
              {nota}
            </button>
          );
        })}

        {/* Botón para limpiar nota */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => handleOptionClick(e, "Sin calificar")}
          className="col-span-1 h-9 rounded-lg border border-slate-100 dark:border-slate-700 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center justify-center"
          title="Borrar nota"
        >
          <span className="material-icons !text-sm">remove_circle_outline</span>
        </button>
      </div>
    </div>
  );

  return createPortal(menuContent, document.body);
};

export default NotaSelector;
