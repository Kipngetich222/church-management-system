import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { SupabaseService } from "../../supabase/supabase.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthUser, ChurchScopedRequest, MembershipSummary } from "../interfaces/auth-user.interface";

/**
 * Verifies the Supabase access token from the Authorization header and attaches
 * the resolved user (with church memberships) to the request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & ChurchScopedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException("Missing bearer token");
    }

    const user = await this.supabase.getUserFromToken(token);
    if (!user) {
      if (isPublic) return true;
      throw new UnauthorizedException("Invalid or expired token");
    }

    request.user = await this.buildAuthUser(user.id, user.email ?? "");
    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers["authorization"];
    if (!header || Array.isArray(header)) return null;
    const [scheme, value] = header.split(" ");
    if (!value || scheme.toLowerCase() !== "bearer") return null;
    return value.trim();
  }

  private async buildAuthUser(userId: string, email: string): Promise<AuthUser> {
    const { admin } = this.supabase;

    const [{ data: profile }, { data: memberships }] = await Promise.all([
      admin.from("users").select("id, email, full_name, phone, avatar_url").eq("id", userId).maybeSingle(),
      admin
        .from("church_memberships")
        .select("id, church_id, role, badges, status, is_baptized")
        .eq("user_id", userId),
    ]);

    const summaries: MembershipSummary[] = (memberships ?? []).map((m) => ({
      id: m.id,
      churchId: m.church_id,
      role: m.role,
      badges: (m.badges ?? []) as string[],
      status: m.status ?? "active",
      isBaptized: Boolean(m.is_baptized),
    }));

    return {
      id: userId,
      email: profile?.email ?? email,
      fullName: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      memberships: summaries,
    };
  }
}