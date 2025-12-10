// WebSocket服务实例导出文件
// 用于避免循环导入问题
import WebSocketService from './websocketService';

// 创建WebSocket服务实例（将在index.ts中初始化）
let websocketServiceInstance: WebSocketService;

// 设置WebSocket服务实例
export const setWebSocketService = (instance: WebSocketService): void => {
  websocketServiceInstance = instance;
};

// 获取WebSocket服务实例
export const getWebSocketService = (): WebSocketService => {
  if (!websocketServiceInstance) {
    throw new Error('WebSocket服务尚未初始化');
  }
  return websocketServiceInstance;
};

export default getWebSocketService;
