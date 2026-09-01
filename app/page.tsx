// app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Globe2, Satellite, BellRing, Waves } from "lucide-react";

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-green-900/30 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <Icon className="h-8 w-8 text-green-600 dark:text-green-400 mb-3" />
      <h3 className="font-semibold text-lg mb-1 text-black dark:text-white">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

export default function LandingPage(): React.JSX.Element {
  return (
    <main className="flex flex-col items-center">
      <section className="w-full max-w-5xl px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-black dark:text-white">
          🌍 <span className="text-green-600 dark:text-green-400">EarthWatch</span> AI
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Real-time earthquake, wildfire, flood, storm and severe-weather monitoring —
          correlated by AI into plain-language warnings for the places you care about,
          minutes before it matters.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/sign-up">
            <Button className="bg-green-600 hover:bg-green-500 text-white px-6 py-6 text-base">
              Start Monitoring Free
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="px-6 py-6 text-base">
              View Live Dashboard
            </Button>
          </Link>
        </div>
      </section>

      <section className="w-full max-w-5xl px-6 pb-24 grid grid-cols-1 md:grid-cols-4 gap-5">
        <FeatureCard
          icon={Satellite}
          title="Live global feeds"
          description="USGS earthquakes, NASA EONET wildfires/storms/volcanoes, and NOAA severe-weather alerts, refreshed every few minutes."
        />
        <FeatureCard
          icon={Globe2}
          title="Watch any region"
          description="Drop a pin on any place — your home, family, or a project site — and set the radius that matters to you."
        />
        <FeatureCard
          icon={Waves}
          title="AI risk correlation"
          description="We don't just show raw data. An AI analyst combines severity, distance and recency into one score and a plain-English summary."
        />
        <FeatureCard
          icon={BellRing}
          title="Early alerts"
          description="When risk crosses a threshold for a region you're watching, you get an alert — not buried in noise."
        />
      </section>
    </main>
  );
}