import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createClient,
  SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { Database } from "../types/database";

/**
 * Central Supabase access point for the API.
 *
 * The API talks to Postgres through the service-role key. Row Level Security is
 * therefore bypassed, so every service MUST scope its queries explicitly to the
 * church / membership resolved by the guards.
 */
@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly client: SupabaseClient<Database>;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>("supabase.url");
    const serviceRoleKey = this.config.get<string>("supabase.serviceRoleKey");

    if (!url || !serviceRoleKey) {
      this.logger.warn(
        "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured. Data endpoints will fail until they are set.",
      );
    }

    this.client = createClient<Database>(url || "http://localhost", serviceRoleKey || "missing", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /** Service-role client. Bypasses RLS - always scope queries manually. */
  get admin(): SupabaseClient<Database> {
    return this.client;
  }

  /** Verify a Supabase access token and return the matching auth user. */
  async getUserFromToken(accessToken: string): Promise<User | null> {
    if (!accessToken) return null;
    try {
      const { data, error } = await this.client.auth.getUser(accessToken);
      if (error) return null;
      return data.user ?? null;
    } catch (error) {
      this.logger.debug(`Token verification failed: ${(error as Error).message}`);
      return null;
    }
  }

  /** Throw a 500 when a Supabase query returns an error. */
  unwrap<T>(data: T | null, error: { message: string } | null): T {
    if (error) {
      this.logger.error(error.message);
      throw new InternalServerErrorException(error.message);
    }
    return data as T;
  }

  /** Single row or null (ignores "no rows" errors). */
  single<T>(data: T | null, error: { code?: string; message: string } | null): T | null {
    if (error && error.code !== "PGRST116") {
      this.logger.error(error.message);
      throw new InternalServerErrorException(error.message);
    }
    return (data as T) ?? null;
  }
}