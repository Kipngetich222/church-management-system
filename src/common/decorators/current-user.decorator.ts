import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthUser, ChurchScopedRequest } from "../interfaces/auth-user.interface";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest<ChurchScopedRequest>();
    return request.user;
  },
);

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<ChurchScopedRequest>();
    return request.membership;
  },
);