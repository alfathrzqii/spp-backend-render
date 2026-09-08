import winston from "winston";
import type { ILogger } from "../../domain/services/ILogger.js";

class WinstonLogger implements ILogger {
  private logger: winston.Logger;

  constructor() {
    const isDevelopment = process.env.NODE_ENV === "development";

    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
      winston.format.colorize({ all: true }),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? `\n${info.stack}` : ""}`
      )
    );

    const transports: winston.transport[] = [];

    if (isDevelopment) {
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
        })
      );
    } else {
      // Stream structured JSON logs to Console (stdout) for Render & PM2 log viewers
      transports.push(
        new winston.transports.Console({
          format: logFormat,
        })
      );

      // Persist logs to local files
      transports.push(
        new winston.transports.File({
          filename: "logs/error.log",
          level: "error",
          format: logFormat,
        }),
        new winston.transports.File({
          filename: "logs/combined.log",
          format: logFormat,
        })
      );
    }

    this.logger = winston.createLogger({
      level: isDevelopment ? "debug" : "info",
      transports,
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, trace?: string, meta?: any): void {
    this.logger.error(message, { stack: trace, ...meta });
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
}

export const logger = new WinstonLogger();
