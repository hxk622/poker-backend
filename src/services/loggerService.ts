import winston from 'winston';

// 定义日志级别
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly'
}

// 创建日志记录器
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || LogLevel.INFO,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({
      stack: true
    }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    // 错误日志输出到文件
    new winston.transports.File({
      filename: 'logs/error.log',
      level: LogLevel.ERROR,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    // 所有日志输出到文件
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// 在开发环境下，将日志输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// 创建日志目录
import fs from 'fs';
import path from 'path';

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// 日志服务类
class LoggerService {
  static error(message: string, meta?: any) {
    logger.error(message, meta);
  }

  static warn(message: string, meta?: any) {
    logger.warn(message, meta);
  }

  static info(message: string, meta?: any) {
    logger.info(message, meta);
  }

  static http(message: string, meta?: any) {
    logger.http(message, meta);
  }

  static verbose(message: string, meta?: any) {
    logger.verbose(message, meta);
  }

  static debug(message: string, meta?: any) {
    logger.debug(message, meta);
  }

  static silly(message: string, meta?: any) {
    logger.silly(message, meta);
  }

  // 游戏特定的日志方法
  static gameEvent(event: string, sessionId: string, playerId?: string, data?: any) {
    const meta = {
      sessionId,
      playerId,
      data
    };
    logger.info(`[GAME] ${event}`, meta);
  }

  static playerAction(action: string, sessionId: string, playerId: string, details?: any) {
    const meta = {
      sessionId,
      playerId,
      details
    };
    logger.info(`[PLAYER] ${playerId} ${action}`, meta);
  }

  static errorEvent(error: Error, sessionId?: string, playerId?: string) {
    const meta = {
      sessionId,
      playerId,
      stack: error.stack
    };
    logger.error(error.message, meta);
  }
}

export default LoggerService;
