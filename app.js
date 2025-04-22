import fastify from 'fastify';
import { writeFile } from 'fs/promises';
import config from './config/index.js';

import autoload from '@fastify/autoload';
import caching from '@fastify/caching';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import postgres from '@fastify/postgres';
import fastifyRateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import tableAccessControl from './plugins/table-access-control.js';



export default async function buildApp() {
  // CHECK ENVIRONMENT BEFORE APP STARTS
  // Process exits before app is created if POSTGRES_CONNECTION env variable not set
  if (!config.postgres) {
    const errMsg = 'Required ENV variable POSTGRES_CONNECTION is not set. Please see README.md for more information.'
    console.error(errMsg)
    process.exit(1)
  }

  // Fastify instance for the app with logger options
  const app = fastify({ logger: config.logger })

  // POSTGRES CONNECTION
  const postgresConfig = { connectionString: config.postgres }

  // SSL Certificate Setup
  if (config.sslRootCert) {
    postgresConfig.ssl = { ca: config.sslRootCert }
  } else if (config.sslRootCertPath) {
    postgresConfig.ssl = {
      ca: await fs.readFile(config.sslRootCertPath, 'utf8')
    }
  } else {
    postgresConfig.ssl = null
  }

  // PLUGIN REGISTRATIONS

  // PostgreSQL Connection
  await app.register(postgres, postgresConfig);

  // Helmet CSP(contentSecurityPolicy) optimization
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });

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
    request.log.error(error);
    const response = {
      success: false,
      message: error.message,
      ...(config.isDev && { stack: error.stack }),
    };
    reply.status(error.statusCode || 500).send(response);
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
    staticCSP: true, // Enables automatic CSP header integration compatible with 
    transformStaticCSP: (header) =>
      // Fix CSP error by allowing inline styles (used by Swagger UI)
      header.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'"),
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
    const swaggerData = app.swagger();
    await writeFile('./swagger.json', JSON.stringify(swaggerData, null, 2));
  }

  // App is ready
  return app
}
// Server.js will take care of the rest
