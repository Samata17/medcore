import type { PrismaService } from "../prisma/prisma.service";

/** Display names for a set of user ids ("Dr. Kavita Sharma" for doctors). */
export async function userNames(prisma: PrismaService, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Map<string, string>();
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true, role: true } });
  return new Map(users.map((u) => [u.id, `${u.role === "DOCTOR" ? "Dr. " : ""}${u.firstName} ${u.lastName}`]));
}

export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;
export const doctorName = (d: { user: { firstName: string; lastName: string } }) => `Dr. ${d.user.firstName} ${d.user.lastName}`;

/** Start of today and tomorrow in the server's timezone. */
export function todayRange() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  return { from, to: new Date(from.getTime() + 86_400_000) };
}

/** Prisma Decimal → number with 2 decimals for JSON responses. */
export const money = (d: unknown) => Math.round(Number(d) * 100) / 100;
