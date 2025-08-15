import fastify from 'fastify';
import { writeFile } from 'fs/promises';
import config from '../config/index.js';
import { createLogger } from '../config/logger.js';

import autoload from '@fastify/autoload';
import caching from '@fastify/caching';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import postgres from '@fastify/postgres';
import fastifyRateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import tableAccessControl from '../plugins/table-access-control.js';

export default async function buildApp() {
  const appLogger = createLogger('app');

  // CHECK ENVIRONMENT BEFORE APP STARTS
  if (!config.postgres) {
    const errMsg = 'Required ENV variable POSTGRES_CONNECTION is not set. Please see README.md for more information.'
    appLogger.error(errMsg);
    process.exit(1);
  }

  // Fastify instance for the app with logger options and schema validation
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    },
    ajv: {
      customOptions: {
        removeAdditional: 'all',
        coerceTypes: true,
        useDefaults: true
      }
    }
  });

  // PostgreSQL Configuration
  const postgresConfig = { connectionString: config.postgres };

  // SSL Certificate Setup
  if (config.sslRootCert) {
    postgresConfig.ssl = { ca: config.sslRootCert };
  } else if (config.sslRootCertPath) {
    postgresConfig.ssl = {
      ca: await fs.readFile(config.sslRootCertPath, 'utf8')
    };
  } else {
    postgresConfig.ssl = null;
  }

  // PLUGIN REGISTRATIONS

  // PostgreSQL Connection
  await app.register(postgres, postgresConfig);

  // Custom Table Access Control Plugin (White Listing)
  await app.register(tableAccessControl);

  // Compression with x-protobuf support - add x-protobuf
  await app.register(compress, {
    customTypes: /x-protobuf$/,
  });

  // Cache Configuration
  await app.register(caching, config.cache);

  // Cors
  await app.register(cors);

  // Rate limiter
  if (config.rateLimit.max) {
    await app.register(fastifyRateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.timeWindow,
    });
  }

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    appLogger.error({
      type: 'error',
      requestId: request.id,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
      },
      request: {
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
        body: request.body,
        headers: request.headers
      }
    });

    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_SERVER_ERROR'
      }
    };

    if (config.isDev) {
      response.error.stack = error.stack;
    }

    reply.status(statusCode).send(response);
  });

  // Not found handler
  app.setNotFoundHandler((request, reply) => {
    appLogger.warn({
      type: 'not_found',
      requestId: request.id,
      method: request.method,
      url: request.url
    });

    reply.status(404).send({
      success: false,
      error: {
        message: 'Route not found',
        code: 'NOT_FOUND'
      }
    });
  });

  // Initialize Swagger
  await app.register(swagger, {
    exposeRoute: true,
    hideUntagged: true,
    swagger: config.swagger,
  });

  // Swagger UI documentation setup
  await app.register(swaggerUI, {
    routePrefix: '/',
    uiConfig: {
      docExpansion: 'list',     // Controls how the API list appears initially: "full" | "list" | "none"
      deepLinking: false        // Disable deep linking to tags/operations
    }
  });

  // Auto load routes
  await app.register(autoload, {
    dir: config.routesDir,
    dirNameRoutePrefix: false,
    options: {
      prefix: config.routePrefix,
      matchFilter: (path) => path.endsWith('.route.js'),
    },
  });

  // Export Swagger JSON (Only in development environment)
  if (config.isDev) {
    await app.ready();
    const swaggerData = app.swagger();
    await writeFile('./swagger.json', JSON.stringify(swaggerData, null, 2));
  }

  // App is ready
  return app;
}
// Server.js will take care of the rest
