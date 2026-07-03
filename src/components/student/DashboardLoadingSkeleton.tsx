import React from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { isEmbedded } from "../../utils/isEmbedded";
import AtlasTopbar from "./home/atlas/AtlasTopbar";

/**
 * Skeleton de carga del panel del estudiante.
 *
 * Versión de alta fidelidad y premium:
 * - Replica exactamente la estructura visual de las tarjetas reales (clases `.cc` y `.home-hero`).
 * - Usa los degradados reales de la marca UFLO en el Hero y Próximo Paso, con shimmers semi-transparentes.
 * - Elimina por completo los saltos de layout (Layout Shift) al coincidir exactamente en paddings, tipografías y proporciones.
 */

// Bloque de skeleton base con animación de brillo (shimmer) fluida.
const Sk: React.FC<{ className?: string; variant?: "default" | "brand" }> = ({
  className = "",
  variant = "default",
}) => {
  const baseBg = variant === "brand" ? "bg-white/20" : "bg-student-line dark:bg-[#142035]";

  const shimmerBg =
    variant === "brand"
      ? "from-transparent via-white/20 to-transparent"
      : "from-transparent via-white/50 to-transparent dark:via-white/[0.04]";

  return (
    <div className={`relative overflow-hidden rounded-lg ${baseBg} ${className}`}>
      <div
        className={`absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r ${shimmerBg}`}
      />
    </div>
  );
};

// Réplica perfecta de StudentConvCard.tsx (paddings y clases idénticas).
const SkConvCard: React.FC = () => (
  <div className="cc cc--skeleton pointer-events-none select-none">
    <div className="cc__top">
      <div className="cc__area flex items-center gap-1.5">
        {/* Dot del área */}
        <Sk className="h-2 w-2 rounded-full" />
        {/* Nombre de la orientación */}
        <Sk className="h-3 w-16" />
      </div>
      {/* Icono de reloj/candado */}
      <Sk className="h-4.5 w-4.5 rounded-full" />
    </div>

    {/* Nombre del lanzamiento */}
    <div className="cc__name mt-2">
      <Sk className="h-5 w-3/4" />
    </div>

    {/* Ventana de fechas */}
    <div className="cc__when mt-2 flex items-center gap-1.5">
      <Sk className="h-3.5 w-3.5 rounded" />
      <Sk className="h-3.5 w-32" />
    </div>

    {/* Footer de la tarjeta */}
    <div className="cc__foot mt-3.5 flex items-center justify-between">
      {/* Horas / Cupos */}
      <Sk className="h-3.5 w-24" />
      {/* Botón de acción */}
      <Sk className="h-7 w-20 rounded-lg" />
    </div>
  </div>
);

// Réplica perfecta de StudentSolicitudItem.tsx en el sidebar.
const SkSolicitudItem: React.FC = () => (
  <div className="relative flex items-center gap-3 border-b border-student-hairline py-3 last:border-b-0">
    <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-student-line dark:bg-[#142035]" />
    <div className="min-w-0 flex-1 pl-3 space-y-1.5">
      <Sk className="h-4 w-2/3" />
      <Sk className="h-3 w-1/3" />
    </div>
    <Sk className="h-5.5 w-16 rounded-full" />
  </div>
);

const DashboardLoadingSkeleton: React.FC = () => {
  const { resolvedTheme } = useTheme();

  return (
    <div
      className="ed ah-root animate-fade-in"
      data-mode={resolvedTheme}
      data-accent="teal"
      style={{
        background: isEmbedded() ? "transparent" : resolvedTheme === "dark" ? "#0a0e1a" : "#fafaf7",
        minHeight: "100vh",
      }}
    >
      {/* Barra superior real de Atlas para una transición limpia sin parpadeo */}
      <AtlasTopbar activeTab="inicio" onTabChange={() => {}} />

      <div className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-6 sm:px-6 lg:px-10">
        {/* Saludo de bienvenida */}
        <div className="mb-8 space-y-3">
          <Sk className="h-3.5 w-36" />
          <Sk className="h-9 w-2/3 max-w-sm sm:h-11" />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12">
          {/* COLUMNA LATERAL (Sidebar en Atlas desktop a la izquierda) */}
          <aside className="space-y-4 md:col-span-4 md:order-2">
            {/* Hero de resumen - Degradado real UFLO pero con textos y barras en skeleton */}
            <div className="home-hero pointer-events-none select-none">
              <div className="home-hero__grad" aria-hidden />
              <div className="home-hero__top">
                <div className="min-w-0 space-y-1.5">
                  <div className="mono home-hero__lbl">Avance PPS</div>
                  <Sk className="h-8 w-28" variant="brand" />
                </div>
                <Sk className="h-6 w-10 rounded-lg" variant="brand" />
              </div>

              {/* Barra de progreso skeleton */}
              <div className="home-hero__bar">
                <span className="w-full bg-white/20 relative overflow-hidden">
                  <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </span>
              </div>
              <Sk className="h-3.5 w-4/5 mt-2" variant="brand" />
            </div>

            {/* Próximo Paso - Fondo real UFLO con textos en skeleton */}
            <div
              className="relative overflow-hidden rounded-2xl p-5 text-white pointer-events-none select-none"
              style={{
                background: "linear-gradient(135deg, #2A1A2A 0%, #203B73 55%, #2F6E5C 100%)",
              }}
            >
              <div className="font-mono text-[10.5px] uppercase tracking-[.14em] text-white/40">
                Próximo paso
              </div>
              <Sk className="h-5 w-2/3 mt-2" variant="brand" />
              <Sk className="h-3.5 w-1/2 mt-1.5" variant="brand" />
              <div className="mt-4 flex items-center gap-2 border-t border-white/15 pt-3">
                <Sk className="h-3.5 w-20" variant="brand" />
                <Sk className="h-5 w-16 rounded-full ml-auto" variant="brand" />
              </div>
            </div>

            {/* Historial de Solicitudes */}
            <div className="rounded-2xl border border-student-line bg-student-bg-elevated p-5">
              <div className="mb-4">
                <Sk className="h-4 w-28" />
              </div>
              <div className="space-y-1">
                <SkSolicitudItem />
                <SkSolicitudItem />
                <SkSolicitudItem />
              </div>
            </div>
          </aside>

          {/* COLUMNA PRINCIPAL (Convocatorias) */}
          <div className="md:col-span-8 md:order-1 mt-5 md:mt-0">
            <div className="flex items-baseline justify-between mb-3.5">
              <Sk className="h-4.5 w-44" />
              <Sk className="h-3.5 w-8" />
            </div>

            {/* Grid de convocatorias */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SkConvCard />
              <SkConvCard />
              <SkConvCard />
              <SkConvCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardLoadingSkeleton;
