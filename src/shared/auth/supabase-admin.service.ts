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

  /**
   * Invite a user by email - sends an invitation email automatically
   * This is the preferred method for inviting organization admins
   */
  async inviteUserByEmail(
    email: string,
    options?: {
      data?: Record<string, unknown>;
      redirectTo?: string;
    }
  ): Promise<Awaited<CreateUserResponse>> {
    if (!this.client) {
      throw new Error("Supabase admin client is not configured");
    }

    this.logger.log(`Inviting user by email: ${email}`);

    return this.client.auth.admin.inviteUserByEmail(email, options);
  }

  /**
   * Generate a password reset link for a user
   * This can be used to invite users to set their password
   */
  async generatePasswordResetLink(email: string): Promise<string | null> {
    if (!this.client) {
      throw new Error("Supabase admin client is not configured");
    }

    try {
      const { data, error } =
        await this.client.auth.admin.generateLink({
          type: "recovery",
          email: email,
        });

      if (error) {
        this.logger.error(
          `Failed to generate password reset link: ${error.message}`
        );
        return null;
      }

      return data.properties?.action_link ?? null;
    } catch (error) {
      this.logger.error("Error generating password reset link", error);
      return null;
    }
  }
}
