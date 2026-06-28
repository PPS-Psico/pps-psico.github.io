import React, { useState, useEffect, useRef, useId } from "react";

// Count-up hook to animate metrics numbers from 0 to target
function useCountUp(target: number, { duration = 1200, run = true } = {}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) {
      setVal(target);
      return;
    }
    let raf: number;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return Math.round(val);
}

// In-view hook to trigger animation when the component is scrolled into viewport
function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current || seen) return;
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            setSeen(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

interface RingMeterProps {
  value: number;
  total: number;
  size?: number;
}

export const RingMeter: React.FC<RingMeterProps> = ({ value, total, size = 196 }) => {
  const [ref, seen] = useInView();
  const gradId = `ringgrad-${useId().replace(/:/g, "")}`;
  const pct = Math.min(value / total, 1);
  const r = (size - 26) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const shown = useCountUp(value, { run: seen, duration: 1200 });

  return (
    <div ref={ref} className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#46253D" />
            <stop offset="50%" stopColor="#203B73" />
            <stop offset="100%" stopColor="#3CB88D" />
          </linearGradient>
        </defs>
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-sunken, #efece4)"
          strokeWidth="13"
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        {/* Animated progressive circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={seen ? c - dash : c}
          style={{
            transition: "stroke-dashoffset 1.3s cubic-bezier(.2,.7,.2,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="display font-extrabold text-slate-900 dark:text-white"
          style={{
            fontSize: 56,
            lineHeight: 0.9,
            letterSpacing: "-.05em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {shown}
        </div>
        <div
          className="mono text-slate-400 uppercase tracking-widest font-semibold"
          style={{
            fontSize: 10.5,
            marginTop: 4,
          }}
        >
          de {total} hs
        </div>
      </div>
    </div>
  );
};

interface MiniRingProps {
  pct: number;
  size?: number;
}

export const MiniRing: React.FC<MiniRingProps> = ({ pct, size = 56 }) => {
  const gradId = `miniringgrad-${useId().replace(/:/g, "")}`;
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#46253D" />
          <stop offset="50%" stopColor="#203B73" />
          <stop offset="100%" stopColor="#3CB88D" />
        </linearGradient>
      </defs>
      {/* Background circle */}
      <circle
        className="mini-ring__track stroke-slate-100 dark:stroke-slate-800"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth="5"
      />
      {/* Active progress circle */}
      <circle
        className="mini-ring__prog"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        stroke={`url(#${gradId})`}
        strokeDasharray={`${c}`}
        strokeDashoffset={c - dash}
        style={{
          transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)",
        }}
      />
    </svg>
  );
};
