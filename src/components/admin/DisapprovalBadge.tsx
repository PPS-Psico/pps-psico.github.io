import React from "react";
import { formatDate } from "../../utils/formatters";

interface DisapprovalBadgeProps {
  disapprovals: Array<{
    practicaId: string;
    lanzamientoId: string | null;
    nombreInstitucion: string;
    fecha: string | null;
  }>;
}

const DisapprovalBadge: React.FC<DisapprovalBadgeProps> = ({ disapprovals }) => {
  if (disapprovals.length === 0) return null;

  const title = disapprovals
    .map(
      (item) =>
        `Desaprobada: ${item.nombreInstitucion}${item.fecha ? ` · ${formatDate(item.fecha)}` : ""}`
    )
    .join("\n");

  return (
    <span className="lv4-badge lv4-badge-danger-strong" title={title}>
      <span className="material-icons">report</span>
      {disapprovals.length === 1 ? "PPS desaprobada" : `${disapprovals.length} PPS desaprobadas`}
    </span>
  );
};

export default DisapprovalBadge;
