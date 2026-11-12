import type { Role } from "@prisma/client";
import type { Request } from "express";

/** Claims inside the short-lived access token. */
export interface JwtPayload {
  sub: string; // user id
  role: Role;
  hid: string | null; // hospital id (null for super admin)
}

/** The signed-in user, attached to every authenticated request. */
export interface RequestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  hospitalId: string | null;
  /** Set for doctors */
  doctorId: string | null;
  /** Set for patients with a portal account */
  patientId: string | null;
}

export type AuthedRequest = Request & { user: RequestUser };
