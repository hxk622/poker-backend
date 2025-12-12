import winston from 'winston';
import { ContextManager } from '../utils/contextManager';

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
      filename: process.env.LOG_ERROR_FILE || 'logs/error.log',
      level: LogLevel.ERROR,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    // 所有日志输出到文件
    new winston.transports.File({
      filename: process.env.LOG_COMBINED_FILE || 'logs/combined.log',
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
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
          metaStr = JSON.stringify(meta, null, 2);
        }
        return `${timestamp} ${level}: ${message} ${metaStr}`;
      })
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
    logger.error(message, this.enrichMeta(meta));
  }

  static warn(message: string, meta?: any) {
    logger.warn(message, this.enrichMeta(meta));
  }

  static info(message: string, meta?: any) {
    logger.info(message, this.enrichMeta(meta));
  }

  static http(message: string, meta?: any) {
    logger.http(message, this.enrichMeta(meta));
  }

  static verbose(message: string, meta?: any) {
    logger.verbose(message, this.enrichMeta(meta));
  }

  static debug(message: string, meta?: any) {
    logger.debug(message, this.enrichMeta(meta));
  }

  static silly(message: string, meta?: any) {
    logger.silly(message, this.enrichMeta(meta));
  }

  // 游戏特定的日志方法
  static gameEvent(event: string, sessionId: string, playerId?: string, data?: any) {
    const meta = {
      sessionId,
      playerId,
      data
    };
    logger.info(`[GAME] ${event}`, this.enrichMeta(meta));
  }

  static playerAction(action: string, sessionId: string, playerId: string, details?: any) {
    const meta = {
      sessionId,
      playerId,
      details
    };
    logger.info(`[PLAYER] ${playerId} ${action}`, this.enrichMeta(meta));
  }

  static errorEvent(error: Error, sessionId?: string, playerId?: string) {
    const meta = {
      sessionId,
      playerId,
      stack: error.stack
    };
    logger.error(error.message, this.enrichMeta(meta));
  }

  // 从上下文管理器获取requestId和sessionId并丰富元数据
  private static enrichMeta(meta?: any): any {
    const context = ContextManager.getContext();
    
    const enrichedMeta: any = context ? {
      requestId: context.requestId,
      sessionId: context.sessionId || meta?.sessionId,
      userId: context.userId
    } : {};

    // 如果提供了额外的元数据，将其合并
    if (meta) {
      Object.assign(enrichedMeta, meta);
    }

    return enrichedMeta;
  }
}

export default LoggerService;
