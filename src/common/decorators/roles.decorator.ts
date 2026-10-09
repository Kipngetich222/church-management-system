import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "../interfaces/auth-user.interface";

export const ROLES_KEY = "roles";
/** Restricts an endpoint to the given membership roles within the active church. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Shortcut for endpoints that only church admins may call. */
export const ChurchAdmin = () => Roles("super_admin", "dept_admin");