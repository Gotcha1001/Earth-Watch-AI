"use client";

import { motion, useReducedMotion } from "framer-motion";

// Fixed seismic-ping positions — avoids SSR/client hydration mismatch
const PULSES = [
  { top: "10%", left: "16%", delay: 0 },
  { top: "20%", left: "80%", delay: 0.8 },
  { top: "34%", left: "8%", delay: 1.6 },
  { top: "14%", left: "50%", delay: 0.4 },
  { top: "46%", left: "90%", delay: 1.2 },
  { top: "64%", left: "12%", delay: 0.2 },
  { top: "72%", left: "86%", delay: 1.9 },
  { top: "82%", left: "22%", delay: 0.6 },
  { top: "86%", left: "64%", delay: 1.4 },
  { top: "6%", left: "70%", delay: 2.2 },
  { top: "52%", left: "4%", delay: 1.0 },
  { top: "40%", left: "60%", delay: 0.3 },
];

// Falling data-readout columns, standing in for matrix rain
const READOUTS = [
  ["M 6.1", "34.05°N", "118.24°W", "ΔT +2.3", "UTC 03:12"],
  ["VEI 3", "9.42°S", "121.7°E", "km 14", "AQI 187"],
  ["M 4.8", "40.71°N", "74.00°W", "+0.9Δ", "UTC 14:55"],
  ["kt 95", "25.76°N", "80.19°W", "mbar 962", "km/h 140"],
  ["M 5.5", "35.68°N", "139.65°E", "ΔT +1.1", "UTC 09:03"],
  ["ha 1.2k", "37.77°N", "122.41°W", "RH 11%", "wind 44"],
  ["M 7.0", "-6.20°S", "106.84°E", "+3.6Δ", "UTC 21:40"],
  ["mm 88", "51.50°N", "0.12°W", "flow 3.4", "UTC 06:18"],
];

const RAIN_COLUMNS = Array.from({ length: 10 }).map((_, i) => ({
  left: `${(i / 9) * 100}%`,
  tokens: READOUTS[i % READOUTS.length],
  duration: 13 + (i % 5) * 2.4,
  delay: (i % 7) * 1.1,
}));

const GRID_BG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg stroke='%2322d3ee' stroke-opacity='0.35' stroke-width='1'%3E%3Cpath d='M30 24v12M24 30h12'/%3E%3C/g%3E%3C/svg%3E";

export default function MatrixBackground() {
  const reduceMotion = useReducedMotion();
  const spin = (reverse = false) =>
    reduceMotion ? undefined : { rotate: reverse ? -360 : 360 };
  const spinTransition = (duration: number) =>
    reduceMotion
      ? { duration: 0 }
      : { duration, repeat: Infinity, ease: "linear" as const };

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#04070a]">
      {/* coordinate-grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: `url("${GRID_BG}")`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#0a1219_0%,_#04070a_70%)]" />

        {/* falling data readouts */}
        {RAIN_COLUMNS.map((col, i) => (
          <motion.div
            key={i}
            className="absolute top-0 flex flex-col gap-7 font-[family-name:var(--font-hud)]"
            style={{
              left: col.left,
              fontSize: 11,
              color:
                i % 2 === 0 ? "rgba(34,211,238,0.35)" : "rgba(220,38,38,0.3)",
              maskImage:
                "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
            }}
            animate={reduceMotion ? undefined : { y: ["-20vh", "120vh"] }}
            transition={{
              duration: col.duration,
              repeat: Infinity,
              delay: col.delay,
              ease: "linear",
            }}
          >
            {col.tokens.map((t, j) => (
              <span key={j}>{t}</span>
            ))}
          </motion.div>
        ))}

        {/* seismic ping dots */}
        {PULSES.map((p, i) => (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-cyan-300"
            style={{ top: p.top, left: p.left }}
            animate={
              reduceMotion
                ? undefined
                : { opacity: [0, 0.8, 0], scale: [0.6, 1.6, 0.6] }
            }
            transition={{
              duration: 2.4,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeOut",
            }}
          />
        ))}

        {/* radar sweep */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            className="h-[720px] w-[720px] rounded-full opacity-25 blur-2xl"
            style={{
              background:
                "conic-gradient(from 0deg, #dc2626, #f97316, #04070a 40%, #04070a 90%, #dc2626)",
            }}
            animate={spin()}
            transition={spinTransition(48)}
          />
          <motion.div
            className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-xl"
            style={{
              background:
                "conic-gradient(from 90deg, #22d3ee, #0e7490 20%, #04070a 60%, #04070a 95%, #22d3ee)",
            }}
            animate={spin(true)}
            transition={spinTransition(30)}
          />
          {[560, 460, 360].map((size, i) => (
            <motion.div
              key={size}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
              style={{
                width: size,
                height: size,
                borderColor:
                  i === 1 ? "rgba(220,38,38,0.18)" : "rgba(34,211,238,0.2)",
              }}
              animate={spin(i % 2 === 0)}
              transition={spinTransition(70 - i * 12)}
            />
          ))}
          <motion.div
            className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400 blur-2xl"
            animate={
              reduceMotion
                ? undefined
                : { opacity: [0.5, 1, 0.5], scale: [0.9, 1.15, 0.9] }
            }
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_32%,_#04070a_88%)]" />
      </div>
    </div>
  );
}
