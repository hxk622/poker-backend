# 德州扑克游戏API文档

## 1. 概述

本文档详细描述了德州扑克游戏后端的所有API接口和WebSocket事件，包括用户管理、房间管理、游戏管理、AI功能和聊天功能。

## 2. 访问信息

- **HTTP API地址**: http://localhost:3000
- **WebSocket端点**: ws://localhost:3000
- **Swagger文档**: http://localhost:3000/api-docs
- **健康检查**: http://localhost:3000/ping

## 3. 认证机制

所有需要认证的接口都使用JWT令牌进行身份验证，令牌需要在请求头中添加：

```
Authorization: Bearer <token>
```

WebSocket连接需要在协议头中传递JWT令牌。

## 4. RESTful API接口

### 4.1 用户管理API (/api/users)

#### 4.1.1 用户注册

```
POST /api/users/register
```

**请求体**:
```json
{
  "username": "player1",
  "email": "player1@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "message": "用户注册成功",
  "userId": "uuid",
  "token": "jwt-token"
}
```

#### 4.1.2 用户登录

```
POST /api/users/login
```

**请求体**:
```json
{
  "email": "player1@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "message": "登录成功",
  "userId": "uuid",
  "token": "jwt-token"
}
```

#### 4.1.3 获取用户资料

```
GET /api/users/profile
```

**响应**:
```json
{
  "id": "uuid",
  "username": "player1",
  "email": "player1@example.com",
  "avatar": "url",
  "chips": 10000
}
```

#### 4.1.4 更新用户资料

```
PUT /api/users/profile
```

**请求体**:
```json
{
  "username": "new-player1",
  "avatar": "new-avatar-url"
}
```

**响应**:
```json
{
  "message": "用户资料更新成功",
  "user": {
    "id": "uuid",
    "username": "new-player1",
    "email": "player1@example.com",
    "avatar": "new-avatar-url",
    "chips": 10000
  }
}
```

#### 4.1.5 获取用户统计数据

```
GET /api/users/stats
```

**响应**:
```json
{
  "gamesPlayed": 10,
  "gamesWon": 3,
  "winRate": 30,
  "totalChips": 12000,
  "avgWinAmount": 4000
}
```

### 4.2 房间管理API (/api/rooms)

#### 4.2.1 创建房间

```
POST /api/rooms
```

**请求体**:
```json
{
  "name": "游戏房间1",
  "maxPlayers": 6,
  "smallBlind": 10,
  "bigBlind": 20,
  "buyIn": 1000
}
```

**响应**:
```json
{
  "message": "房间创建成功",
  "roomId": "uuid"
}
```

#### 4.2.2 获取房间列表

```
GET /api/rooms?status=waiting
```

**查询参数**:
- `status`: 房间状态（waiting, playing, finished）

**响应**:
```json
{
  "rooms": [
    {
      "id": "uuid",
      "name": "游戏房间1",
      "ownerId": "uuid",
      "roomType": "public",
      "smallBlind": 10,
      "bigBlind": 20,
      "maxPlayers": 6,
      "currentPlayers": 2,
      "gameStatus": "waiting"
    }
  ]
}
```

#### 4.2.3 获取房间详情

```
GET /api/rooms/{roomId}
```

**响应**:
```json
{
  "room": {
    "id": "uuid",
    "name": "游戏房间1",
    "ownerId": "uuid",
    "roomType": "public",
    "smallBlind": 10,
    "bigBlind": 20,
    "maxPlayers": 6,
    "currentPlayers": 2,
    "gameStatus": "waiting",
    "players": [
      { "id": "uuid", "username": "player1" },
      { "id": "uuid", "username": "player2" }
    ]
  }
}
```

#### 4.2.4 加入房间

```
POST /api/rooms/{roomId}/join
```

**响应**:
```json
{
  "message": "加入房间成功",
  "roomId": "uuid"
}
```

#### 4.2.5 离开房间

```
POST /api/rooms/{roomId}/leave
```

**响应**:
```json
{
  "message": "离开房间成功",
  "roomId": "uuid"
}
```

### 4.3 游戏管理API (/api/games)

#### 4.3.1 执行游戏动作

```
POST /api/games/{gameId}/action
```

**请求体**:
```json
{
  "action": "raise",
  "amount": 100
}
```

**响应**:
```json
{
  "message": "游戏动作执行成功",
  "gameStatus": { ... }
}
```

#### 4.3.2 获取牌局历史

```
GET /api/games/{gameId}/history
```

**响应**:
```json
{
  "history": [
    {
      "id": "uuid",
      "playerId": "uuid",
      "actionType": "fold",
      "amount": 0,
      "round": "preflop",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### 4.3.3 获取牌局状态

```
GET /api/games/{gameId}
```

**响应**:
```json
{
  "gameStatus": {
    "id": "uuid",
    "roomId": "uuid",
    "dealerId": "uuid",
    "pot": 200,
    "currentRound": "flop",
    "communityCards": { ... },
    "players": [ ... ],
    "status": "in_progress"
  }
}
```

#### 4.3.4 开始新牌局

```
POST /api/games/{gameId}/start
```

**响应**:
```json
{
  "message": "新牌局开始",
  "gameStatus": { ... }
}
```

#### 4.3.5 获取游戏统计数据

```
GET /api/games/stats
```

**响应**:
```json
{
  "totalGames": 100,
  "avgPlayersPerGame": 4,
  "mostActiveRoom": "uuid"
}
```

### 4.4 AI分析API (/api/ai)

#### 4.4.1 AI分析牌局

```
POST /api/ai/{gameId}/analyze-hand
```

**请求体**:
```json
{
  "holeCards": ["As", "Ks"],
  "communityCards": ["2s", "3s", "4s"],
  "potSize": 1000,
  "currentBet": 200,
  "stackSize": 5000
}
```

**响应**:
```json
{
  "analysis": {
    "handStrength": 95,
    "potOdds": 5,
    "impliedOdds": 8,
    "winProbability": 80,
    "recommendedAction": "raise",
    "confidence": 90
  }
}
```

#### 4.4.2 获取AI建议

```
GET /api/ai/{gameId}/suggestions?style=gto
```

**查询参数**:
- `style`: AI风格（gto, professional）

**响应**:
```json
{
  "suggestion": {
    "action": "raise",
    "amount": 500,
    "reasoning": "根据GTO策略，当前手牌强度高，应该提高底池",
    "confidence": 95
  }
}
```

#### 4.4.3 AI模型训练

```
POST /api/ai/train
```

**请求体**:
```json
{
  "trainingData": [
    {
      "userId": "user-uuid",
      "sessionId": "session-uuid",
      "hand": "AsKs",
      "communityCards": "2s3s4s",
      "potSize": 1000,
      "currentBet": 200,
      "stackSize": 5000,
      "action": "raise",
      "actionAmount": 500,
      "result": "win",
      "gamePhase": "preflop"
    }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "trainingId": "training-uuid",
  "message": "AI模型训练成功",
  "metrics": {
    "trainingDataCount": 1,
    "accuracy": 0.92,
    "loss": 0.08,
    "trainingTime": 1250
  }
}
```

**参数说明**:
- `trainingData`: 训练数据数组
  - `userId`: 用户ID
  - `sessionId`: 游戏会话ID
  - `hand`: 玩家手牌（格式如"AsKs"）
  - `communityCards`: 公共牌（格式如"2s3s4s"）
  - `potSize`: 底池大小
  - `currentBet`: 当前下注金额
  - `stackSize`: 玩家筹码量
  - `action`: 玩家动作（fold, call, raise）
  - `actionAmount`: 动作金额（对于raise）
  - `result`: 游戏结果（win, lose）
  - `gamePhase`: 游戏阶段（preflop, flop, turn, river）

**响应说明**:
- `success`: 训练是否成功
- `trainingId`: 训练任务ID
- `message`: 训练结果消息
- `metrics`: 训练指标
  - `trainingDataCount`: 训练数据条数
  - `accuracy`: 训练准确率
  - `loss`: 训练损失值
  - `trainingTime`: 训练耗时（毫秒）

## 5. WebSocket事件

### 5.1 连接与认证

#### 5.1.1 连接成功

**事件类型**: `connection_success`
**方向**: 服务器→客户端

**数据**:
```json
{
  "clientId": "client-uuid",
  "userId": "user-uuid"
}
```

### 5.2 房间事件

#### 5.2.1 加入房间

**事件类型**: `join_room`
**方向**: 客户端→服务器

**数据**:
```json
{
  "roomId": "room-uuid"
}
```

#### 5.2.2 加入房间成功

**事件类型**: `join_room_success`
**方向**: 服务器→客户端

**数据**:
```json
{
  "roomId": "room-uuid"
}
```

#### 5.2.3 离开房间

**事件类型**: `leave_room`
**方向**: 客户端→服务器

**数据**:
```json
{
  "roomId": "room-uuid"
}
```

#### 5.2.4 玩家加入房间

**事件类型**: `player_joined`
**方向**: 服务器→客户端

**数据**:
```json
{
  "roomId": "room-uuid",
  "player": {
    "id": "user-uuid",
    "username": "player1"
  }
}
```

#### 5.2.5 玩家离开房间

**事件类型**: `player_left`
**方向**: 服务器→客户端

**数据**:
```json
{
  "roomId": "room-uuid",
  "playerId": "user-uuid"
}
```

### 5.3 游戏事件

#### 5.3.1 执行游戏动作

**事件类型**: `game_action`
**方向**: 客户端→服务器

**数据**:
```json
{
  "gameId": "game-uuid",
  "action": "call",
  "amount": 50
}
```

#### 5.3.2 游戏状态更新

**事件类型**: `game_state_update`
**方向**: 服务器→客户端

**数据**:
```json
{
  "gameId": "game-uuid",
  "state": {
    "currentRound": "turn",
    "pot": 300,
    "communityCards": ["2s", "3s", "4s", "5s"],
    "players": [ ... ]
  }
}
```

#### 5.3.3 游戏开始

**事件类型**: `game_start`
**方向**: 服务器→客户端

**数据**:
```json
{
  "gameId": "game-uuid",
  "players": [ ... ]
}
```

#### 5.3.4 游戏结束

**事件类型**: `game_end`
**方向**: 服务器→客户端

**数据**:
```json
{
  "gameId": "game-uuid",
  "winner": {
    "id": "user-uuid",
    "username": "player1"
  },
  "pot": 1000
}
```

### 5.4 聊天功能

#### 5.4.1 发送聊天消息

**事件类型**: `chat_message`
**方向**: 客户端→服务器

**数据**:
```json
{
  "roomId": "room-uuid",
  "message": "大家好！",
  "isPrivate": false
}
```

#### 5.4.2 发送私信

**事件类型**: `chat_message`
**方向**: 客户端→服务器

**数据**:
```json
{
  "roomId": "room-uuid",
  "message": "你好，一起组队吧！",
  "isPrivate": true,
  "recipientId": "user-uuid"
}
```

#### 5.4.3 接收聊天消息

**事件类型**: `chat_message`
**方向**: 服务器→客户端

**数据**:
```json
{
  "userId": "user-uuid",
  "username": "player1",
  "message": "大家好！",
  "timestamp": "2024-01-01T00:00:00Z",
  "isPrivate": false
}
```

#### 5.4.4 接收私信

**事件类型**: `chat_message`
**方向**: 服务器→客户端

**数据**:
```json
{
  "userId": "user-uuid",
  "username": "player1",
  "message": "你好，一起组队吧！",
  "timestamp": "2024-01-01T00:00:00Z",
  "isPrivate": true,
  "recipientId": "your-user-uuid"
}
```

#### 5.4.5 接收聊天历史

**事件类型**: `chat_history`
**方向**: 服务器→客户端

**数据**:
```json
[
  {
    "id": "message-uuid",
    "userId": "user-uuid",
    "username": "player1",
    "message": "大家好！",
    "timestamp": "2024-01-01T00:00:00Z",
    "isPrivate": false
  },
  {
    "id": "message-uuid-2",
    "userId": "user-uuid-2",
    "username": "player2",
    "message": "你好！",
    "timestamp": "2024-01-01T00:01:00Z",
    "isPrivate": false
  }
]
```

### 5.5 AI事件

#### 5.5.1 实时分析开关

**事件类型**: `real_time_analysis_toggle`
**方向**: 客户端→服务器

**数据**:
```json
{
  "enabled": true,
  "style": "gto",
  "analysisInterval": 2000,
  "autoAnalyzeOnAction": true
}
```

**参数说明**:
- `enabled`: 是否启用实时分析
- `style`: AI分析风格（gto, professional）
- `analysisInterval`: 分析间隔时间（毫秒）
- `autoAnalyzeOnAction`: 当游戏动作发生时是否自动分析

#### 5.5.2 更新游戏数据

**事件类型**: `update_game_data`
**方向**: 客户端→服务器

**数据**:
```json
{
  "sessionId": "session-uuid",
  "holeCards": [{"rank": "A", "suit": "spades"}, {"rank": "K", "suit": "spades"}],
  "communityCards": [{"rank": "2", "suit": "spades"}, {"rank": "3", "suit": "spades"}, {"rank": "4", "suit": "spades"}],
  "betHistory": [{"userId": "user-uuid", "action": "raise", "amount": 50}],
  "potSize": 1000,
  "currentBet": 200,
  "stackSize": 5000
}
```

**参数说明**:
- `sessionId`: 游戏会话ID
- `holeCards`: 玩家手牌
- `communityCards`: 公共牌
- `betHistory`: 下注历史
- `potSize`: 当前底池大小
- `currentBet`: 当前下注金额
- `stackSize`: 玩家当前筹码量

#### 5.5.3 AI分析结果

**事件类型**: `ai_analysis`
**方向**: 服务器→客户端

**数据**:
```json
{
  "session_id": "session-uuid",
  "analysis": {
    "handStrength": 87,
    "potOdds": 5,
    "impliedOdds": 10,
    "winProbability": 75,
    "confidence": 90
  },
  "suggestion": {
    "action": "raise",
    "amount": 500,
    "reasoning": "基于GTO策略，当前手牌强度高，应该提高底池",
    "confidence": 95
  }
}
```

**参数说明**:
- `session_id`: 游戏会话ID
- `analysis`: AI分析结果
  - `handStrength`: 牌力强度（0-100）
  - `potOdds`: 底池赔率
  - `impliedOdds`: 隐含赔率
  - `winProbability`: 获胜概率（%）
  - `confidence`: 分析置信度（%）
- `suggestion`: AI建议
  - `action`: 推荐动作（fold, call, raise）
  - `amount`: 推荐下注金额
  - `reasoning`: 推荐理由
  - `confidence`: 建议置信度（%）

## 6. 错误处理

所有接口返回统一的错误格式：

```json
{
  "error": "错误消息"
}
```

常见错误码：
- `401`: 未授权或令牌无效
- `403`: 禁止访问
- `404`: 资源不存在
- `500`: 服务器内部错误

## 7. 聊天功能说明

### 7.1 功能特性

1. **实时聊天**: 基于WebSocket实现玩家间的实时消息交流
2. **私信功能**: 支持玩家之间发送私信
3. **聊天历史**: 自动保存最近100条聊天记录
4. **消息区分**: 通过`isPrivate`字段区分普通消息和私信

### 7.2 使用方法

1. **发送普通消息**: 设置`isPrivate`为`false`
2. **发送私信**: 设置`isPrivate`为`true`并指定`recipientId`
3. **获取历史记录**: 加入房间后自动接收历史消息

## 8. WebSocket连接示例

```javascript
const socket = new WebSocket('ws://localhost:3000', ['jwt-token']);

// 连接成功
socket.onopen = () => {
  console.log('WebSocket连接成功');
  
  // 启用实时AI分析
  enableRealTimeAnalysis();
};

// 接收消息
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('收到消息:', data);
  
  // 处理AI分析结果
  if (data.type === 'ai_analysis') {
    handleAIAnalysisResult(data.data);
  }
};

// 发送消息
function sendChatMessage(message, roomId, isPrivate = false, recipientId = null) {
  socket.send(JSON.stringify({
    type: 'chat_message',
    data: {
      message,
      roomId,
      isPrivate,
      recipientId
    }
  }));
}

// 启用实时AI分析
function enableRealTimeAnalysis() {
  socket.send(JSON.stringify({
    type: 'real_time_analysis_toggle',
    data: {
      enabled: true,
      style: 'gto',
      analysisInterval: 2000,
      autoAnalyzeOnAction: true
    }
  }));
}

// 更新游戏数据
function updateGameData(sessionId, holeCards, communityCards, betHistory, potSize, currentBet, stackSize) {
  socket.send(JSON.stringify({
    type: 'update_game_data',
    data: {
      sessionId,
      holeCards,
      communityCards,
      betHistory,
      potSize,
      currentBet,
      stackSize
    }
  }));
}

// 处理AI分析结果
function handleAIAnalysisResult(analysisData) {
  console.log('AI分析结果:', analysisData);
  console.log('牌力强度:', analysisData.analysis.handStrength);
  console.log('推荐动作:', analysisData.suggestion.action, '金额:', analysisData.suggestion.amount);
  console.log('推荐理由:', analysisData.suggestion.reasoning);
}
```

## 9. 技术栈

- **后端框架**: Express.js
- **实时通信**: WebSocket
- **数据库**: PostgreSQL + Redis
- **认证**: JWT
- **API文档**: Swagger
- **开发语言**: TypeScript

## 10. 开发与维护

- API文档会实时维护，与代码保持同步
- 所有接口变更都会在文档中体现
- 建议定期查看Swagger文档获取最新接口信息

---

**更新时间**: 2024-01-02  
**版本**: 1.2.0

### 更新日志

#### 版本 1.2.0 (2024-01-02)
- 新增AI模型训练功能
- 添加AI训练数据API接口
- 支持批量训练数据导入
- 提供训练指标和结果反馈

#### 版本 1.1.0 (2024-01-01)
- 新增实时AI分析功能
- 支持AI分析风格切换（GTO、Professional）
- 添加实时分析开关和配置选项
- 支持游戏数据实时更新和AI分析结果推送