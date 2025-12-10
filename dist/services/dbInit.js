"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./database"));
// 数据库初始化脚本
const initializeDatabase = async () => {
    try {
        // 创建用户表
        await database_1.default.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20) UNIQUE,
        avatar VARCHAR(255),
        chips INT NOT NULL DEFAULT 10000,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        // 创建游戏房间表
        await database_1.default.query(`
      CREATE TABLE IF NOT EXISTS game_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        max_players INT NOT NULL DEFAULT 9,
        min_bet INT NOT NULL DEFAULT 10,
        max_bet INT NOT NULL DEFAULT 1000,
        table_size INT NOT NULL DEFAULT 10000,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        status VARCHAR(50) NOT NULL DEFAULT 'waiting' -- waiting, playing, finished
      );
    `);
        // 创建牌局表
        await database_1.default.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID REFERENCES game_rooms(id),
        start_time TIMESTAMP NOT NULL DEFAULT NOW(),
        end_time TIMESTAMP,
        winner_id UUID REFERENCES users(id),
        pot_amount INT NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'in_progress' -- in_progress, finished
      );
    `);
        // 创建玩家牌局关联表
        await database_1.default.query(`
      CREATE TABLE IF NOT EXISTS session_players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES game_sessions(id),
        user_id UUID REFERENCES users(id),
        chips INT NOT NULL DEFAULT 0,
        bet_amount INT NOT NULL DEFAULT 0,
        hand VARCHAR(20), -- 玩家手牌，格式如 "A♠K♦"
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_winner BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        // 创建游戏动作表
        await database_1.default.query(`
      CREATE TABLE IF NOT EXISTS game_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES game_sessions(id),
        user_id UUID REFERENCES users(id),
        action_type VARCHAR(50) NOT NULL, -- fold, check, call, bet, raise, all_in
        amount INT NOT NULL DEFAULT 0,
        action_time TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        // 创建AI分析表
        await database_1.default.query(`
      CREATE TABLE IF NOT EXISTS ai_analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES game_sessions(id),
        user_id UUID REFERENCES users(id),
        hand_strength DECIMAL(5, 2),
        pot_odds DECIMAL(5, 2),
        recommended_action VARCHAR(50), -- fold, check, call, bet, raise, all_in
        confidence DECIMAL(5, 2),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        // 创建用户统计数据表
        await database_1.default.query(`
      CREATE TABLE IF NOT EXISTS user_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) UNIQUE,
        total_games INT NOT NULL DEFAULT 0,
        total_wins INT NOT NULL DEFAULT 0,
        total_losses INT NOT NULL DEFAULT 0,
        total_chips_won INT NOT NULL DEFAULT 0,
        total_chips_lost INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        console.log('数据库初始化完成');
    }
    catch (error) {
        console.error('数据库初始化失败:', error);
        throw error;
    }
    finally {
        // 关闭数据库连接
        await database_1.default.end();
    }
};
// 执行数据库初始化
if (require.main === module) {
    initializeDatabase().catch(console.error);
}
exports.default = initializeDatabase;
//# sourceMappingURL=dbInit.js.map