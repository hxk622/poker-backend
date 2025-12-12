import { v4 as uuidv4 } from 'uuid';

// 创建一个AsyncLocalStorage来存储请求上下文
import { AsyncLocalStorage } from 'async_hooks';

// 定义上下文接口
export interface RequestContext {
  requestId: string;
  sessionId?: string;
  userId?: string;
}

// 创建AsyncLocalStorage实例
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

// 上下文管理工具类
export class ContextManager {
  // 生成唯一的requestId
  static generateRequestId(): string {
    return uuidv4();
  }

  // 生成唯一的sessionId
  static generateSessionId(): string {
    return uuidv4();
  }

  // 设置请求上下文
  static setContext(context: RequestContext): void {
    requestContextStorage.enterWith(context);
  }

  // 获取当前请求上下文
  static getContext(): RequestContext | undefined {
    return requestContextStorage.getStore();
  }

  // 获取当前requestId
  static getRequestId(): string | undefined {
    const context = this.getContext();
    return context?.requestId;
  }

  // 获取当前sessionId
  static getSessionId(): string | undefined {
    const context = this.getContext();
    return context?.sessionId;
  }

  // 设置sessionId到当前上下文
  static setSessionId(sessionId: string): void {
    const context = this.getContext();
    if (context) {
      context.sessionId = sessionId;
    }
  }

  // 设置userId到当前上下文
  static setUserId(userId: string): void {
    const context = this.getContext();
    if (context) {
      context.userId = userId;
    }
  }
}
