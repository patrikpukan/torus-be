# Auth module

The shared auth module wraps the Better Auth provider and exposes HTTP handlers that sit on top of the same Express adapter mounted in `main.ts`. The following environment variables must be configured for the feature set introduced here:

- `BETTER_AUTH_SECRET` – signing key consumed by Better Auth.
- `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` – bootstrap credentials for the system administrator.
- `FRONTEND_BASE_URL`, `FRONTEND_PROD_URL`, `FRONTEND_RESET_PASSWORD_ROUTE` – used to build trusted origins and password reset links.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SECURE` – outbound email delivery for verification/reset flows.

The CLI helper in `shared/auth/utils/cli-auth-client.ts` now uses the PostgreSQL adapter, matching the server runtime.
