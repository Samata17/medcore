import { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";

/** Human-friendly reference like "MC-482913". Uniqueness is enforced by the DB. */
export const randomCode = (prefix: string, digits = 6) => `${prefix}-${String(randomInt(0, 10 ** digits)).padStart(digits, "0")}`;

/**
 * Runs `create` with freshly generated codes until it doesn't collide with a
 * unique constraint (collisions are rare; 5 tries is plenty).
 */
export async function withUniqueCode<T>(prefix: string, create: (code: string) => Promise<T>, digits = 6): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await create(randomCode(prefix, digits));
    } catch (e) {
      const collision = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!collision || attempt === 4) throw e;
    }
  }
  throw new Error("unreachable");
}
