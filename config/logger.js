import pino from 'pino';

const transport = pino.transport({
    targets: [
        // Console output with pretty printing in development
        {
            target: 'pino-pretty',
            level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
        // File output in production
        ...(process.env.NODE_ENV === 'production'
            ? [
                {
                    target: 'pino/file',
                    level: 'info',
                    options: {
                        destination: process.env.LOG_FILE || '../logs/app.log',
                        mkdir: true,
                    },
                },
            ]
            : []),
    ],
});

const logger = pino(
    {
        level: process.env.LOG_LEVEL || 'info',
        redact: {
            paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.token',
            ],
            remove: true,
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    transport
);

// Create child loggers for different parts of the application
export const createLogger = (name) => logger.child({ module: name });

export default logger; 