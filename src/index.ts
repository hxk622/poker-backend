import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';

// 加载环境变量
dotenv.config();

// 导入数据库和缓存服务
import './services/database';
import './services/redis';

// 创建Express应用
const app = express();
const server = http.createServer(app);

// 基础中间件
app.use(cors());
app.use(express.json());

// 健康检查端点
app.get('/ping', (req, res) => {
  res.json({ 
    message: 'Poker后端服务运行正常！',
    timestamp: new Date().toISOString()
  });
});

// Swagger API文档
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API路由
// 导入用户、房间、游戏等API路由
import usersRouter from './routes/users';
import roomsRouter from './routes/rooms';
import gamesRouter from './routes/games';
import aiRouter from './routes/ai';

app.use('/api/users', usersRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/games', gamesRouter);
app.use('/api/ai', aiRouter);

// 导入WebSocket服务
import WebSocketService from './services/websocketService';
import { setWebSocketService } from './services/websocketInstance';

// 初始化WebSocket服务
const websocketService = new WebSocketService(server);

// 设置WebSocket服务实例供其他模块使用
setWebSocketService(websocketService);

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
    const WebSocket = require('ws');
    const testSocket = new WebSocket(`ws://localhost:${PORT}`);
    
    testSocket.on('open', () => {
      console.log('✅ 服务器自我WebSocket连接测试成功！');
      testSocket.close();
    });
    
    testSocket.on('error', (err: any) => {
      console.error('❌ WebSocket自测失败:', err.message);
    });
  }, 1000);
});

export { app, server, websocketService };