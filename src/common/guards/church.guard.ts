import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { ChurchScopedRequest, UserRole } from "../interfaces/auth-user.interface";

/**
 * Resolves the active church from the `churchId` route param (or `x-church-id`
 * header), verifies the caller belongs to it and attaches the membership to the
 * request. Optionally enforces `@Roles()` metadata.
 */
@Injectable()
export class ChurchGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & ChurchScopedRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException("Authentication required");

    const params = request.params as Record<string, string>;
    const churchId =
      params.churchId || (request.headers["x-church-id"] as string | undefined);

    if (!churchId) throw new BadRequestException("Missing churchId");

    const membership = user.memberships.find((m) => m.churchId === churchId);
    if (!membership) throw new ForbiddenException("You do not belong to this church");

    request.membership = membership;

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException("Insufficient permissions for this church");
    }

    return true;
  }
}