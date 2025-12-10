"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.websocketService = exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// 加载环境变量
dotenv_1.default.config();
// 导入数据库和缓存服务
require("./services/database");
require("./services/redis");
// 创建Express应用
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
// 基础中间件
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// 健康检查端点
app.get('/ping', (req, res) => {
    res.json({
        message: 'Poker后端服务运行正常！',
        timestamp: new Date().toISOString()
    });
});
// API路由
// TODO: 添加用户、房间、游戏等API路由
app.use('/api/users', require('./routes/users'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/games', require('./routes/games'));
app.use('/api/ai', require('./routes/ai'));
// 导入WebSocket服务
const websocketService_1 = __importDefault(require("./services/websocketService"));
const websocketInstance_1 = require("./services/websocketInstance");
// 初始化WebSocket服务
const websocketService = new websocketService_1.default(server);
exports.websocketService = websocketService;
// 设置WebSocket服务实例供其他模块使用
(0, websocketInstance_1.setWebSocketService)(websocketService);
// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
  🎉 德州扑克后端服务器已启动！
  ✅ HTTP API 地址: http://localhost:${PORT}
  ✅ 健康检查: http://localhost:${PORT}/ping
  ✅ WebSocket 端点: ws://localhost:${PORT}
  `);
    // 自测代码
    setTimeout(() => {
        const testSocket = require('socket.io-client')(`http://localhost:${PORT}`);
        testSocket.on('connect', () => {
            console.log('✅ 服务器自我WebSocket连接测试成功！');
            testSocket.disconnect();
        });
        testSocket.on('connect_error', (err) => {
            console.error('❌ WebSocket自测失败:', err.message);
        });
    }, 1000);
});
//# sourceMappingURL=index.js.map