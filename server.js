// server.js
import buildApp from './app.js'
import { env } from './config/index.js'

// Start Server
buildApp().then(app => {
    app.listen({
        port: env.SERVER_PORT || 3009,
        host: env.host || '0.0.0.0'
    }, (err, address) => {
        if (err) {
            console.error('Server failed to start:', err)
            process.exit(1)
        }

        console.info(`🚀 Server listening on ${address}`)
    })
})
