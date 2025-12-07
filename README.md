# Torus Backend

## Description

Torus is a modern pairing and matching platform built with NestJS and GraphQL.

## Authentication & Supabase Integration

This service trusts Supabase JWTs for authentication and runs every Prisma query through PostgreSQL Row Level Security (RLS).

- Configure the following environment variables in `.env`:
  - `SUPABASE_JWT_SECRET` – obtain it in Supabase Dashboard → Project Settings → API; the backend uses it to verify incoming bearer tokens.
  - `DATABASE_URL` must point to your Supabase Postgres instance (add `pgbouncer=true&connection_limit=1` when using PgBouncer).
  - `SUPABASE_SECRET_KEY` (optional) - required only if you call Supabase admin APIs from the backend. Keep this key strictly on the server.
- Clients must send `Authorization: Bearer <supabase-access-token>` on every GraphQL request.
- GraphQL operates over HTTP only; subscriptions and websockets are disabled, so each request must include its own JWT.
- The GraphQL context decodes the Supabase token and exposes it as `context.user`. Guards and resolvers rely on this identity.
- Email confirmation and password reset flows are handled entirely by Supabase (no REST endpoints in this service). Configure redirect URLs (e.g. `/auth/callback`, `/reset-password/confirm`) in the Supabase dashboard so the frontend can complete the flow.
- Use `withRls` (`src/db/withRls.ts`) to wrap Prisma access so `SET LOCAL ROLE authenticated` and `request.jwt.claims` are configured for Supabase RLS policies.
- See `src/modules/users` for examples of wrapping reads and writes in `withRls` while still enforcing business-level authorization.

## Configuration

The pairing algorithm is configured via environment variables:

- `PAIRING_CRON_ENABLED`: Enable/disable automatic scheduling (default: true)
- `PAIRING_CRON_SCHEDULE`: Cron expression for scheduling (default: "0 0 * * 1")
- `PAIRING_DEFAULT_PERIOD_DAYS`: Default period length (default: 21)
- `PAIRING_MIN_PERIOD_DAYS`: Minimum allowed period (default: 7)
- `PAIRING_MAX_PERIOD_DAYS`: Maximum allowed period (default: 365)

Example:

```bash
PAIRING_CRON_SCHEDULE="0 0 * * 5"  # Run every Friday at midnight
PAIRING_DEFAULT_PERIOD_DAYS=14     # 2-week periods
```

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Reset database from scratch (Supabase + Prisma)

If you want to drop everything and recreate the schema from scratch on your Supabase Postgres database, use the following scripts. This is destructive and will erase ALL data in the target schema defined by `DATABASE_URL`.

Warning: Do NOT use on a database that contains valuable production data. Prefer separate databases or schemas per environment.

```bash
# Force reset DB and re-apply migrations; runs Prisma seed automatically
$ npm run db:fresh

# Start the app after a fresh reset in dev
$ npm run start:fresh:dev

# Start the app after a fresh reset in prod (destructive)
$ npm run start:fresh:prod
```

Notes:

- The reset uses `prisma migrate reset --force`, which drops and recreates the schema, reapplies migrations, and then runs the Prisma seed.
- Seeding is wired via the `prisma.seed` command in `package.json`, which calls `ts-node src/scripts/seed/seed.script.ts`.
- Ensure your `.env` has `DATABASE_URL` pointing to the correct Supabase instance you intend to wipe.
- If you encounter `P3009 migrate found failed migrations...`, running `npm run db:fresh` will reset the state and reapply migrations cleanly.

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
