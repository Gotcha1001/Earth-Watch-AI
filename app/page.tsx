// app/page.tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Satellite,
  Globe2,
  Waves,
  BellRing,
  Flame,
  Wind,
  Activity,
} from "lucide-react";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-hud",
});

interface FeatureCardProps {
  code: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const FEATURES: FeatureCardProps[] = [
  {
    code: "SEIS",
    icon: Satellite,
    title: "Live global feeds",
    description:
      "USGS earthquakes, NASA EONET wildfires and volcanoes, and NOAA severe-weather alerts, pulled in every few minutes.",
  },
  {
    code: "GEO",
    icon: Globe2,
    title: "Watch any region",
    description:
      "Drop a pin on any place — your home, family, or a project site — and set the radius that matters to you.",
  },
  {
    code: "CORE",
    icon: Waves,
    title: "AI risk correlation",
    description:
      "Severity, distance and recency, combined into one score and a plain-English read of what it means for you.",
  },
  {
    code: "PING",
    icon: BellRing,
    title: "Early alerts",
    description:
      "When risk crosses your threshold, you hear about it — not buried under a feed of everything, everywhere.",
  },
];

function FeatureCard({
  code,
  icon: Icon,
  title,
  description,
}: FeatureCardProps) {
  return (
    <motion.div
      className="group relative border border-cyan-400/15 bg-[#0a1219]/70 p-6 text-left backdrop-blur-md transition hover:border-cyan-300/35"
      variants={{
        hidden: { opacity: 0, y: 32 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      whileHover={{ y: -3 }}
    >
      {/* HUD corner brackets */}
      <span className="pointer-events-none absolute -left-px -top-px h-3 w-3 border-l border-t border-cyan-400/40" />
      <span className="pointer-events-none absolute -right-px -top-px h-3 w-3 border-r border-t border-cyan-400/40" />
      <span className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b border-l border-cyan-400/40" />
      <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b border-r border-cyan-400/40" />

      <motion.div
        className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent opacity-0 group-hover:opacity-100"
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
      />

      <div className="mb-3 font-[family-name:var(--font-hud)] text-[10px] tracking-widest text-cyan-300/60">
        {code}
      </div>
      <div className="mb-4 flex h-10 w-10 items-center justify-center border border-orange-500/25 bg-gradient-to-br from-red-600/15 to-transparent">
        <Icon className="h-5 w-5 text-orange-300" />
      </div>
      <h3 className="mb-2 text-base font-medium text-[#f1f5f4]">{title}</h3>
      <p className="font-[family-name:var(--font-hud)] text-[13px] leading-relaxed text-[#f1f5f4]/50">
        {description}
      </p>
    </motion.div>
  );
}

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

const fadeUp = {
  hidden: { opacity: 0, y: 26, filter: "blur(6px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      delay: 0.12 * i,
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

// A seismograph-style jitter, not a smooth pulse
const tremor = {
  x: [0, -2, 3, -3, 2, -1, 0],
  y: [0, 1, -1, 1, -2, 1, 0],
};

const OUTER_ORBIT = [
  { label: "Earthquakes", icon: Activity },
  { label: "Wildfires", icon: Flame },
  { label: "Storms", icon: Wind },
  { label: "Floods", icon: Waves },
];
const INNER_ORBIT = ["Watchlist", "Alerts"];

function orbitPosition(index: number, count: number, radius: number) {
  const angle = (360 / count) * index - 90;
  const rad = (angle * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

export default function LandingPage() {
  const reduceMotion = useReducedMotion();
  const spin = (reverse = false) =>
    reduceMotion ? undefined : { rotate: reverse ? -360 : 360 };
  const spinTransition = (duration: number) =>
    reduceMotion
      ? { duration: 0 }
      : { duration, repeat: Infinity, ease: "linear" as const };

  return (
    <main
      className={`${fraunces.variable} ${plexMono.variable} relative flex min-h-screen flex-col items-center overflow-hidden bg-[#04070a] px-6 text-center`}
    >
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
            animate={reduceMotion ? undefined : { y: ["-30%", "130%"] }}
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

          {/* pulsing core */}
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

      <div className="pt-24" />

      {/* sigil */}
      <motion.div
        className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/30 bg-[#0a1219]/70 shadow-[0_0_30px_-6px_rgba(220,38,38,0.7)] backdrop-blur-md"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 16 }}
      >
        <motion.div
          animate={reduceMotion ? undefined : { opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Activity className="h-6 w-6 text-orange-300" />
        </motion.div>
      </motion.div>

      <motion.div
        className="relative z-10 flex items-center gap-3 font-[family-name:var(--font-hud)] text-sm text-cyan-200/70"
        custom={0}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
      >
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-cyan-300"
          animate={reduceMotion ? undefined : { opacity: [1, 0.25, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
        The ground keeps a record of everything
      </motion.div>

      <div className="relative z-10 mt-4">
        <h1 className="font-[family-name:var(--font-display)] text-5xl italic tracking-tight text-[#f1f5f4] md:text-7xl">
          <motion.span
            className="not-italic"
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            Earth
          </motion.span>{" "}
          <motion.span
            className="inline-block bg-gradient-to-r from-red-500 via-orange-400 to-red-500 bg-clip-text text-transparent"
            custom={1.4}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            {...(!reduceMotion && {
              animate: { ...fadeUp.visible(1.4), ...tremor },
              transition: {
                delay: 1.1,
                duration: 0.6,
                repeat: Infinity,
                repeatDelay: 3.4,
              },
            })}
          >
            Watch
          </motion.span>{" "}
          <motion.span
            className="not-italic text-2xl text-cyan-300/70 md:text-3xl align-top"
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            AI
          </motion.span>
        </h1>
      </div>

      <motion.p
        className="relative z-10 mt-5 max-w-xl font-[family-name:var(--font-hud)] text-[15px] leading-relaxed text-[#f1f5f4]/55"
        custom={2}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
      >
        Earthquakes, wildfires, floods and storms, tracked in real time and read
        by an AI analyst into plain-language warnings for the places you care
        about — minutes before it matters.
      </motion.p>

      {/* orbit of disaster types + watchlist */}
      <div className="relative z-10 my-10 h-72 w-72">
        <motion.div
          className="absolute inset-0"
          animate={spin()}
          transition={spinTransition(38)}
        >
          {OUTER_ORBIT.map((item, i) => {
            const { x, y } = orbitPosition(i, OUTER_ORBIT.length, 130);
            return (
              <div
                key={item.label}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                }}
              >
                <motion.span
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-orange-500/30 bg-[#0a1219]/70 px-3 py-1 font-[family-name:var(--font-hud)] text-xs text-[#f1f5f4]/85 shadow-[0_0_16px_-4px_rgba(220,38,38,0.7)] backdrop-blur-sm"
                  animate={spin(true)}
                  transition={spinTransition(38)}
                  whileHover={{ scale: 1.1 }}
                >
                  <item.icon className="h-3 w-3 text-orange-300" />
                  {item.label}
                </motion.span>
              </div>
            );
          })}
        </motion.div>

        <motion.div
          className="absolute inset-0"
          animate={spin(true)}
          transition={spinTransition(21)}
        >
          {INNER_ORBIT.map((name, i) => {
            const { x, y } = orbitPosition(i, INNER_ORBIT.length, 60);
            return (
              <div
                key={name}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                }}
              >
                <motion.span
                  className="block whitespace-nowrap rounded-full border border-cyan-400/30 bg-[#0a1219]/80 px-2.5 py-1 font-[family-name:var(--font-hud)] text-[11px] text-cyan-100/85 shadow-[0_0_14px_-4px_rgba(34,211,238,0.6)] backdrop-blur-sm"
                  animate={spin()}
                  transition={spinTransition(21)}
                  whileHover={{ scale: 1.1 }}
                >
                  {name}
                </motion.span>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* CTAs */}
      <motion.div
        className="relative z-10 flex flex-wrap justify-center gap-4"
        custom={3}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
      >
        <Link href="/sign-up">
          <Button className="border border-orange-400/40 bg-gradient-to-r from-red-600 to-orange-500 px-8 py-6 text-base text-[#f1f5f4] shadow-[0_0_35px_-8px_rgba(220,38,38,0.9)] transition hover:shadow-[0_0_45px_-6px_rgba(249,115,22,0.9)]">
            Start monitoring free
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button
            variant="outline"
            className="border-cyan-400/30 bg-[#0a1219]/50 px-8 py-6 text-base text-cyan-100 backdrop-blur-sm hover:bg-[#0a1219]/80"
          >
            View live dashboard
          </Button>
        </Link>
      </motion.div>

      {/* feature panels */}
      <motion.div
        className="relative z-10 mt-24 grid w-full max-w-5xl gap-5 pb-28 sm:grid-cols-2 lg:grid-cols-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.1 } },
        }}
      >
        {FEATURES.map((f) => (
          <FeatureCard key={f.code} {...f} />
        ))}
      </motion.div>
    </main>
  );
}
