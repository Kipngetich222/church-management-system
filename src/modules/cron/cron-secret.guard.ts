import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

/**
 * Guards scheduled job endpoints. The external scheduler must send the shared
 * secret in the `x-cron-secret` header.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>("cronSecret");
    const provided = request.headers["x-cron-secret"];

    if (!expected) {
      throw new UnauthorizedException("CRON_SECRET is not configured");
    }
    if (provided !== expected) {
      throw new UnauthorizedException("Invalid cron secret");
    }
    return true;
  }
}