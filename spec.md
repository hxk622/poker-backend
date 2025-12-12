# 德州扑克游戏系统 Specification

## 1. 项目概述

本项目旨在开发一个类似WePoker的德州扑克游戏系统，采用Spec-Driven Development (SDD) 方法进行开发。系统将提供完整的德州扑克游戏功能，并集成AI辅助功能，帮助玩家提升牌技。

### 1.1 技术栈

- **后端**: Node.js + TypeScript + Express.js
- **实时通信**: Socket.IO
- **数据库**: PostgreSQL
- **缓存**: Redis (使用ioredis客户端)
- **AI引擎**: 自定义算法
- **开发工具**: ts-node-dev
- **认证**: JWT (JSON Web Tokens)
- **加密**: bcrypt
- **配置管理**: dotenv

### 1.2 核心价值

- 提供完整的德州扑克游戏体验
- 集成AI辅助功能，帮助玩家提升牌技
- 支持多种游戏模式和房间类型
- 提供详细的游戏统计和分析

## 2. 功能需求

### 2.1 用户管理

#### 2.1.1 用户注册与登录
- 支持手机号/邮箱注册
- 支持密码登录和第三方登录（可选）
- 用户信息验证和安全处理

#### 2.1.2 用户资料
- 查看和编辑个人资料
- 设置头像和昵称
- 查看游戏统计数据

### 2.2 游戏核心功能

#### 2.2.1 游戏房间管理
- 创建私人房间
- 加入公共房间
- 房间列表展示和筛选
- 房间设置（盲注、人数、游戏模式等）

#### 2.2.2 德州扑克游戏流程
- **发牌**: 为每位玩家发放两张底牌
- **盲注处理**: 小盲注和大盲注的自动处理
- **betting轮次**: 支持preflop、flop、turn、river四个阶段
- **摊牌和比牌**: 自动评估玩家手牌强度
- **胜负判定**: 支持单人和多人获胜（底池分割）
- **筹码管理**: 全下处理、底池分割、真实筹码获取

### 2.2.5 牌力评估系统
- **牌型识别**: 支持10种德州扑克牌型（皇家同花顺、同花顺、四条、葫芦、同花、顺子、三条、两对、一对、高牌）
- **牌力计算**: 基于牌型和高牌的综合评估
- **实时更新**: 根据公共牌阶段动态调整牌力

### 2.2.6 日志记录系统
- **游戏事件记录**: 记录游戏开始、结束、玩家动作等关键事件
- **错误日志**: 记录系统错误和异常情况
- **玩家行为分析**: 记录玩家的游戏行为数据

#### 2.2.3 游戏规则
- 标准德州扑克规则
- 支持不同的游戏变体（可选）
- 超时自动处理
- 断线重连机制

### 2.3 AI辅助功能

#### 2.3.1 AI建议系统
- **GTO模式**: 基于博弈论最优策略提供建议
- **Professional模式**: 模拟职业选手的打牌风格
- 实时牌力分析
- 赔率计算
- 对手行为分析

#### 2.3.2 训练模式
- AI对手练习
- 历史牌局复盘
- 错误分析和改进建议

#### 2.3.3 AI模型训练功能
- 支持玩家上传训练数据
- 批量训练数据导入
- 个性化AI模型训练
- 训练结果反馈和指标展示
- 模型版本管理

### 2.4 社交功能

#### 2.4.1 好友系统
- 添加/删除好友
- 邀请好友游戏
- 好友在线状态

#### 2.4.2 聊天功能
- 游戏内聊天
- 好友私聊
- 表情和道具

### 2.5 系统功能

#### 2.5.1 数据统计
- 个人游戏统计
- 胜率分析
- 历史牌局记录

#### 2.5.2 安全与防作弊
- 牌局防作弊机制
- 异常行为检测
- 数据加密和保护

## 3. 技术规范

### 3.1 架构设计

- 前后端分离架构
- RESTful API + WebSocket 通信
- 模块化设计，高内聚低耦合
- 可扩展性和可维护性优先

### 3.2 数据模型

#### 3.2.1 用户表 (users)
- id: UUID
- username: VARCHAR(50) 唯一
- email/phone: VARCHAR(100) 唯一
- password_hash: VARCHAR(255)
- avatar: VARCHAR(255)
- chips: BIGINT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP

#### 3.2.2 游戏房间表 (game_rooms)
- id: UUID
- name: VARCHAR(100)
- owner_id: UUID
- room_type: ENUM('public', 'private')
- small_blind: INT
- big_blind: INT
- max_players: INT
- current_players: INT
- game_status: ENUM('waiting', 'playing', 'finished')
- created_at: TIMESTAMP

#### 3.2.3 牌局表 (game_sessions)
- id: UUID
- room_id: UUID
- dealer_id: UUID
- pot: BIGINT
- current_round: ENUM('preflop', 'flop', 'turn', 'river', 'showdown')
- status: ENUM('in_progress', 'finished')
- created_at: TIMESTAMP
- finished_at: TIMESTAMP

#### 3.2.4 玩家牌局表 (player_sessions)
- id: UUID
- session_id: UUID
- player_id: UUID
- hole_cards: JSONB
- chips_in_pot: BIGINT
- chips_remaining: BIGINT
- status: ENUM('active', 'folded', 'all_in', 'out')
- position: ENUM('sb', 'bb', 'utg', 'mp', 'co', 'btn')

#### 3.2.5 动作记录表 (actions)
- id: UUID
- session_id: UUID
- player_id: UUID
- action_type: ENUM('fold', 'check', 'call', 'raise', 'all_in')
- amount: BIGINT
- round: ENUM('preflop', 'flop', 'turn', 'river')
- created_at: TIMESTAMP

#### 3.2.6 社区牌表 (community_cards)
- id: UUID
- session_id: UUID
- flop: JSONB
- turn: JSONB
- river: JSONB

#### 3.2.7 AI分析表 (ai_analyses)
- id: UUID
- session_id: UUID
- user_id: UUID
- hand_strength: DECIMAL(5,2)
- pot_odds: DECIMAL(5,2)
- recommended_action: VARCHAR(20)
- confidence: DECIMAL(5,2)
- created_at: TIMESTAMP

#### 3.2.8 AI建议表 (ai_suggestions)
- id: UUID
- session_id: UUID
- user_id: UUID
- style: ENUM('gto', 'professional')
- recommended_action: VARCHAR(20)
- recommended_amount: BIGINT (可选)
- confidence: DECIMAL(5,2)
- explanation: TEXT
- created_at: TIMESTAMP

#### 3.2.9 AI训练数据表 (ai_training_data)
- id: UUID
- user_id: UUID
- session_id: UUID
- hand: VARCHAR(10)
- community_cards: VARCHAR(20)
- pot_size: BIGINT
- current_bet: BIGINT
- stack_size: BIGINT
- action: VARCHAR(20)
- action_amount: BIGINT
- result: VARCHAR(20)
- game_phase: ENUM('preflop', 'flop', 'turn', 'river')
- created_at: TIMESTAMP

### 3.3 API 接口规范

#### 3.3.1 用户 API

- `POST /api/users/register` - 用户注册
- `POST /api/users/login` - 用户登录
- `GET /api/users/profile` - 获取用户资料
- `PUT /api/users/profile` - 更新用户资料
- `GET /api/users/stats` - 获取用户统计数据

#### 3.3.2 游戏房间 API

- `POST /api/rooms` - 创建房间
- `GET /api/rooms` - 获取房间列表
- `GET /api/rooms/:roomId` - 获取房间详情
- `POST /api/rooms/:roomId/join` - 加入房间
- `POST /api/rooms/:roomId/leave` - 离开房间

#### 3.3.3 游戏 API

- `POST /api/games/:sessionId/actions` - 执行游戏动作
- `GET /api/games/:sessionId/history` - 获取牌局历史
- `GET /api/games/stats` - 获取游戏统计
- `GET /api/games/:sessionId/status` - 获取牌局状态
- `POST /api/games/:roomId/start` - 开始新牌局

#### 3.3.4 AI API

- `POST /api/ai/analyze` - AI分析牌局
- `GET /api/ai/recommendations` - 获取AI建议
- `POST /api/ai/train` - AI模型训练

#### 3.3.5 健康检查 API

- `GET /ping` - 服务器健康检查

### 3.4 WebSocket 事件规范

#### 3.4.1 连接事件

- `connection` - 客户端连接
- `disconnect` - 客户端断开连接

#### 3.4.2 房间事件

- `room:created` - 房间创建
- `room:joined` - 玩家加入房间
- `room:left` - 玩家离开房间
- `room:updated` - 房间信息更新

#### 3.4.3 游戏事件

- `game:started` - 游戏开始
- `game:hand_started` - 新手牌开始
- `game:dealt` - 发牌
- `game:action_required` - 需要玩家行动
- `game:action_taken` - 玩家行动
- `game:round_ended` - 一轮结束
- `game:hand_ended` - 手牌结束
- `game:ended` - 游戏结束

#### 3.4.4 AI事件

- `real_time_analysis_toggle` - 实时分析开关（客户端→服务器）
- `update_game_data` - 更新游戏数据（客户端→服务器）
- `ai_analysis` - AI分析结果（服务器→客户端）

## 4. AI 功能详细规格

### 4.1 AI 模式

#### 4.1.1 GTO (Game Theory Optimal) 模式

- 基于博弈论最优策略提供建议
- 考虑所有可能的对手行动和概率
- 计算期望价值 (EV) 来决定最佳行动
- 适合希望学习最优策略的玩家

#### 4.1.2 Professional 模式

- 模拟职业选手的打牌风格
- 考虑牌桌动态、对手历史行为
- 更加灵活和适应性强
- 适合希望学习实战技巧的玩家

### 4.2 AI 分析功能

#### 4.2.1 实时分析功能

- 支持实时开关控制
- 可配置分析间隔时间
- 游戏动作触发自动分析
- 支持多风格切换（GTO/Professional）

#### 4.2.2 牌力评估

- 计算手牌强度 (Hand Strength)
- 考虑社区牌的影响
- 提供牌力百分比排名

#### 4.2.3 赔率计算

- 计算底池赔率 (Pot Odds)
- 计算隐含赔率 (Implied Odds)
- 计算胜率 (Win Probability)

#### 4.2.4 建议生成

- 根据当前牌局情况生成建议
- 推荐具体行动（fold、check、call、raise、all_in）
- 提供详细的建议理由和置信度
- 提供建议理由和置信度
- 解释预期结果

### 4.3 AI 数据结构

- **AIAnalysis**: 包含牌力强度、底池赔率、推荐行动、置信度等
- **AISuggestion**: 包含建议风格、推荐行动、推荐金额、置信度、解释等
- **AIActionRecommendation**: 包含具体行动、金额、推理、置信度等
- **AITrainingData**: 包含用户ID、会话ID、手牌、公共牌、底池大小、当前下注、筹码量、动作、结果等训练数据
- **AITrainingResult**: 包含训练状态、训练ID、训练数据量、准确率、损失值、训练时间等训练结果

## 5. 实现细节

### 5.1 服务器架构

- **主入口**: `src/index.ts` - 初始化Express服务器、WebSocket服务和路由
- **路由层**: `src/routes/` - 处理API请求
- **服务层**: `src/services/` - 实现业务逻辑
- **数据层**: 与PostgreSQL和Redis交互
- **类型定义**: `src/types/index.ts` - TypeScript类型定义

### 5.2 WebSocket 实现

- 实现了WebSocket服务，支持实时通信
- 提供WebSocket服务实例供其他模块使用
- 支持客户端连接、断开连接等事件
- 支持房间事件和游戏事件的实时通知
- 游戏状态更新实时广播
- 玩家动作实时同步

### 5.5 游戏服务实现

#### 5.5.1 牌力评估算法
- **evaluateHand**: 实现了完整的德州扑克牌型识别算法
- **calculateHandStrength**: 基于牌型和公共牌阶段的牌力计算
- **牌型权重**: 为10种牌型分配不同权重，实现精准的牌力比较

#### 5.5.2 游戏流程管理
- **startNewGame**: 完整的新牌局初始化流程
- **placeBlinds**: 自动处理盲注分配
- **dealFlop/turn/river**: 自动发放公共牌
- **endCurrentRound**: 自动结束当前轮次并进入下一轮

#### 5.5.3 胜负判定系统
- **determineWinner**: 实现了基于牌力的胜负判定
- **底池分割**: 支持多人获胜时的底池分割
- **筹码分配**: 自动计算并分配获胜筹码

#### 5.5.4 动作验证系统
- **validateAction**: 验证玩家动作的合法性
- **动作类型**: 支持fold、check、call、raise、all_in
- **筹码检查**: 确保玩家有足够的筹码执行动作

### 5.6 日志记录系统

- **LoggerService**: 基于Winston实现的日志服务
- **多级别日志**: 支持error、warn、info、http、verbose、debug、silly级别
- **日志输出**: 控制台输出（开发环境）和文件输出（所有环境）
- **游戏事件追踪**: 记录游戏关键事件和玩家行为

### 5.7 筹码管理系统

- **真实筹码获取**: 从user_accounts表获取玩家真实筹码
- **全下处理**: 自动处理玩家全下情况
- **底池分割算法**: 支持复杂的底池分割场景
- **筹码验证**: 确保筹码操作的合法性和一致性

### 5.3 认证与授权

- 使用JWT进行用户认证
- 实现了认证中间件，保护需要登录的API
- 使用bcrypt对密码进行加密存储

### 5.4 数据库初始化

- 实现了数据库初始化脚本，创建必要的表结构
- 支持环境变量配置数据库连接

### 5.5 健康检查

- 提供了健康检查端点 `/ping`
- 支持服务器状态监控

## 6. 测试策略

### 6.1 单元测试

- 对每个功能模块进行单元测试
- 测试核心算法和逻辑
- 使用 Jest 或 Mocha 进行测试

### 6.2 集成测试

- 测试模块之间的集成
- 测试 API 和 WebSocket 接口
- 测试数据库操作

### 6.3 端到端测试

- 模拟真实用户场景
- 测试完整的游戏流程
- 测试AI功能的准确性

### 6.4 性能测试

- 测试系统的并发处理能力
- 测试响应时间和延迟
- 测试数据库和缓存性能

## 7. 开发计划

### 7.1 第一阶段: 基础架构 (2周)

- 完成项目基础架构搭建
- 实现用户管理功能
- 实现数据库和缓存配置

### 7.2 第二阶段: 游戏核心 (4周)

- 实现德州扑克游戏规则
- 实现游戏房间管理
- 实现WebSocket通信

### 7.3 第三阶段: AI 功能 (4周)

- 实现AI核心算法
- 集成AI分析和建议功能
- 测试AI的准确性和性能

### 7.4 第四阶段: 完善和优化 (2周)

- 完善用户界面（前端）
- 优化系统性能
- 进行全面测试和调试

### 7.5 第五阶段: 部署和上线 (1周)

- 部署到生产环境
- 进行性能监控和维护
- 收集用户反馈

## 8. 验收标准

### 8.1 功能验收

- 所有核心游戏功能正常工作
- AI辅助功能提供准确的建议
- 系统稳定可靠，无明显bug

### 8.2 性能验收

- 系统响应时间 < 100ms
- 支持同时在线用户数 > 1000
- 牌局处理延迟 < 50ms

### 8.3 安全验收

- 用户数据加密存储
- 防作弊机制有效
- 系统无安全漏洞

## 9. 风险评估

### 9.1 技术风险

- AI算法的准确性和性能
- WebSocket的稳定性和扩展性
- 数据库的性能和一致性

### 9.2 业务风险

- 游戏规则的准确性和完整性
- 用户体验的流畅性
- 市场竞争和用户接受度

### 9.3 应对策略

- 进行充分的测试和验证
- 采用模块化设计，便于扩展和维护
- 收集用户反馈，持续改进
- 建立完善的监控和日志系统

## 10. 附录

### 10.1 术语表

- **GTO**: Game Theory Optimal，博弈论最优策略
- **EV**: Expected Value，期望价值
- **Hand Strength**: 手牌强度
- **Pot Odds**: 底池赔率
- **Implied Odds**: 隐含赔率
- **Equity**: 胜率
- **Position**: 位置，如SB（小盲注）、BB（大盲注）、UTG（枪口位）等

### 10.2 参考资料

- 德州扑克规则
- GTO策略相关文献
- Professional扑克选手的打牌风格分析
- 类似WePoker的产品分析
- JWT官方文档
- Socket.IO官方文档
- Express.js官方文档
- PostgreSQL官方文档
- Redis官方文档

### 10.3 项目结构

```
├── src/
│   ├── index.ts              # 主入口文件
│   ├── routes/               # API路由
│   │   ├── ai.ts             # AI相关API
│   │   ├── games.ts          # 游戏相关API
│   │   ├── rooms.ts          # 房间相关API
│   │   └── users.ts          # 用户相关API
│   ├── services/             # 业务逻辑服务
│   │   ├── aiService.ts      # AI服务
│   │   ├── database.ts       # 数据库服务
│   │   ├── dbInit.ts         # 数据库初始化
│   │   ├── gameService.ts    # 游戏服务
│   │   ├── redis.ts          # Redis服务
│   │   ├── roomService.ts    # 房间服务
│   │   ├── userService.ts    # 用户服务
│   │   ├── websocketInstance.ts # WebSocket实例
│   │   └── websocketService.ts  # WebSocket服务
│   └── types/                # TypeScript类型定义
│       └── index.ts          # 类型定义文件
├── .env                      # 环境变量配置
├── .gitignore                # Git忽略文件
├── package.json              # 项目依赖
├── tsconfig.json             # TypeScript配置
└── spec.md                   # 项目规范文档
```