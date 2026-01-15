import winston from 'winston';
import path from 'path';
import { app } from 'electron';

/**
 * Logger Service
 * Winston-based logging with file rotation
 */

const isDev = process.env.NODE_ENV === 'development';

// Custom format for development
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Format for production
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Get log directory
const getLogDir = (): string => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'logs');
};

// Create logger instance
export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: isDev ? devFormat : prodFormat,
  transports: [
    // Console transport (development only)
    ...(isDev
      ? [
          new winston.transports.Console({
            handleExceptions: true,
            handleRejections: true,
          }),
        ]
      : []),
    
    // File transport - all logs
    new winston.transports.File({
      dirname: getLogDir(),
      filename: 'combined.log',
      format: prodFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    
    // File transport - errors only
    new winston.transports.File({
      dirname: getLogDir(),
      filename: 'error.log',
      level: 'error',
      format: prodFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      dirname: getLogDir(),
      filename: 'exceptions.log',
      maxsize: 10485760,
      maxFiles: 3,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      dirname: getLogDir(),
      filename: 'rejections.log',
      maxsize: 10485760,
      maxFiles: 3,
    }),
  ],
});

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: string) {
  return logger.child({ context });
}
