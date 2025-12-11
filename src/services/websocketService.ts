import { WebSocketServer, WebSocket, RawData } from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import { WebSocketEvent, RealTimeAnalysisConfig, RealTimeAnalysisToggleEvent, AIAnalysisEvent } from '../types';
import LoggerService from './loggerService';
import { aiService } from './aiService';

// WebSocket连接客户端类型
export interface WebSocketClient {
  id: string;
  userId: string;
  socket: WebSocket;
  roomId?: string;
  sessionId?: string;
  realTimeAnalysisConfig?: RealTimeAnalysisConfig;
  analysisIntervalId?: NodeJS.Timeout;
}

// WebSocket服务类
export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  // 聊天历史记录，按房间ID存储
  private chatHistory: Map<string, Array<{ id: string; userId: string; username?: string; message: string; timestamp: string; isPrivate?: boolean; recipientId?: string }>> = new Map();
  // 最大历史记录数量
  private maxHistoryLength = 100;
  // AI分析相关的游戏数据缓存
  private gameDataCache: Map<string, { holeCards: any[], communityCards: any[], betHistory: any[], potSize: number, currentBet: number, stackSize: number }> = new Map();

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
    LoggerService.debug('WebSocket connection attempt received', { remoteAddress: req.socket.remoteAddress });
    
    // 从请求头获取token
    const token = req.headers['sec-websocket-protocol']?.split(',')[0]?.trim();
    
    if (!token) {
      LoggerService.warn('WebSocket connection rejected: Missing authentication token', { remoteAddress: req.socket.remoteAddress });
      socket.close(1008, '缺少认证令牌');
      return;
    }

    try {
      // 验证JWT令牌
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      // 兼容两种格式：decoded.id和decoded.userId
      const userId = decoded.id || decoded.userId;
      const clientId = `${userId}-${Date.now()}`;

      LoggerService.info('WebSocket connection authenticated', { userId, clientId, remoteAddress: req.socket.remoteAddress });
      
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
      // TypeScript中catch的error默认是unknown类型，需要进行类型断言
      const err = error as Error;
      LoggerService.error('WebSocket authentication failed', { remoteAddress: req.socket.remoteAddress, error: err.message, stack: err.stack });
      socket.close(1008, '无效的认证令牌');
    }
  }

  private handleMessage(clientId: string, data: RawData): void {
    try {
      // 将RawData转换为字符串
      const messageString = typeof data === 'string' ? data : data.toString();
      const message: WebSocketEvent = JSON.parse(messageString);
      const client = this.clients.get(clientId);

      if (!client) {
        LoggerService.warn('Received message from unknown client', { clientId });
        return;
      }

      LoggerService.info('Processing WebSocket message', {
        clientId,
        userId: client.userId,
        messageType: message.type
      });

      // 根据消息类型处理
      switch (message.type) {
        case 'join_room':
          LoggerService.debug('Handling join_room event', { clientId, roomId: message.data?.roomId });
          this.handleJoinRoom(client, message.data);
          break;
        case 'leave_room':
          LoggerService.debug('Handling leave_room event', { clientId, roomId: message.data?.roomId });
          this.handleLeaveRoom(client, message.data);
          break;
        case 'game_action':
          LoggerService.debug('Handling game_action event', { clientId, actionType: message.data?.action?.action_type, sessionId: message.data?.sessionId });
          this.handleGameAction(client, message.data);
          break;
        case 'chat_message':
          LoggerService.debug('Handling chat_message event', { clientId, message: message.data?.message?.substring(0, 50) + '...', roomId: message.data?.roomId });
          this.handleChatMessage(client, message.data);
          break;
        case 'real_time_analysis_toggle':
          LoggerService.debug('Handling real_time_analysis_toggle event', { clientId, enabled: message.data?.enabled });
          this.handleRealTimeAnalysisToggle(client, message.data as RealTimeAnalysisToggleEvent['data']);
          break;
        case 'update_game_data':
          LoggerService.debug('Handling update_game_data event', { clientId, sessionId: message.data?.sessionId });
          this.handleGameDataUpdate(client, message.data);
          break;
        default:
          LoggerService.warn('Unknown message type', { clientId, messageType: message.type });
          this.sendToClient(clientId, {
            type: 'error',
            data: { message: '未知的消息类型' }
          });
      }
    } catch (error) {
      // TypeScript中catch的error默认是unknown类型，需要进行类型断言
      const err = error as Error;
      LoggerService.error('Error processing WebSocket message', { clientId, error: err.message, stack: err.stack });
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: '消息格式错误' }
      });
    }
  }

  private handleJoinRoom(client: WebSocketClient, data: any): void {
    const { roomId } = data;
    if (!roomId) {
      LoggerService.warn('Missing roomId in join_room request', { clientId: client.id, userId: client.userId });
      this.sendToClient(client.id, {
        type: 'error',
        data: { message: '缺少房间ID' }
      });
      return;
    }

    LoggerService.info('Player joining room', { clientId: client.id, userId: client.userId, roomId });

    // 更新客户端房间信息
    client.roomId = roomId;
    this.clients.set(client.id, client);

    // 通知房间内其他用户
    LoggerService.debug('Broadcasting player joined notification', { clientId: client.id, userId: client.userId, roomId });
    this.broadcastToRoom(roomId, {
      type: 'player_joined',
      data: { userId: client.userId }
    }, client.id);

    // 发送聊天历史给新加入的玩家
    LoggerService.debug('Sending chat history to new player', { clientId: client.id, roomId, historyLength: this.getChatHistory(roomId).length });
    this.sendChatHistory(client.id, roomId);

    // 发送加入房间成功消息
    this.sendToClient(client.id, {
      type: 'join_room_success',
      data: { roomId }
    });
  }

  private handleLeaveRoom(client: WebSocketClient, data: any): void {
    const { roomId } = data;
    if (!roomId || client.roomId !== roomId) {
      LoggerService.warn('Invalid roomId in leave_room request', { clientId: client.id, userId: client.userId, requestedRoomId: roomId, currentRoomId: client.roomId });
      this.sendToClient(client.id, {
        type: 'error',
        data: { message: '无效的房间ID' }
      });
      return;
    }

    LoggerService.info('Player leaving room', { clientId: client.id, userId: client.userId, roomId });

    // 通知房间内其他用户
    LoggerService.debug('Broadcasting player left notification', { clientId: client.id, userId: client.userId, roomId });
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
      LoggerService.warn('Missing required parameters in game_action', { clientId: client.id, userId: client.userId, hasSessionId: !!sessionId, hasAction: !!action });
      this.sendToClient(client.id, {
        type: 'error',
        data: { message: '缺少必要参数' }
      });
      return;
    }

    LoggerService.info('Processing game action', { clientId: client.id, userId: client.userId, sessionId, actionType: action.action_type, roomId: client.roomId });

    // 更新客户端会话信息
    client.sessionId = sessionId;
    this.clients.set(client.id, client);

    // 广播游戏动作到房间内所有用户
    if (client.roomId) {
      LoggerService.debug('Broadcasting game action to room', { clientId: client.id, userId: client.userId, sessionId, actionType: action.action_type, roomId: client.roomId });
      this.broadcastToRoom(client.roomId, {
        type: 'game_action',
        data: {
          sessionId,
          userId: client.userId,
          action
        }
      });
    } else {
      LoggerService.warn('Client not in any room for game action', { clientId: client.id, userId: client.userId, sessionId });
      this.sendToClient(client.id, {
        type: 'error',
        data: { message: '玩家不在任何房间中' }
      });
    }
  }

  private handleChatMessage(client: WebSocketClient, data: any): void {
    const { message, roomId, isPrivate, recipientId } = data;
    if (!message || !roomId) {
      LoggerService.warn('Missing required parameters in chat_message', { clientId: client.id, userId: client.userId, hasMessage: !!message, hasRoomId: !!roomId });
      this.sendToClient(client.id, {
        type: 'error',
        data: { message: '缺少必要参数' }
      });
      return;
    }

    // 创建聊天消息对象
    const chatMessage = {
      id: Date.now().toString(),
      userId: client.userId,
      message,
      roomId,
      timestamp: new Date().toISOString(),
      isPrivate: isPrivate || false,
      recipientId
    };

    LoggerService.info('Processing chat message', {
      clientId: client.id,
      userId: client.userId,
      roomId,
      isPrivate: chatMessage.isPrivate,
      recipientId: chatMessage.recipientId,
      messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
    });

    // 保存到聊天历史
    if (!this.chatHistory.has(roomId)) {
      this.chatHistory.set(roomId, []);
    }
    const history = this.chatHistory.get(roomId)!;
    history.push(chatMessage);
    
    // 限制历史记录长度
    if (history.length > this.maxHistoryLength) {
      const removedMessage = history.shift();
      LoggerService.debug('Removed old chat message to limit history length', { roomId, removedMessageId: removedMessage?.id });
    }

    LoggerService.debug('Current chat history length', { roomId, historyLength: history.length });

    if (isPrivate && recipientId) {
      // 私信功能：只发送给指定的接收者和发送者
      LoggerService.debug('Sending private message', { clientId: client.id, userId: client.userId, recipientId, roomId });
      this.sendChatMessageToUser(chatMessage, recipientId);
      this.sendChatMessageToUser(chatMessage, client.userId);
    } else {
      // 广播聊天消息到房间内所有用户
      LoggerService.debug('Broadcasting chat message to room', { clientId: client.id, userId: client.userId, roomId });
      this.broadcastToRoom(roomId, {
        type: 'chat_message',
        data: chatMessage
      });
    }
  }

  private handleClose(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      LoggerService.info('Client connection closed', {
        clientId,
        userId: client.userId,
        roomId: client.roomId,
        sessionId: client.sessionId
      });
      
      // 清理分析定时器
      if (client.analysisIntervalId) {
        clearInterval(client.analysisIntervalId);
        client.analysisIntervalId = undefined;
      }
      
      // 通知房间内其他用户
      if (client.roomId) {
        LoggerService.debug('Broadcasting player disconnected notification', { clientId, userId: client.userId, roomId: client.roomId });
        this.broadcastToRoom(client.roomId, {
          type: 'player_disconnected',
          data: { userId: client.userId }
        }, client.id);
      }

      // 移除客户端
      this.clients.delete(clientId);
      LoggerService.debug('Client removed from clients list', { clientId, remainingClients: this.clients.size });
    } else {
      LoggerService.warn('Attempted to handle close for unknown client', { clientId });
    }
  }

  private handleError(clientId: string, error: Error): void {
    LoggerService.error('WebSocket client error', { clientId, error: error.message, stack: error.stack });
    const client = this.clients.get(clientId);
    if (client) {
      LoggerService.debug('Removing client due to error', { clientId, userId: client.userId });
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

  // 发送聊天消息给特定用户
  private sendChatMessageToUser(message: any, userId: string): void {
    this.clients.forEach((client) => {
      if (client.userId === userId && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify({
          type: 'chat_message',
          data: message
        }));
      }
    });
  }

  // 获取房间的聊天历史
  public getChatHistory(roomId: string): Array<{ id: string; userId: string; username?: string; message: string; timestamp: string; isPrivate?: boolean; recipientId?: string }> {
    return this.chatHistory.get(roomId) || [];
  }

  // 发送聊天历史给客户端
  public sendChatHistory(clientId: string, roomId: string): void {
    const history = this.getChatHistory(roomId);
    this.sendToClient(clientId, {
      type: 'chat_history',
      data: history
    });
  }

  // 处理实时AI分析开关
  private handleRealTimeAnalysisToggle(client: WebSocketClient, data: RealTimeAnalysisToggleEvent['data']): void {
    const { enabled, style } = data;
    
    // 清理现有定时器
    if (client.analysisIntervalId) {
      clearInterval(client.analysisIntervalId);
      client.analysisIntervalId = undefined;
    }
    
    // 配置实时分析
    client.realTimeAnalysisConfig = {
      enabled,
      analysisInterval: 5000, // 默认5秒
      style: style || 'gto',
      autoAnalyzeOnAction: true
    };
    
    LoggerService.info('Real-time AI analysis toggle', {
      clientId: client.id,
      userId: client.userId,
      enabled,
      style: client.realTimeAnalysisConfig.style
    });
    
    // 如果启用，启动定时器
    if (enabled) {
      this.startRealTimeAnalysis(client);
    }
    
    // 发送确认消息
    this.sendToClient(client.id, {
      type: 'real_time_analysis_toggle_success',
      data: { enabled, style: client.realTimeAnalysisConfig.style }
    });
  }

  // 处理游戏数据更新
  private handleGameDataUpdate(client: WebSocketClient, data: any): void {
    const { sessionId, holeCards, communityCards, betHistory, potSize, currentBet, stackSize } = data;
    
    if (!sessionId) return;
    
    // 更新游戏数据缓存
    this.gameDataCache.set(sessionId, {
      holeCards,
      communityCards,
      betHistory,
      potSize,
      currentBet,
      stackSize
    });
    
    // 如果启用了自动分析，立即进行一次分析
    if (client.realTimeAnalysisConfig?.enabled && client.realTimeAnalysisConfig?.autoAnalyzeOnAction) {
      this.performRealTimeAnalysis(client, sessionId);
    }
  }

  // 启动实时AI分析定时器
  private startRealTimeAnalysis(client: WebSocketClient): void {
    if (!client.sessionId || !client.realTimeAnalysisConfig?.enabled) return;
    
    const interval = client.realTimeAnalysisConfig.analysisInterval || 5000;
    
    client.analysisIntervalId = setInterval(() => {
      if (client.sessionId) {
        this.performRealTimeAnalysis(client, client.sessionId);
      }
    }, interval);
    
    LoggerService.debug('Real-time AI analysis started', {
      clientId: client.id,
      userId: client.userId,
      interval
    });
  }

  // 执行实时AI分析
  private performRealTimeAnalysis(client: WebSocketClient, sessionId: string): void {
    const gameData = this.gameDataCache.get(sessionId);
    
    if (!gameData || !client.realTimeAnalysisConfig) return;
    
    try {
      const { holeCards, communityCards, betHistory, potSize, currentBet, stackSize } = gameData;
      
      // 执行AI分析
      const analysis = aiService.analyzeHand(
        client.userId,
        sessionId,
        holeCards,
        communityCards,
        betHistory,
        potSize,
        currentBet,
        stackSize
      );
      
      // 获取AI建议
      const suggestion = aiService.getSuggestion(
        client.userId,
        sessionId,
        client.realTimeAnalysisConfig.style,
        holeCards,
        communityCards,
        betHistory,
        potSize,
        currentBet,
        stackSize
      );
      
      // 发送分析结果
      const event: AIAnalysisEvent = {
        type: 'ai_analysis',
        data: {
          session_id: sessionId,
          analysis,
          suggestion
        }
      };
      
      this.sendToClient(client.id, event);
      
      LoggerService.debug('Real-time AI analysis performed', {
        clientId: client.id,
        userId: client.userId,
        sessionId
      });
      
    } catch (error: any) {
      LoggerService.error('Error in real-time AI analysis', {
        clientId: client.id,
        userId: client.userId,
        sessionId,
        error: error.message
      });
    }
  }

  // 获取客户端数量
  public getClientCount(): number {
    return this.clients.size;
  }

  // 关闭WebSocket服务器
  public close(): void {
    // 清理所有定时器
    this.clients.forEach((client) => {
      if (client.analysisIntervalId) {
        clearInterval(client.analysisIntervalId);
      }
    });
    this.wss.close();
  }
}

export default WebSocketService;
