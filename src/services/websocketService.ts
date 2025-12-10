import { WebSocketServer, WebSocket, RawData } from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import { WebSocketEvent } from '../types';

// WebSocket连接客户端类型
export interface WebSocketClient {
  id: string;
  userId: string;
  socket: WebSocket;
  roomId?: string;
  sessionId?: string;
}

// WebSocket服务类
export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ server });
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.wss.on('connection', (socket: WebSocket, req: http.IncomingMessage) => {
      this.handleConnection(socket, req);
    });
  }

  private handleConnection(socket: WebSocket, req: http.IncomingMessage): void {
    // 从请求头获取token
    const token = req.headers['sec-websocket-protocol']?.split(',')[0]?.trim();
    
    if (!token) {
      socket.close(1008, '缺少认证令牌');
      return;
    }

    try {
      // 验证JWT令牌
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      const userId = decoded.id;
      const clientId = `${userId}-${Date.now()}`;

      // 创建客户端对象
      const client: WebSocketClient = {
        id: clientId,
        userId,
        socket
      };

      // 添加到客户端映射
      this.clients.set(clientId, client);

      // 设置客户端事件处理
      socket.on('message', (data) => this.handleMessage(clientId, data));
      socket.on('close', () => this.handleClose(clientId));
      socket.on('error', (error) => this.handleError(clientId, error));

      // 发送连接成功消息
      this.sendToClient(clientId, {
        type: 'connection_success',
        data: { clientId, userId }
      });

    } catch (error) {
      socket.close(1008, '无效的认证令牌');
    }
  }

  private handleMessage(clientId: string, data: RawData): void {
    try {
      // 将RawData转换为字符串
      const messageString = typeof data === 'string' ? data : data.toString();
      const message: WebSocketEvent = JSON.parse(messageString);
      const client = this.clients.get(clientId);

      if (!client) return;

      // 根据消息类型处理
      switch (message.type) {
        case 'join_room':
          this.handleJoinRoom(client, message.data);
          break;
        case 'leave_room':
          this.handleLeaveRoom(client, message.data);
          break;
        case 'game_action':
          this.handleGameAction(client, message.data);
          break;
        case 'chat_message':
          this.handleChatMessage(client, message.data);
          break;
        default:
          this.sendToClient(clientId, {
            type: 'error',
            data: { message: '未知的消息类型' }
          });
      }
    } catch (error) {
      console.error('处理WebSocket消息错误:', error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: '消息格式错误' }
      });
    }
  }

  private handleJoinRoom(client: WebSocketClient, data: any): void {
    const { roomId } = data;
    if (!roomId) {
      this.sendToClient(client.id, {
        type: 'error',
        data: { message: '缺少房间ID' }
      });
      return;
    }

    // 更新客户端房间信息
    client.roomId = roomId;
    this.clients.set(client.id, client);

    // 通知房间内其他用户
    this.broadcastToRoom(roomId, {
      type: 'player_joined',
      data: { userId: client.userId }
    }, client.id);

    // 发送加入房间成功消息
    this.sendToClient(client.id, {
      type: 'join_room_success',
      data: { roomId }
    });
  }

  private handleLeaveRoom(client: WebSocketClient, data: any): void {
    const { roomId } = data;
    if (!roomId || client.roomId !== roomId) {
      this.sendToClient(client.id, {
        type: 'error',
        data: { message: '无效的房间ID' }
      });
      return;
    }

    // 通知房间内其他用户
    this.broadcastToRoom(roomId, {
      type: 'player_left',
      data: { userId: client.userId }
    }, client.id);

    // 更新客户端房间信息
    client.roomId = undefined;
    this.clients.set(client.id, client);

    // 发送离开房间成功消息
    this.sendToClient(client.id, {
      type: 'leave_room_success',
      data: { roomId }
    });
  }

  private handleGameAction(client: WebSocketClient, data: any): void {
    const { sessionId, action } = data;
    if (!sessionId || !action) {
      this.sendToClient(client.id, {
        type: 'error',
        data: { message: '缺少必要参数' }
      });
      return;
    }

    // 更新客户端会话信息
    client.sessionId = sessionId;
    this.clients.set(client.id, client);

    // 广播游戏动作到房间内所有用户
    this.broadcastToRoom(client.roomId!, {
      type: 'game_action',
      data: {
        sessionId,
        userId: client.userId,
        action
      }
    });
  }

  private handleChatMessage(client: WebSocketClient, data: any): void {
    const { message, roomId } = data;
    if (!message || !roomId) {
      this.sendToClient(client.id, {
        type: 'error',
        data: { message: '缺少必要参数' }
      });
      return;
    }

    // 广播聊天消息到房间内所有用户
    this.broadcastToRoom(roomId, {
      type: 'chat_message',
      data: {
        userId: client.userId,
        message,
        timestamp: new Date().toISOString()
      }
    });
  }

  private handleClose(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      // 通知房间内其他用户
      if (client.roomId) {
        this.broadcastToRoom(client.roomId, {
          type: 'player_disconnected',
          data: { userId: client.userId }
        }, client.id);
      }

      // 移除客户端
      this.clients.delete(clientId);
    }
  }

  private handleError(clientId: string, error: Error): void {
    console.error('WebSocket客户端错误:', error);
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
    }
  }

  // 发送消息给单个客户端
  public sendToClient(clientId: string, message: WebSocketEvent): void {
    const client = this.clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }

  // 广播消息到房间内所有客户端
  public broadcastToRoom(roomId: string, message: WebSocketEvent, excludeClientId?: string): void {
    this.clients.forEach((client) => {
      if (client.roomId === roomId && 
          client.id !== excludeClientId && 
          client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(message));
      }
    });
  }

  // 广播消息到所有客户端
  public broadcast(message: WebSocketEvent): void {
    this.clients.forEach((client) => {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(message));
      }
    });
  }

  // 获取房间内的客户端列表
  public getClientsInRoom(roomId: string): WebSocketClient[] {
    return Array.from(this.clients.values())
      .filter(client => client.roomId === roomId);
  }

  // 获取客户端数量
  public getClientCount(): number {
    return this.clients.size;
  }

  // 关闭WebSocket服务器
  public close(): void {
    this.wss.close();
  }
}

export default WebSocketService;
