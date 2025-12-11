const WebSocket = require('ws');

// 测试WebSocket连接
const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  console.log('WebSocket连接已打开');
  
  // 测试发送消息（应该会被拒绝，因为没有认证）
  ws.send(JSON.stringify({
    type: 'join_room',
    data: { roomId: 'test-room-123' }
  }));
});

ws.on('message', (data) => {
  console.log('收到服务器消息:', JSON.parse(data));
});

ws.on('close', () => {
  console.log('WebSocket连接已关闭');
});

ws.on('error', (error) => {
  console.error('WebSocket错误:', error);
});