# 德州扑克项目数据库表信息

## 一、当前数据库中的表
通过命令行查询到 `texas_holdem` 数据库中有以下7个表：

```
   table_name    
-----------------
 game_sessions
 users
 game_rooms
 session_players
 game_actions
 ai_analyses
 user_stats
```

## 二、通过 pgAdmin 查看表的方法

### 1. 查看所有表列表
在 pgAdmin 左侧浏览器面板中展开：
```
Servers > localhost > Databases > texas_holdem > Schemas > public > Tables
```

此时您将看到所有7个表的列表，包括：
- `users` - 用户表
- `game_rooms` - 游戏房间表
- `game_sessions` - 游戏会话表
- `session_players` - 会话玩家关联表
- `game_actions` - 游戏动作表
- `ai_analyses` - AI分析记录
- `user_stats` - 用户统计信息

### 2. 查看表结构
右键点击任意表名（如 `users`），选择 **Properties**，在弹出窗口中可以查看：
- 表的基本信息（名称、架构、所有者等）
- 表的列定义（字段名、数据类型、约束等）
- 索引信息
- 约束条件（主键、外键、唯一约束等）

### 3. 查看表数据
右键点击表名，选择 **View/Edit Data**，然后选择：
- **First 100 Rows** - 查看前100行数据（默认）
- **All Rows** - 查看所有数据
- **Filtered Rows** - 根据条件过滤数据

### 4. 使用 SQL 查询所有表
打开 **Query Tool**，输入以下 SQL 语句可以查看所有表的详细信息：

```sql
-- 查看所有表名
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- 查看所有表的结构信息（包含字段名和数据类型）
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, ordinal_position;

-- 查看特定表的所有数据
SELECT * FROM users;
SELECT * FROM game_rooms;
```

## 三、表功能说明

1. **users** - 存储用户基本信息（用户名、邮箱、密码等）
2. **game_rooms** - 存储游戏房间信息（房间名称、类型、状态等）
3. **game_sessions** - 存储游戏会话信息（当前牌局、盲注、状态等）
4. **session_players** - 关联游戏会话和玩家
5. **game_actions** - 存储游戏中的动作记录（下注、跟注、弃牌等）
6. **ai_analyses** - 存储AI分析记录（牌力评估、建议等）
7. **user_stats** - 存储用户统计信息（胜率、总盈利等）

您可以随时通过 pgAdmin 或命令行查询这些表的详细信息。