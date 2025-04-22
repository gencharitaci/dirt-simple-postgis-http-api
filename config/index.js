import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const env = {
    // nodeEnv: process.env.NODE_ENV,
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    port: process.env.SERVER_PORT,
    host: process.env.SERVER_HOST,
    postgres: process.env.POSTGRES_CONNECTION,
    sslRootCert: process.env.SSL_ROOT_CERT,
    sslRootCertPath: process.env.SSL_ROOT_CERT_PATH,
    cachePrivacy: process.env.CACHE_PRIVACY,
    cacheExpiresIn: process.env.CACHE_EXPIRESIN,
    serverCache: process.env.CACHE_SERVERCACHE,
    rateMax: process.env.RATE_MAX,
    basePath: process.env.BASE_PATH,
    appVersion: process.env.npm_package_version,
    helmetGlobal: process.env.HELMET_GLOBAL,
    helmetEnableCSPNonces: process.env.HELMET_ENABLE_CSPNONCES,
    helmetCSP: process.env.HELMET_CONTENT_SECURITY_POLICY,
    serverLogger: process.env.SERVER_LOGGER,
    serverLoggerPath: process.env.SERVER_LOGGER_PATH,
    swaggerHost: process.env.SWAGGER_HOST,
    swaggerSchemas: process.env.SWAGGER_SCHEMAS
}

// Logger Options for Fastify
const logger = env.serverLogger
    ? {
        level: env.serverLogger === 'true' ? 'info' : env.serverLogger,
        ...(env.serverLoggerPath && { file: env.serverLoggerPath })
    }
    : false


export default {
    // all env variables
    env,

    // Environment
    isDev: env.isDevelopment,
    isProd: env.isProduction,

    // Postgress DB
    postgres: env.postgres,

    // Helmet - contentSecurityPolicy
    helmet: {
        global: env.helmetGlobal !== 'false',
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"]
            }
        }
    },

    // Cache settings
    cache: {
        privacy: env.cachePrivacy || 'private',
        expiresIn: env.cacheExpiresIn || 3600,
        serverExpiresIn: env.serverCache
    },

    // Rate limits
    rateLimit: {
        max: env.rateMax || 100,
        timeWindow: '1 minute'
    },

    // Logger
    logger,

    // Routes
    routePrefix: '/api/v1',
    routesDir: path.join(path.resolve(), 'routes'),

    // Swagger config
    swagger: {
        info: {
            title: 'Dirt-Simple PostGIS HTTP API',
            description: 'The Dirt-Simple PostGIS HTTP API is an easy way to expose geospatial functionality to your applications. It takes simple requests over HTTP and returns JSON, JSONP, or protobuf (Mapbox Vector Tile) to the requester. Although the focus of the project has generally been on exposing PostGIS functionality to web apps, you can use the framework to make an API to any database. You can restrict access to some internal tables in config file by blacklisting them so that they are not exposed through the API.',
            version: env.appVersion || '1.0.0',
            termsOfService: `${env.basePath}/terms/`,
            license: {
                "name": "Apache 2.0",
                "url": "http://www.apache.org/licenses/LICENSE-2.0.html"
            }
        },
        externalDocs: {
            url: 'https://github.com/gencharitaci/dirt-simple-postgis-http-api',
            description: 'Find out more about Dirt-Simple PostGIS HTTP API | Source code on Github'
        },
        host: env.isProd
            ? env.swaggerHost || ""
            : "localhost:3009",
        basePath: env.basePath || '/',
        schemes: env.isProd
            ? env.swaggerSchemas?.split(",") || ["https"]
            : ["http"],
        consumes: ["application/json"],
        produces: ["application/json"],
        tags: [
            {
                name: 'api',
                description: 'code related end-points',
                externalDocs: {
                    description: "Find out more",
                    url: "https://github.com/gencharitaci/dirt-simple-postgis-http-api#readme"
                }
            },
            {
                name: 'feature',
                description: 'features in common formats for direct mapping.',
                externalDocs: {
                    description: "Find out more",
                    url: "https://github.com/gencharitaci/dirt-simple-postgis-http-api#readme"
                }
            },
            {
                name: 'meta',
                description: 'meta information for tables and views.',
                externalDocs: {
                    description: "Find out more",
                    url: "https://github.com/gencharitaci/dirt-simple-postgis-http-api#readme"
                }
            }
        ]
    },

    // Blacklisted table names
    blacklistedTables: [
        'secret_table',
        'military_areas',
        'internal_logs'
    ]
}
