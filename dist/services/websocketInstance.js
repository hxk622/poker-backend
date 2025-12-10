"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebSocketService = exports.setWebSocketService = void 0;
// 创建WebSocket服务实例（将在index.ts中初始化）
let websocketServiceInstance;
// 设置WebSocket服务实例
const setWebSocketService = (instance) => {
    websocketServiceInstance = instance;
};
exports.setWebSocketService = setWebSocketService;
// 获取WebSocket服务实例
const getWebSocketService = () => {
    if (!websocketServiceInstance) {
        throw new Error('WebSocket服务尚未初始化');
    }
    return websocketServiceInstance;
};
exports.getWebSocketService = getWebSocketService;
exports.default = exports.getWebSocketService;
//# sourceMappingURL=websocketInstance.js.map