// server.js
import buildApp from './app/index.js'
import { env } from './config/index.js'
import logger from './config/logger.js'

const serverLogger = logger.child({ module: 'server' })

// Start Server
buildApp()
    .then(app => {
        app.listen({
            port: env.port || 3009,
            host: env.host || 'geo.localhost'
        }, (err, address) => {
            if (err) {
                serverLogger.error({ err }, 'Server failed to start')
                process.exit(1)
            }

            serverLogger.info(`🚀 Server listening on ${address}`)
        })
    })
    .catch(err => {
        serverLogger.error({ err }, 'Failed to build application')
        process.exit(1)
    })

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    serverLogger.error({ err }, 'Uncaught Exception')
    process.exit(1)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    serverLogger.error({ reason, promise }, 'Unhandled Rejection')
    process.exit(1)
})
