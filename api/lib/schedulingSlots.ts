import type { BookingRecord, DayAvailability, SchedulingProfile } from "./growthMemoryStore";

function parseHm(s: string): number {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return h * 60 + (m || 0);
}

function hmFromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function slotsForDate(
  profile: SchedulingProfile,
  dateIso: string,
  bookings: BookingRecord[],
): { start: string; end: string; label: string }[] {
  const d = new Date(`${dateIso}T12:00:00.000Z`);
  const weekday = d.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const rule = profile.availability.find((a: DayAvailability) => a.weekday === weekday);
  if (!rule || !rule.enabled) return [];

  const startM = parseHm(rule.start);
  const endM = parseHm(rule.end);
  const step = Math.max(15, profile.slotMinutes);
  const out: { start: string; end: string; label: string }[] = [];

  for (let t = startM; t + step <= endM; t += step) {
    const startStr = `${dateIso}T${hmFromMinutes(t)}:00.000Z`;
    const endStr = `${dateIso}T${hmFromMinutes(t + step)}:00.000Z`;
    const startMs = Date.parse(startStr);
    const endMs = Date.parse(endStr);
    const clash = bookings.some((b) => {
      const bs = Date.parse(b.start);
      const be = Date.parse(b.end);
      return bs < endMs && be > startMs;
    });
    if (!clash) {
      out.push({
        start: startStr,
        end: endStr,
        label: `${hmFromMinutes(t)} – ${hmFromMinutes(t + step)}`,
      });
    }
  }
  return out;
}
