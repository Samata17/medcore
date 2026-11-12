const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPrecise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export const formatCurrency = (n: number, precise = false) => (precise ? inrPrecise : inr).format(n);
export const formatCompact = (n: number) => compact.format(n);
export const formatNumber = (n: number) => n.toLocaleString("en-IN");

export function formatDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(iso).toLocaleDateString("en-IN", opts);
}

export function formatTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function formatDateTime(iso: string | Date) {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** "5 min ago", "3 h ago", "2 d ago" */
export function formatRelative(iso: string | Date) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return formatDate(iso);
}

/** Age in whole years from a date of birth. */
export function ageFrom(dob: string) {
  const b = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--;
  return age;
}

/** BMI = weight(kg) / height(m)^2, rounded to one decimal. */
export function calculateBmi(weightKg?: number, heightCm?: number) {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: "Underweight", tone: "warning" as const };
  if (bmi < 25) return { label: "Normal", tone: "success" as const };
  if (bmi < 30) return { label: "Overweight", tone: "warning" as const };
  return { label: "Obese", tone: "danger" as const };
}
