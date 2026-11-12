import { SetMetadata, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthedRequest, RequestUser } from "./auth-types";
import type { Permission } from "./permissions";

export const IS_PUBLIC = "isPublic";
/** Skip authentication for this route (login, register, health…). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const PERMISSIONS = "permissions";
/** The signed-in user must have ALL listed permissions. */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS, permissions);

export const ANY_PERMISSIONS = "anyPermissions";
/**
 * The user needs AT LEAST ONE of the listed permissions. The handler must then
 * narrow the data by role (e.g. doctors only see their own orders).
 */
export const RequireAnyPermission = (...permissions: Permission[]) => SetMetadata(ANY_PERMISSIONS, permissions);

/** Injects the authenticated user into a controller method. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
