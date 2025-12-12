import { Request, Response, NextFunction } from 'express';
import LoggerService from '../services/loggerService';
import { ContextManager } from '../utils/contextManager';

// 请求上下文中间件
export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // 生成requestId
  const requestId = ContextManager.generateRequestId();
  
  // 尝试从请求头或Cookie中获取sessionId，如果没有则生成一个
  let sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) {
    sessionId = ContextManager.generateSessionId();
    // 将sessionId设置到响应头中
    res.setHeader('X-Session-Id', sessionId);
  }
  
  // 尝试从认证信息中获取userId（如果有的话）
  const userId = (req as any).user?.id;
  
  // 设置请求上下文
  ContextManager.setContext({
    requestId,
    sessionId,
    userId
  });
  
  // 将requestId和sessionId设置到响应头中
  res.setHeader('X-Request-Id', requestId);
  
  next();
};

// API请求日志中间件
export const apiLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // 记录请求开始时间
  const startTime = Date.now();
  
  // 获取requestId和sessionId
  const requestId = ContextManager.getRequestId();
  const sessionId = ContextManager.getSessionId();
  
  // 记录请求信息
  LoggerService.info('API请求开始', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  // 保存原始的res.send方法
  const originalSend = res.send.bind(res);
  
  // 重写res.send方法以记录响应信息
  res.send = (body: any) => {
    // 计算请求处理时间
    const duration = Date.now() - startTime;
    
    // 尝试解析响应体
    let responseBody = body;
    if (typeof body === 'string') {
      try {
        responseBody = JSON.parse(body);
      } catch (e) {
        // 如果不是JSON，保持原样
      }
    }
    
    // 记录响应信息
    LoggerService.info('API请求结束', {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseBody: responseBody,
      method: req.method,
      path: req.path
    });
    
    // 调用原始的res.send方法
    return originalSend(body);
  };
  
  next();
};
