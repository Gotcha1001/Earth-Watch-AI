// app/dashboard/regions/page.tsx
"use client";
import { useState, type FormEvent } from "react";
import { useRegionRisk } from "@/hooks/useRegionRisk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";

interface FormState {
  name: string;
  latitude: string;
  longitude: string;
  radiusKm: string;
}

const EMPTY_FORM: FormState = { name: "", latitude: "", longitude: "", radiusKm: "50" };

export default function RegionsPage(): React.JSX.Element {
  const { regions, addRegion, removeRegion } = useRegionRisk();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const latitude = Number.parseFloat(form.latitude);
    const longitude = Number.parseFloat(form.longitude);
    const radiusKm = Number.parseFloat(form.radiusKm);
    if (!form.name || Number.isNaN(latitude) || Number.isNaN(longitude) || Number.isNaN(radiusKm)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await addRegion({ name: form.name, latitude, longitude, radiusKm });
      setForm(EMPTY_FORM);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4 dark:border-green-900/30">
        <h2 className="font-semibold text-black dark:text-white">Add a region to watch</h2>
        <Input
          placeholder="Name (e.g. Kathmandu Valley)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            placeholder="Latitude"
            value={form.latitude}
            onChange={(e) => setForm({ ...form, latitude: e.target.value })}
          />
          <Input
            placeholder="Longitude"
            value={form.longitude}
            onChange={(e) => setForm({ ...form, longitude: e.target.value })}
          />
          <Input
            placeholder="Radius (km)"
            value={form.radiusKm}
            onChange={(e) => setForm({ ...form, radiusKm: e.target.value })}
          />
        </div>
        <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-500 text-white">
          {isSubmitting ? "Adding…" : "Add Region"}
        </Button>
      </form>

      <div className="space-y-2">
        {regions.map((region) => (
          <div
            key={region._id}
            className="flex items-center justify-between rounded-md border p-3 dark:border-green-900/30"
          >
            <div>
              <p className="font-medium text-black dark:text-white">{region.name}</p>
              <p className="text-xs text-gray-500">
                {region.latitude.toFixed(3)}, {region.longitude.toFixed(3)} · {region.radiusKm} km radius
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeRegion(region._id)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}