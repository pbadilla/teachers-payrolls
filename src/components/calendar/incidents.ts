import { CalendarOff, CloudRain, DoorOpen, type LucideIcon } from "lucide-react";
import type { DayIncident } from "@/types/calendar";

/** How each incident of a day is shown: in the day card and as a toggle in the day editor. */
export const INCIDENT_STYLES: Record<DayIncident, { label: string; icon: LucideIcon; className: string }> = {
  rain: { label: "Pluja", icon: CloudRain, className: "bg-sky-100 text-sky-800 border-sky-300" },
  "open-day": { label: "Portes obertes", icon: DoorOpen, className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  holiday: { label: "Festiu", icon: CalendarOff, className: "bg-amber-100 text-amber-800 border-amber-300" },
};
