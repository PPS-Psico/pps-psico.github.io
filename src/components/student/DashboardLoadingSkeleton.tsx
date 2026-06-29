import React from "react";
import { useTheme } from "../../contexts/ThemeContext";
import AtlasTopbar from "./home/atlas/AtlasTopbar";

/**
 * Skeleton de carga del panel del estudiante.
 *
 * Antes mostraba tarjetas blancas tipo "slate" (el diseño viejo), que durante
 * el segundo de carga chocaban visualmente con el panel editorial real
 * (Paper & Ink). Ahora replica la estructura real: la misma topbar Atlas y
 * bloques de skeleton tintados con los tokens del sistema, sobre el mismo
 * fondo "paper", para que la transición a contenido sea imperceptible.
 */

// Bloque base con shimmer, tintado con los tokens del panel del estudiante.
const Sk: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`relative overflow-hidden rounded-xl bg-student-bg-sunken ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent dark:via-white/[0.06]" />
  </div>
);

// Tarjeta de convocatoria (mimetiza StudentConvCard).
const SkConvCard: React.FC = () => (
  <div className="space-y-4 rounded-2xl border border-student-line bg-student-bg-elevated p-5">
    <div className="flex items-start justify-between gap-3">
      <Sk className="h-5 w-2/3" />
      <Sk className="h-6 w-16 rounded-full" />
    </div>
    <Sk className="h-3.5 w-1/2" />
    <div className="flex gap-2 pt-1">
      <Sk className="h-7 w-20 rounded-lg" />
      <Sk className="h-7 w-24 rounded-lg" />
    </div>
  </div>
);

const DashboardLoadingSkeleton: React.FC = () => {
  const { resolvedTheme } = useTheme();

  return (
    <div
      className="ed animate-fade-in"
      data-mode={resolvedTheme}
      data-accent="teal"
      style={{
        background: resolvedTheme === "dark" ? "#0a0e1a" : "#fafaf7",
        minHeight: "100vh",
      }}
    >
      {/* Misma barra superior que el panel real: aparece al instante y se
          mantiene idéntica cuando carga el contenido (sin parpadeo). */}
      <AtlasTopbar activeTab="inicio" onTabChange={() => {}} />

      <div className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-6 sm:px-6 lg:px-10">
        {/* Saludo editorial */}
        <div className="mb-8 space-y-3">
          <Sk className="h-3 w-40" />
          <Sk className="h-10 w-2/3 max-w-md sm:h-12" />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12">
          {/* Columna principal · convocatorias */}
          <div className="space-y-4 md:col-span-8">
            <div className="flex items-baseline justify-between">
              <Sk className="h-3 w-44" />
              <Sk className="h-3 w-10" />
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <SkConvCard />
              <SkConvCard />
              <SkConvCard />
              <SkConvCard />
            </div>
          </div>

          {/* Sidebar · resumen del estudiante */}
          <aside className="space-y-4 md:col-span-4">
            {/* Tarjeta de resumen (anillo de progreso + horas) */}
            <div className="space-y-4 rounded-2xl border border-student-line bg-student-bg-elevated p-5">
              <Sk className="h-3 w-24" />
              <div className="flex items-center gap-4">
                <Sk className="h-20 w-20 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Sk className="h-6 w-3/4" />
                  <Sk className="h-3.5 w-1/2" />
                </div>
              </div>
              <Sk className="h-2.5 w-full rounded-full" />
            </div>

            {/* Próximo paso */}
            <div className="space-y-3 rounded-2xl border border-student-line bg-student-bg-elevated p-5">
              <Sk className="h-3 w-28" />
              <Sk className="h-4 w-full" />
              <Sk className="h-4 w-5/6" />
            </div>

            {/* Lista (solicitudes / historial) */}
            <div className="space-y-3 rounded-2xl border border-student-line bg-student-bg-elevated p-5">
              <Sk className="h-3 w-24" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Sk className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Sk className="h-3.5 w-3/4" />
                    <Sk className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DashboardLoadingSkeleton;
