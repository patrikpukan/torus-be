"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const nestjs_decorated_config_1 = require("@applifting-io/nestjs-decorated-config");
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
/**
 * A config class that is populated from environment variables and enable the use of validation decorators.
 */
let Config = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _version_decorators;
    let _version_initializers = [];
    let _version_extraInitializers = [];
    let _gitCommitSha_decorators;
    let _gitCommitSha_initializers = [];
    let _gitCommitSha_extraInitializers = [];
    let _betterAuthSecret_decorators;
    let _betterAuthSecret_initializers = [];
    let _betterAuthSecret_extraInitializers = [];
    let _superadminEmail_decorators;
    let _superadminEmail_initializers = [];
    let _superadminEmail_extraInitializers = [];
    let _superadminPassword_decorators;
    let _superadminPassword_initializers = [];
    let _superadminPassword_extraInitializers = [];
    let _nodeEnv_decorators;
    let _nodeEnv_initializers = [];
    let _nodeEnv_extraInitializers = [];
    let _envName_decorators;
    let _envName_initializers = [];
    let _envName_extraInitializers = [];
    let _baseUrl_decorators;
    let _baseUrl_initializers = [];
    let _baseUrl_extraInitializers = [];
    let _frontendBaseUrl_decorators;
    let _frontendBaseUrl_initializers = [];
    let _frontendBaseUrl_extraInitializers = [];
    let _frontendProdUrl_decorators;
    let _frontendProdUrl_initializers = [];
    let _frontendProdUrl_extraInitializers = [];
    let _frontendResetPasswordUrl_decorators;
    let _frontendResetPasswordUrl_initializers = [];
    let _frontendResetPasswordUrl_extraInitializers = [];
    let _port_decorators;
    let _port_initializers = [];
    let _port_extraInitializers = [];
    let _postgresConnectionString_decorators;
    let _postgresConnectionString_initializers = [];
    let _postgresConnectionString_extraInitializers = [];
    let _databaseProvider_decorators;
    let _databaseProvider_initializers = [];
    let _databaseProvider_extraInitializers = [];
    let _postgresSsl_decorators;
    let _postgresSsl_initializers = [];
    let _postgresSsl_extraInitializers = [];
    let _prismaLog_decorators;
    let _prismaLog_initializers = [];
    let _prismaLog_extraInitializers = [];
    let _logHttpClientRequests_decorators;
    let _logHttpClientRequests_initializers = [];
    let _logHttpClientRequests_extraInitializers = [];
    let _cacheTtlMs_decorators;
    let _cacheTtlMs_initializers = [];
    let _cacheTtlMs_extraInitializers = [];
    let _cacheMaxItems_decorators;
    let _cacheMaxItems_initializers = [];
    let _cacheMaxItems_extraInitializers = [];
    let _prettyPrintLogs_decorators;
    let _prettyPrintLogs_initializers = [];
    let _prettyPrintLogs_extraInitializers = [];
    let _smtpHost_decorators;
    let _smtpHost_initializers = [];
    let _smtpHost_extraInitializers = [];
    let _smtpSecure_decorators;
    let _smtpSecure_initializers = [];
    let _smtpSecure_extraInitializers = [];
    let _smtpPort_decorators;
    let _smtpPort_initializers = [];
    let _smtpPort_extraInitializers = [];
    let _smtpUsername_decorators;
    let _smtpUsername_initializers = [];
    let _smtpUsername_extraInitializers = [];
    let _smtpPassword_decorators;
    let _smtpPassword_initializers = [];
    let _smtpPassword_extraInitializers = [];
    var Config = _classThis = class {
        constructor() {
            // basic info
            this.name = 'Quacker backend';
            this.description = 'Backend for Quacker, a social media platform for sharing short messages. Project example for educational purposes.';
            this.version = __runInitializers(this, _version_initializers, '0.1.0');
            this.gitCommitSha = (__runInitializers(this, _version_extraInitializers), __runInitializers(this, _gitCommitSha_initializers, void 0));
            this.betterAuthSecret = (__runInitializers(this, _gitCommitSha_extraInitializers), __runInitializers(this, _betterAuthSecret_initializers, void 0));
            this.superadminEmail = (__runInitializers(this, _betterAuthSecret_extraInitializers), __runInitializers(this, _superadminEmail_initializers, void 0));
            this.superadminPassword = (__runInitializers(this, _superadminEmail_extraInitializers), __runInitializers(this, _superadminPassword_initializers, void 0));
            this.nodeEnv = (__runInitializers(this, _superadminPassword_extraInitializers), __runInitializers(this, _nodeEnv_initializers, void 0));
            this.envName = (__runInitializers(this, _nodeEnv_extraInitializers), __runInitializers(this, _envName_initializers, void 0));
            /**
             * FIXME: This should be settable via env variable
             *        Current `@Env` cannot works with arrays
             */
            this.logLevels = (__runInitializers(this, _envName_extraInitializers), ['error', 'fatal', 'log']);
            this.baseUrl = __runInitializers(this, _baseUrl_initializers, void 0);
            this.frontendBaseUrl = (__runInitializers(this, _baseUrl_extraInitializers), __runInitializers(this, _frontendBaseUrl_initializers, void 0));
            this.frontendProdUrl = (__runInitializers(this, _frontendBaseUrl_extraInitializers), __runInitializers(this, _frontendProdUrl_initializers, void 0));
            this.frontendResetPasswordUrl = (__runInitializers(this, _frontendProdUrl_extraInitializers), __runInitializers(this, _frontendResetPasswordUrl_initializers, void 0));
            this.port = (__runInitializers(this, _frontendResetPasswordUrl_extraInitializers), __runInitializers(this, _port_initializers, void 0));
            this.postgresConnectionString = (__runInitializers(this, _port_extraInitializers), __runInitializers(this, _postgresConnectionString_initializers, void 0));
            this.databaseProvider = (__runInitializers(this, _postgresConnectionString_extraInitializers), __runInitializers(this, _databaseProvider_initializers, void 0));
            this.postgresSsl = (__runInitializers(this, _databaseProvider_extraInitializers), __runInitializers(this, _postgresSsl_initializers, void 0));
            this.prismaLog = (__runInitializers(this, _postgresSsl_extraInitializers), __runInitializers(this, _prismaLog_initializers, void 0));
            this.logHttpClientRequests = (__runInitializers(this, _prismaLog_extraInitializers), __runInitializers(this, _logHttpClientRequests_initializers, void 0));
            /**
             * Default cache config for rest endpoints
             */
            this.cacheTtlMs = (__runInitializers(this, _logHttpClientRequests_extraInitializers), __runInitializers(this, _cacheTtlMs_initializers, void 0));
            /**
             * Default cache config for rest endpoints
             */
            this.cacheMaxItems = (__runInitializers(this, _cacheTtlMs_extraInitializers), __runInitializers(this, _cacheMaxItems_initializers, void 0));
            this.prettyPrintLogs = (__runInitializers(this, _cacheMaxItems_extraInitializers), __runInitializers(this, _prettyPrintLogs_initializers, void 0));
            this.smtpHost = (__runInitializers(this, _prettyPrintLogs_extraInitializers), __runInitializers(this, _smtpHost_initializers, void 0));
            this.smtpSecure = (__runInitializers(this, _smtpHost_extraInitializers), __runInitializers(this, _smtpSecure_initializers, void 0));
            this.smtpPort = (__runInitializers(this, _smtpSecure_extraInitializers), __runInitializers(this, _smtpPort_initializers, void 0));
            this.smtpUsername = (__runInitializers(this, _smtpPort_extraInitializers), __runInitializers(this, _smtpUsername_initializers, void 0));
            this.smtpPassword = (__runInitializers(this, _smtpUsername_extraInitializers), __runInitializers(this, _smtpPassword_initializers, void 0));
            __runInitializers(this, _smtpPassword_extraInitializers);
        }
    };
    __setFunctionName(_classThis, "Config");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _version_decorators = [(0, class_validator_1.IsSemVer)()];
        _gitCommitSha_decorators = [(0, nestjs_decorated_config_1.Env)('CI_COMMIT_SHA', { expose: true }), (0, class_validator_1.IsOptional)()];
        _betterAuthSecret_decorators = [(0, nestjs_decorated_config_1.Env)('BETTER_AUTH_SECRET'), (0, class_validator_1.IsNotEmpty)()];
        _superadminEmail_decorators = [(0, nestjs_decorated_config_1.Env)('SUPERADMIN_EMAIL')];
        _superadminPassword_decorators = [(0, nestjs_decorated_config_1.Env)('SUPERADMIN_PASSWORD')];
        _nodeEnv_decorators = [(0, nestjs_decorated_config_1.Env)('NODE_ENV', { expose: true }), (0, class_validator_1.IsOptional)()];
        _envName_decorators = [(0, nestjs_decorated_config_1.Env)('ENV_NAME', { expose: true }), (0, class_validator_1.IsOptional)()];
        _baseUrl_decorators = [(0, nestjs_decorated_config_1.Env)('BASE_URL', {
                defaultValue: 'http://localhost:4000',
                expose: true,
                removeTrailingSlash: true,
            }), (0, class_validator_1.IsUrl)({ require_tld: false }), (0, class_validator_1.IsNotEmpty)()];
        _frontendBaseUrl_decorators = [(0, nestjs_decorated_config_1.Env)('FRONTEND_BASE_URL', {
                defaultValue: 'http://localhost:3000',
                expose: true,
                removeTrailingSlash: true,
            }), (0, class_validator_1.IsUrl)({ require_tld: false }), (0, class_validator_1.IsNotEmpty)()];
        _frontendProdUrl_decorators = [(0, nestjs_decorated_config_1.Env)('FRONTEND_PROD_URL', {
                defaultValue: 'http://localhost:3001',
                expose: true,
                removeTrailingSlash: true,
            }), (0, class_validator_1.IsUrl)({ require_tld: false }), (0, class_validator_1.IsNotEmpty)()];
        _frontendResetPasswordUrl_decorators = [(0, nestjs_decorated_config_1.Env)('FRONTEND_RESET_PASSWORD_ROUTE', {
                defaultValue: 'reset-password',
                expose: true,
            }), (0, class_validator_1.IsNotEmpty)()];
        _port_decorators = [(0, nestjs_decorated_config_1.Env)('PORT', { expose: true, defaultValue: 4000 })];
        _postgresConnectionString_decorators = [(0, nestjs_decorated_config_1.Env)('DATABASE_URL', {
                expose: true,
                defaultValue: 'postgres://postgres:password4251@postgres:5432/example',
            })];
        _databaseProvider_decorators = [(0, nestjs_decorated_config_1.Env)('DATABASE_PROVIDER', {
                expose: true,
                defaultValue: 'postgresql',
            })];
        _postgresSsl_decorators = [(0, nestjs_decorated_config_1.Env)('POSTGRES_SSL', { expose: true, defaultValue: false }), (0, class_validator_1.IsBoolean)()];
        _prismaLog_decorators = [(0, nestjs_decorated_config_1.Env)('PRISMA_LOG', {
                expose: true,
                parseArray: true,
            })];
        _logHttpClientRequests_decorators = [(0, nestjs_decorated_config_1.Env)('LOG_HTTP_CLIENT_REQUESTS', { defaultValue: true, expose: true }), (0, class_validator_1.IsBoolean)()];
        _cacheTtlMs_decorators = [(0, nestjs_decorated_config_1.Env)('CACHE_TTL_MS', { defaultValue: 10 * 1000, expose: true })];
        _cacheMaxItems_decorators = [(0, nestjs_decorated_config_1.Env)('CACHE_MAX_ITEMS', { defaultValue: 1000, expose: true })];
        _prettyPrintLogs_decorators = [(0, nestjs_decorated_config_1.Env)('PRETTY_PRINT_LOGS', { expose: true, defaultValue: true }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
        _smtpHost_decorators = [(0, nestjs_decorated_config_1.Env)('SMTP_HOST', { expose: true })];
        _smtpSecure_decorators = [(0, nestjs_decorated_config_1.Env)('SMTP_SECURE', { expose: true, defaultValue: true }), (0, class_validator_1.IsBoolean)()];
        _smtpPort_decorators = [(0, nestjs_decorated_config_1.Env)('SMTP_PORT', { expose: true, defaultValue: 465 })];
        _smtpUsername_decorators = [(0, nestjs_decorated_config_1.Env)('SMTP_USERNAME', { expose: true })];
        _smtpPassword_decorators = [(0, nestjs_decorated_config_1.Env)('SMTP_PASSWORD')];
        __esDecorate(null, null, _version_decorators, { kind: "field", name: "version", static: false, private: false, access: { has: obj => "version" in obj, get: obj => obj.version, set: (obj, value) => { obj.version = value; } }, metadata: _metadata }, _version_initializers, _version_extraInitializers);
        __esDecorate(null, null, _gitCommitSha_decorators, { kind: "field", name: "gitCommitSha", static: false, private: false, access: { has: obj => "gitCommitSha" in obj, get: obj => obj.gitCommitSha, set: (obj, value) => { obj.gitCommitSha = value; } }, metadata: _metadata }, _gitCommitSha_initializers, _gitCommitSha_extraInitializers);
        __esDecorate(null, null, _betterAuthSecret_decorators, { kind: "field", name: "betterAuthSecret", static: false, private: false, access: { has: obj => "betterAuthSecret" in obj, get: obj => obj.betterAuthSecret, set: (obj, value) => { obj.betterAuthSecret = value; } }, metadata: _metadata }, _betterAuthSecret_initializers, _betterAuthSecret_extraInitializers);
        __esDecorate(null, null, _superadminEmail_decorators, { kind: "field", name: "superadminEmail", static: false, private: false, access: { has: obj => "superadminEmail" in obj, get: obj => obj.superadminEmail, set: (obj, value) => { obj.superadminEmail = value; } }, metadata: _metadata }, _superadminEmail_initializers, _superadminEmail_extraInitializers);
        __esDecorate(null, null, _superadminPassword_decorators, { kind: "field", name: "superadminPassword", static: false, private: false, access: { has: obj => "superadminPassword" in obj, get: obj => obj.superadminPassword, set: (obj, value) => { obj.superadminPassword = value; } }, metadata: _metadata }, _superadminPassword_initializers, _superadminPassword_extraInitializers);
        __esDecorate(null, null, _nodeEnv_decorators, { kind: "field", name: "nodeEnv", static: false, private: false, access: { has: obj => "nodeEnv" in obj, get: obj => obj.nodeEnv, set: (obj, value) => { obj.nodeEnv = value; } }, metadata: _metadata }, _nodeEnv_initializers, _nodeEnv_extraInitializers);
        __esDecorate(null, null, _envName_decorators, { kind: "field", name: "envName", static: false, private: false, access: { has: obj => "envName" in obj, get: obj => obj.envName, set: (obj, value) => { obj.envName = value; } }, metadata: _metadata }, _envName_initializers, _envName_extraInitializers);
        __esDecorate(null, null, _baseUrl_decorators, { kind: "field", name: "baseUrl", static: false, private: false, access: { has: obj => "baseUrl" in obj, get: obj => obj.baseUrl, set: (obj, value) => { obj.baseUrl = value; } }, metadata: _metadata }, _baseUrl_initializers, _baseUrl_extraInitializers);
        __esDecorate(null, null, _frontendBaseUrl_decorators, { kind: "field", name: "frontendBaseUrl", static: false, private: false, access: { has: obj => "frontendBaseUrl" in obj, get: obj => obj.frontendBaseUrl, set: (obj, value) => { obj.frontendBaseUrl = value; } }, metadata: _metadata }, _frontendBaseUrl_initializers, _frontendBaseUrl_extraInitializers);
        __esDecorate(null, null, _frontendProdUrl_decorators, { kind: "field", name: "frontendProdUrl", static: false, private: false, access: { has: obj => "frontendProdUrl" in obj, get: obj => obj.frontendProdUrl, set: (obj, value) => { obj.frontendProdUrl = value; } }, metadata: _metadata }, _frontendProdUrl_initializers, _frontendProdUrl_extraInitializers);
        __esDecorate(null, null, _frontendResetPasswordUrl_decorators, { kind: "field", name: "frontendResetPasswordUrl", static: false, private: false, access: { has: obj => "frontendResetPasswordUrl" in obj, get: obj => obj.frontendResetPasswordUrl, set: (obj, value) => { obj.frontendResetPasswordUrl = value; } }, metadata: _metadata }, _frontendResetPasswordUrl_initializers, _frontendResetPasswordUrl_extraInitializers);
        __esDecorate(null, null, _port_decorators, { kind: "field", name: "port", static: false, private: false, access: { has: obj => "port" in obj, get: obj => obj.port, set: (obj, value) => { obj.port = value; } }, metadata: _metadata }, _port_initializers, _port_extraInitializers);
        __esDecorate(null, null, _postgresConnectionString_decorators, { kind: "field", name: "postgresConnectionString", static: false, private: false, access: { has: obj => "postgresConnectionString" in obj, get: obj => obj.postgresConnectionString, set: (obj, value) => { obj.postgresConnectionString = value; } }, metadata: _metadata }, _postgresConnectionString_initializers, _postgresConnectionString_extraInitializers);
        __esDecorate(null, null, _databaseProvider_decorators, { kind: "field", name: "databaseProvider", static: false, private: false, access: { has: obj => "databaseProvider" in obj, get: obj => obj.databaseProvider, set: (obj, value) => { obj.databaseProvider = value; } }, metadata: _metadata }, _databaseProvider_initializers, _databaseProvider_extraInitializers);
        __esDecorate(null, null, _postgresSsl_decorators, { kind: "field", name: "postgresSsl", static: false, private: false, access: { has: obj => "postgresSsl" in obj, get: obj => obj.postgresSsl, set: (obj, value) => { obj.postgresSsl = value; } }, metadata: _metadata }, _postgresSsl_initializers, _postgresSsl_extraInitializers);
        __esDecorate(null, null, _prismaLog_decorators, { kind: "field", name: "prismaLog", static: false, private: false, access: { has: obj => "prismaLog" in obj, get: obj => obj.prismaLog, set: (obj, value) => { obj.prismaLog = value; } }, metadata: _metadata }, _prismaLog_initializers, _prismaLog_extraInitializers);
        __esDecorate(null, null, _logHttpClientRequests_decorators, { kind: "field", name: "logHttpClientRequests", static: false, private: false, access: { has: obj => "logHttpClientRequests" in obj, get: obj => obj.logHttpClientRequests, set: (obj, value) => { obj.logHttpClientRequests = value; } }, metadata: _metadata }, _logHttpClientRequests_initializers, _logHttpClientRequests_extraInitializers);
        __esDecorate(null, null, _cacheTtlMs_decorators, { kind: "field", name: "cacheTtlMs", static: false, private: false, access: { has: obj => "cacheTtlMs" in obj, get: obj => obj.cacheTtlMs, set: (obj, value) => { obj.cacheTtlMs = value; } }, metadata: _metadata }, _cacheTtlMs_initializers, _cacheTtlMs_extraInitializers);
        __esDecorate(null, null, _cacheMaxItems_decorators, { kind: "field", name: "cacheMaxItems", static: false, private: false, access: { has: obj => "cacheMaxItems" in obj, get: obj => obj.cacheMaxItems, set: (obj, value) => { obj.cacheMaxItems = value; } }, metadata: _metadata }, _cacheMaxItems_initializers, _cacheMaxItems_extraInitializers);
        __esDecorate(null, null, _prettyPrintLogs_decorators, { kind: "field", name: "prettyPrintLogs", static: false, private: false, access: { has: obj => "prettyPrintLogs" in obj, get: obj => obj.prettyPrintLogs, set: (obj, value) => { obj.prettyPrintLogs = value; } }, metadata: _metadata }, _prettyPrintLogs_initializers, _prettyPrintLogs_extraInitializers);
        __esDecorate(null, null, _smtpHost_decorators, { kind: "field", name: "smtpHost", static: false, private: false, access: { has: obj => "smtpHost" in obj, get: obj => obj.smtpHost, set: (obj, value) => { obj.smtpHost = value; } }, metadata: _metadata }, _smtpHost_initializers, _smtpHost_extraInitializers);
        __esDecorate(null, null, _smtpSecure_decorators, { kind: "field", name: "smtpSecure", static: false, private: false, access: { has: obj => "smtpSecure" in obj, get: obj => obj.smtpSecure, set: (obj, value) => { obj.smtpSecure = value; } }, metadata: _metadata }, _smtpSecure_initializers, _smtpSecure_extraInitializers);
        __esDecorate(null, null, _smtpPort_decorators, { kind: "field", name: "smtpPort", static: false, private: false, access: { has: obj => "smtpPort" in obj, get: obj => obj.smtpPort, set: (obj, value) => { obj.smtpPort = value; } }, metadata: _metadata }, _smtpPort_initializers, _smtpPort_extraInitializers);
        __esDecorate(null, null, _smtpUsername_decorators, { kind: "field", name: "smtpUsername", static: false, private: false, access: { has: obj => "smtpUsername" in obj, get: obj => obj.smtpUsername, set: (obj, value) => { obj.smtpUsername = value; } }, metadata: _metadata }, _smtpUsername_initializers, _smtpUsername_extraInitializers);
        __esDecorate(null, null, _smtpPassword_decorators, { kind: "field", name: "smtpPassword", static: false, private: false, access: { has: obj => "smtpPassword" in obj, get: obj => obj.smtpPassword, set: (obj, value) => { obj.smtpPassword = value; } }, metadata: _metadata }, _smtpPassword_initializers, _smtpPassword_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Config = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Config = _classThis;
})();
exports.Config = Config;
