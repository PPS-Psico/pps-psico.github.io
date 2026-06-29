import React from "react";

// Premium shimmer effect with gradient animation
export const SkeletonShimmer: React.FC<{ className?: string; children?: React.ReactNode }> = ({
  className = "",
  children,
}) => (
  <div className={`relative overflow-hidden ${className}`}>
    {children}
    <div
      className="absolute inset-0 -translate-x-full animate-shimmer"
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
      }}
    />
  </div>
);

// Individual skeleton box with shimmer
export const SkeletonBox: React.FC<{ className?: string }> = ({ className = "" }) => (
  <SkeletonShimmer className={`bg-slate-200 dark:bg-slate-700 rounded-lg ${className}`}>
    <div className="w-full h-full" />
  </SkeletonShimmer>
);

// Skeleton for circular elements (avatars, progress circles)
export const SkeletonCircle: React.FC<{ className?: string; size?: "sm" | "md" | "lg" | "xl" }> = ({
  className = "",
  size = "md",
}) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-20 h-20",
    xl: "w-40 h-40",
  };

  return (
    <SkeletonShimmer
      className={`${sizeClasses[size]} rounded-full bg-slate-200 dark:bg-slate-700 ${className}`}
    >
      <div className="w-full h-full rounded-full" />
    </SkeletonShimmer>
  );
};

// Skeleton for text lines
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  lineClassName?: string;
}> = ({ lines = 1, className = "", lineClassName = "" }) => (
  <div className={`space-y-2 ${className}`}>
    {[...Array(lines)].map((_, i) => (
      <SkeletonBox
        key={i}
        className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"} ${lineClassName}`}
      />
    ))}
  </div>
);

// Skeleton for cards
export const SkeletonCard: React.FC<{ className?: string; hasImage?: boolean }> = ({
  className = "",
  hasImage = true,
}) => (
  <div
    className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}
  >
    <div className="flex gap-4">
      {hasImage && <SkeletonCircle size="lg" />}
      <div className="flex-1 space-y-3">
        <SkeletonBox className="h-6 w-3/4" />
        <SkeletonText lines={2} />
      </div>
    </div>
  </div>
);

// Criterios Panel Skeleton
export const CriteriosPanelSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-lg">
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3 flex flex-col sm:flex-row items-center gap-8">
        <SkeletonCircle size="xl" />
        <div className="flex-1 w-full space-y-4">
          <SkeletonBox className="h-8 w-3/4" />
          <SkeletonText lines={2} />
        </div>
      </div>
      <div className="lg:col-span-2 flex flex-col justify-center gap-8 border-t-2 lg:border-t-0 lg:border-l-2 border-slate-200/60 dark:border-slate-700 pt-8 lg:pt-0 lg:pl-8">
        <div className="space-y-3">
          <SkeletonBox className="h-6 w-1/2" />
          <SkeletonBox className="h-4 w-full" />
        </div>
        <div className="space-y-3">
          <SkeletonBox className="h-6 w-1/2" />
          <SkeletonBox className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

// Table Skeleton with headers
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => (
  <div className="space-y-3">
    {/* Header */}
    <div className="flex items-center gap-4 p-3 border-b border-slate-200 dark:border-slate-700">
      {[...Array(columns)].map((_, i) => (
        <SkeletonBox key={i} className="h-6 flex-1" />
      ))}
    </div>
    {/* Rows */}
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-3">
        {[...Array(columns)].map((_, j) => (
          <SkeletonBox key={j} className="h-8 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

// List Skeleton
export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 4 }) => (
  <div className="space-y-3">
    {[...Array(items)].map((_, i) => (
      <SkeletonCard key={i} hasImage={i % 2 === 0} />
    ))}
  </div>
);

// Editorial (Paper & Ink) skeleton block — usado por el skeleton del panel admin
// para que coincida con su sistema visual real (tokens --paper/--ink/--rule),
// en lugar de las tarjetas blancas "slate" del diseño anterior.
const InkSkeleton: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div
    className="relative overflow-hidden"
    style={{ background: "var(--paper-3)", borderRadius: 12, ...style }}
  >
    <div
      className="absolute inset-0 -translate-x-full animate-shimmer"
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, rgba(127,127,127,0.14) 50%, transparent 100%)",
      }}
    />
  </div>
);

// Admin Dashboard Skeleton · replica la estructura real del dashboard
// (PageHead → Briefing → bandas de métricas → borradores/prioridades) sobre el
// fondo "paper", para que no aparezcan los widgets viejos durante la carga.
export const AdminDashboardSkeleton: React.FC = () => (
  <div
    style={{
      minHeight: "100vh",
      background: "var(--paper)",
      color: "var(--ink)",
      fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
    }}
  >
    <div
      className="animate-fade-in"
      style={{ maxWidth: 1280, margin: "0 auto", padding: "32px clamp(16px, 5vw, 48px) 64px" }}
    >
      {/* PageHead */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
          marginBottom: 32,
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <InkSkeleton style={{ height: 14, width: 180 }} />
          <InkSkeleton style={{ height: 40, width: "55%", maxWidth: 420 }} />
          <InkSkeleton style={{ height: 16, width: "40%", maxWidth: 320 }} />
        </div>
        <InkSkeleton style={{ height: 40, width: 140, borderRadius: 999 }} />
      </div>

      {/* Briefing (tarjeta hero) */}
      <div
        style={{
          border: "1px solid var(--rule-2)",
          borderRadius: 24,
          padding: 28,
          marginBottom: 28,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <InkSkeleton style={{ height: 14, width: 120 }} />
        <InkSkeleton style={{ height: 28, width: "70%" }} />
        <InkSkeleton style={{ height: 16, width: "85%" }} />
        <InkSkeleton style={{ height: 16, width: "60%" }} />
      </div>

      {/* Bandas de métricas (DetectionBand + SolicitudesBand) */}
      {[0, 1].map((band) => (
        <div
          key={band}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                border: "1px solid var(--rule-2)",
                borderRadius: 16,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <InkSkeleton style={{ height: 12, width: "60%" }} />
              <InkSkeleton style={{ height: 30, width: 56 }} />
              <InkSkeleton style={{ height: 12, width: "80%" }} />
            </div>
          ))}
        </div>
      ))}

      {/* Borradores + Prioridades */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
          marginTop: 8,
        }}
      >
        {[0, 1].map((col) => (
          <div
            key={col}
            style={{
              border: "1px solid var(--rule-2)",
              borderRadius: 20,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <InkSkeleton style={{ height: 16, width: "45%" }} />
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <InkSkeleton style={{ height: 36, width: 36, borderRadius: 10 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <InkSkeleton style={{ height: 13, width: "75%" }} />
                  <InkSkeleton style={{ height: 11, width: "50%" }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Metrics Skeleton
export const MetricsSkeleton: React.FC = () => (
  <div className="space-y-6 animate-fade-in">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700"
        >
          <SkeletonBox className="h-6 w-24 mb-4" />
          <SkeletonBox className="h-12 w-20" />
          <div className="mt-4 flex items-center gap-2">
            <SkeletonBox className="h-4 w-16" />
            <SkeletonCircle size="sm" />
          </div>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl h-96 border border-slate-200 dark:border-slate-700">
        <SkeletonBox className="h-8 w-1/3 mb-6" />
        <div className="h-64 flex items-end justify-around gap-4">
          {[...Array(7)].map((_, i) => {
            const heights = ["h-16", "h-24", "h-32", "h-20", "h-28", "h-36", "h-22"];
            return (
              <div key={i} className="flex-1">
                <SkeletonBox className={`w-full ${heights[i]}`} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl h-96 border border-slate-200 dark:border-slate-700">
        <SkeletonBox className="h-8 w-1/3 mb-6" />
        <SkeletonCircle size="xl" className="mx-auto mb-4" />
        <SkeletonText lines={3} className="max-w-xs mx-auto" />
      </div>
    </div>
  </div>
);

// Form Skeleton
export const FormSkeleton: React.FC<{ fields?: number }> = ({ fields = 6 }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[...Array(fields)].map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonBox className="h-5 w-32" />
          <SkeletonBox className="h-12 w-full rounded-xl" />
        </div>
      ))}
    </div>
    <div className="flex gap-4 pt-4">
      <SkeletonBox className="h-12 w-32 rounded-xl" />
      <SkeletonBox className="h-12 w-32 rounded-xl" />
    </div>
  </div>
);

// Convocatoria Card Skeleton
export const ConvocatoriaCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-slate-800 rounded-[24px] p-6 md:p-8 border border-slate-200/60 dark:border-slate-800/60 shadow-lg">
    <div className="flex justify-between items-start gap-4 mb-6">
      <div className="flex-1">
        <SkeletonBox className="h-8 w-3/4 mb-3" />
        <div className="flex gap-2">
          <SkeletonBox className="h-6 w-24 rounded-lg" />
          <SkeletonBox className="h-6 w-20 rounded-lg" />
        </div>
      </div>
      <SkeletonBox className="h-12 w-32 rounded-xl" />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {[...Array(4)].map((_, i) => (
        <SkeletonBox key={i} className="h-20 rounded-2xl" />
      ))}
    </div>
    <SkeletonText lines={3} />
  </div>
);
