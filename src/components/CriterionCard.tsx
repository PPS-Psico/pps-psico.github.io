import React, { useMemo } from "react";

interface CriterionCardProps {
  children: React.ReactNode;
  isComplete: boolean;
  /** Permite deshabilitar animaciones hover */
  disableHover?: boolean;
}

const CriterionCard: React.FC<CriterionCardProps> = ({
  children,
  isComplete,
  disableHover = false,
}) => {
  const cardStyles = useMemo(() => {
    const baseClasses = `
      relative bg-white/50 border rounded-xl p-5 flex flex-col justify-center
      transition duration-300 ease-in-out
    `;

    const hoverClasses = !disableHover
      ? "hover:shadow-lg hover:border-slate-300/70 hover:-translate-y-0.5"
      : "";

    const statusClasses = isComplete
      ? `border-emerald-300/70 shadow-md shadow-emerald-500/5`
      : "border-slate-200/80 shadow-sm shadow-slate-500/5";

    return `${baseClasses} ${hoverClasses} ${statusClasses}`.trim();
  }, [isComplete, disableHover]);

  const CompletionBadge: React.FC = () => {
    if (!isComplete) return null;

    return (
      <div
        className="absolute -top-2.5 -right-2.5 bg-gradient-to-br from-emerald-400 to-green-500 text-white rounded-full h-6 w-6 flex items-center justify-center shadow-md border-2 border-white"
        aria-label="Criterio completado"
      >
        <span className="material-icons !text-sm">check</span>
      </div>
    );
  };

  return (
    <article style={{ willChange: "transform, box-shadow" }} className={cardStyles}>
      <CompletionBadge />
      <div className="relative z-10">{children}</div>
    </article>
  );
};

export default CriterionCard;
