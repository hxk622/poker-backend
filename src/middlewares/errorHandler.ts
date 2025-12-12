import express from 'express';
import { AppError } from '../utils/errors';
import LoggerService from '../services/loggerService';

// 全局异常处理中间件
export const errorHandler = (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // 日志记录
  LoggerService.error('全局异常捕获', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });

  // 处理自定义应用错误
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
      timestamp: err.timestamp.toISOString(),
      requestId: req.headers['x-request-id']
    });
  }

  // 处理JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: '无效的令牌',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: '令牌已过期',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  }

  // 处理Validation错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: '数据验证失败',
      details: (err as any).errors,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  }

  // 处理数据库约束错误
  if ((err as any).code === '23505') { // PostgreSQL唯一约束错误
    return res.status(409).json({
      error: '数据已存在',
      details: err.message,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  }

  // 默认处理其他未知错误
  return res.status(500).json({
    error: '服务器内部错误',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id']
  });
};

// 未处理路由的处理中间件
export const notFoundHandler = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const error = new AppError(`未找到路由: ${req.originalUrl}`, 404);
  next(error);
};
