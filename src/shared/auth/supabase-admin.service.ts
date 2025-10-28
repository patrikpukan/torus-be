import { Injectable, Logger } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Config } from "../config/config.service";

type CreateUserPayload = Parameters<
  SupabaseClient["auth"]["admin"]["createUser"]
>[0];
type CreateUserResponse = ReturnType<
  SupabaseClient["auth"]["admin"]["createUser"]
>;

@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);
  private readonly client: SupabaseClient | null;

  constructor(private readonly config: Config) {
    if (config.supabaseUrl && config.supabaseSecretKey) {
      this.client = createClient(config.supabaseUrl, config.supabaseSecretKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    } else {
      this.client = null;
      this.logger.debug(
        "Supabase admin client not configured; skipping admin operations"
      );
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  async createUser(
    payload: CreateUserPayload
  ): Promise<Awaited<CreateUserResponse>> {
    if (!this.client) {
      throw new Error("Supabase admin client is not configured");
    }

    return this.client.auth.admin.createUser(payload);
  }
}
