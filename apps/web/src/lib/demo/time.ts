/** Helpers that keep SAMPLE DATA dates relative to "now" so demos look current. */

export const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
export const hoursAgo = (h: number) => minutesAgo(h * 60);
export const daysAgo = (d: number) => minutesAgo(d * 1440);
export const daysFromNow = (d: number) => minutesAgo(-d * 1440);

/** Today at HH:MM local time. */
export function todayAt(hhmm: string, dayOffset = 0) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** Last N day labels ending today, e.g. ["Mon", "Tue", ...]. */
export function lastDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toLocaleDateString("en-IN", { weekday: "short" });
  });
}

/** Last N date labels ending today, e.g. ["18 Oct", "19 Oct", ...]. */
export function lastDates(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  });
}

/** Last N month labels ending this month, e.g. ["May", "Jun", ...]. */
export function lastMonths(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (n - 1 - i));
    return d.toLocaleDateString("en-IN", { month: "short" });
  });
}
