# Cursor Project Rules for torus-be (NestJS + Prisma + GraphQL)

[language]
# Primary language and formatter
primary = "typescript"
formatters = ["prettier", "eslint"]

[editor]
# Keep edits minimal and focused. Do not reformat unrelated code.
preserve_indentation = true
respect_existing_style = true

[typescript]
target = "ES2023"
module = "nodenext"
moduleResolution = "nodenext"
strictNullChecks = true
skipLibCheck = true
emitDecoratorMetadata = true
experimentalDecorators = true

[imports]
# Maintain explicit relative imports; do not invent path aliases
prefer_relative = true
sort_imports = true
respect_eslint_import_sorter = true

[project]
# Monolith NestJS app using Prisma and GraphQL (code-first)
framework = "nestjs"
entry = "src/main.ts"
source_root = "src"
out_dir = "dist"

[routing]
# GraphQL only; no REST route scaffolding unless file already uses it
prefer_graphql = true

[graphql]
auto_schema_file = "src/schema.gql"
sort_schema = true
use_apollo_driver = true
context_includes_session = true

[nest]
# Module structure conventions
module_suffix = "module.ts"
provider_suffix = "service.ts"
resolver_suffix = "resolver.ts"
use_dependency_injection = true

[auth]
# Guard/decorator conventions used in resolvers
authenticated_guard = "src/shared/auth/guards/authenticated-user.guard#AuthenticatedUserGuard"
user_param_decorator = "src/shared/auth/decorators/user.decorator#User"

[prisma]
schema = "prisma/schema.prisma"
client_package = "@prisma/client"
run_generate_on_build = true

[migrations]
# Prefer Prisma migrate workflows from package.json
create_cmd = "npm run prisma:migrations:generate --"
run_cmd = "npm run prisma:migrations:run"
reset_cmd = "npm run db:fresh"

[testing]
unit_cmd = "npm run test"
watch_cmd = "npm run test:watch"
coverage_cmd = "npm run test:cov"

[lint]
check_cmd = "npm run lint:check"
format_check_cmd = "npm run format:check"
format_write_cmd = "npm run format:write"

[docker]
up_cmd = "npm run docker:up"
rebuild_cmd = "npm run docker:up-rebuild"
down_cmd = "npm run docker:down"

[emails]
# HTML email templates live here; keep assets untouched
templates_dir = "assets/templates/html"

[uploads]
# Static served uploads (do not rename or relocate without updating ServeStaticModule)
path = "uploads"
serve_root = "/uploads"

[code_style]
# Follow Clean Code naming; verbose, explicit types for public APIs
avoid_one_letter_names = true
prefer_full_words = true

[error_handling]
# Avoid broad try/catch; only catch with meaningful handling
no_swallow_errors = true

[commit]
# Keep edits atomic and scoped; don’t mix refactors with feature work
atomic_edits = true

[generation]
# When generating code:
# - Always add to an existing Nest module
# - Export provider/resolver for module wiring
# - Add tests when non-trivial
require_module_registration = true
add_basic_tests = false

[env]
# Important environment variables referenced in Config
required = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
]
optional = [
  "PORT",
  "BASE_URL",
  "FRONTEND_BASE_URL",
  "FRONTEND_PROD_URL",
  "FRONTEND_RESET_PASSWORD_ROUTE",
  "POSTGRES_SSL",
  "PRISMA_LOG",
  "LOG_HTTP_CLIENT_REQUESTS",
  "CACHE_TTL_MS",
  "CACHE_MAX_ITEMS",
  "PRETTY_PRINT_LOGS",
  "SMTP_HOST",
  "SMTP_SECURE",
  "SMTP_PORT",
  "SMTP_USERNAME",
  "SMTP_PASSWORD",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPERADMIN_EMAIL",
  "SUPERADMIN_PASSWORD",
]

[conventions]
# Do not edit compiled files or generated outputs
ignore_paths = [
  "dist/**",
  "node_modules/**",
  "**/*.js.map",
  "uploads/**",
]
# Prefer adding new code under feature modules
feature_modules_dir = "src/modules"

[assistant]
# Interaction rules for AI edits in this repo
- keep_resolver_auth = true            # retain @UseGuards(AuthenticatedUserGuard)
- preserve_user_decorator = true       # continue using @User() for Identity
- do_not_change_graphql_context = true # session is injected in context
- avoid_global_refactors = true
