# 德州扑克后端服务

这是一个基于 Node.js 和 TypeScript 开发的德州扑克游戏后端服务，使用 Express 提供 HTTP API，Socket.IO 实现实时通信功能。

## 技术栈

- **语言**: TypeScript
- **框架**: Express.js
- **实时通信**: Socket.IO
- **数据库**: PostgreSQL
- **缓存**: Redis
- **开发工具**: ts-node-dev

## 功能特性

- ✅ HTTP API 服务
- ✅ WebSocket 实时通信
- ✅ 健康检查端点
- ✅ 环境变量配置
- ✅ CORS 支持
- ✅ TypeScript 类型安全

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- PostgreSQL (可选，用于持久化存储)
- Redis (可选，用于缓存)

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制并修改 `.env` 文件：

```bash
cp .env.example .env
```

在 `.env` 文件中配置以下参数：

```env
# 服务器端口
PORT=3000

# PostgreSQL 数据库 (可选)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_NAME=texas_holdem

# Redis 缓存 (可选)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### 运行项目

#### 开发模式

```bash
npm run dev
```

开发服务器将在 `http://localhost:3000` 启动，并支持热重载。

#### 生产模式

```bash
# 先编译 TypeScript
npm run build

# 然后运行生产服务器
npm run start
```

## 项目结构

```
├── src/
│   ├── index.ts          # 主入口文件
│   ├── services/         # 业务逻辑服务
│   └── types/            # TypeScript 类型定义
├── dist/                 # 编译后的 JavaScript 文件
├── sql/                  # 数据库脚本
├── .env                  # 环境变量配置
├── package.json          # 项目依赖配置
├── tsconfig.json         # TypeScript 配置
└── README.md             # 项目说明文档
```

## API 文档

### HTTP API

#### 健康检查

```
GET /ping
```

响应示例：

```json
{
  "message": "Poker后端服务运行正常！",
  "timestamp": "2025-12-09T08:50:46.169Z"
}
```

### WebSocket 事件

#### 连接事件

```
Event: connection
```

当客户端连接成功时触发。

#### 回显测试

```
Event: echo
Data: { any data }
```

服务器将返回：

```
Event: echo_response
Data: {
  "original": { any data },
  "server": "已收到",
  "yourSocketId": "socket-id"
}
```

## 开发指南

### 代码规范

- 使用 TypeScript 编写所有代码
- 遵循 ESLint 代码规范 (可自行配置)
- 提交代码前运行 `npm run build` 确保编译通过

### 开发流程

1. 拉取代码
2. 安装依赖
3. 配置环境变量
4. 运行开发服务器
5. 编写代码
6. 测试功能
7. 提交代码

## 生产部署

1. 确保所有依赖已安装
2. 配置生产环境变量
3. 编译 TypeScript 代码
4. 启动生产服务器
5. 配置反向代理 (如 Nginx)

## 许可证

ISC

## 联系方式

如有问题或建议，请联系项目维护者。