import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { Config } from '../../config/config.service';

@Injectable()
export class SupabaseAdminService {
  private readonly client: SupabaseClient | null;
  private readonly logger = new Logger(SupabaseAdminService.name);

  constructor(private readonly config: Config) {
    if (config.supabaseUrl && config.supabaseServiceRoleKey) {
      this.client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    } else {
      this.client = null;
      this.logger.warn('Supabase Admin client not configured; skipping Supabase Auth sync.');
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  async createUser(params: Parameters<SupabaseClient['auth']['admin']['createUser']>[0]) {
    if (!this.client) {
      throw new Error('Supabase Admin client not configured');
    }

    return this.client.auth.admin.createUser(params);
  }
}
