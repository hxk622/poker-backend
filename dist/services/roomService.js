"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRoomStatus = exports.leaveRoom = exports.joinRoom = exports.getRoomById = exports.getRoomList = exports.createRoom = void 0;
const database_1 = __importDefault(require("./database"));
// 创建游戏房间
const createRoom = async (userId, input) => {
    const { name, description = '', max_players = 9, min_bet = 10, max_bet = 1000, table_size = 10000 } = input;
    const result = await database_1.default.query(`INSERT INTO game_rooms (
      name, description, max_players, min_bet, max_bet, table_size, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [name, description, max_players, min_bet, max_bet, table_size, userId]);
    return result.rows[0];
};
exports.createRoom = createRoom;
// 获取房间列表
const getRoomList = async (status) => {
    let query = 'SELECT * FROM game_rooms';
    let params = [];
    if (status) {
        query += ' WHERE status = $1';
        params.push(status);
    }
    const result = await database_1.default.query(query, params);
    return result.rows;
};
exports.getRoomList = getRoomList;
// 获取房间详情
const getRoomById = async (roomId) => {
    const result = await database_1.default.query('SELECT * FROM game_rooms WHERE id = $1', [roomId]);
    if (result.rows.length === 0) {
        return null;
    }
    return result.rows[0];
};
exports.getRoomById = getRoomById;
// 加入房间
const joinRoom = async (roomId, userId) => {
    // 检查房间是否存在
    const room = await (0, exports.getRoomById)(roomId);
    if (!room) {
        throw new Error('房间不存在');
    }
    // 检查房间是否已满
    const playerCountResult = await database_1.default.query('SELECT COUNT(*) as count FROM room_players WHERE room_id = $1 AND status = $2', [roomId, 'active']);
    const currentPlayers = parseInt(playerCountResult.rows[0].count, 10);
    if (currentPlayers >= room.max_players) {
        throw new Error('房间已满');
    }
    // 检查玩家是否已在房间内
    const existingPlayerResult = await database_1.default.query('SELECT * FROM room_players WHERE room_id = $1 AND user_id = $2', [roomId, userId]);
    if (existingPlayerResult.rows.length > 0) {
        // 如果玩家已在房间内，更新状态为active
        await database_1.default.query('UPDATE room_players SET status = $1, updated_at = NOW() WHERE room_id = $2 AND user_id = $3', ['active', roomId, userId]);
    }
    else {
        // 将玩家加入房间
        await database_1.default.query('INSERT INTO room_players (room_id, user_id, status, joined_at) VALUES ($1, $2, $3, NOW())', [roomId, userId, 'active']);
    }
    // 更新房间当前玩家数量
    await database_1.default.query('UPDATE game_rooms SET current_players = current_players + 1 WHERE id = $1', [roomId]);
    return true;
};
exports.joinRoom = joinRoom;
// 离开房间
const leaveRoom = async (roomId, userId) => {
    // 检查房间是否存在
    const room = await (0, exports.getRoomById)(roomId);
    if (!room) {
        throw new Error('房间不存在');
    }
    // 检查玩家是否在房间内
    const existingPlayerResult = await database_1.default.query('SELECT * FROM room_players WHERE room_id = $1 AND user_id = $2 AND status = $3', [roomId, userId, 'active']);
    if (existingPlayerResult.rows.length === 0) {
        throw new Error('玩家不在该房间内');
    }
    // 更新玩家状态为离开
    await database_1.default.query('UPDATE room_players SET status = $1, updated_at = NOW() WHERE room_id = $2 AND user_id = $3', ['left', roomId, userId]);
    // 更新房间当前玩家数量
    await database_1.default.query('UPDATE game_rooms SET current_players = GREATEST(current_players - 1, 0) WHERE id = $1', [roomId]);
    // 检查房间是否为空，如果为空则更新房间状态为关闭
    const playerCountResult = await database_1.default.query('SELECT COUNT(*) as count FROM room_players WHERE room_id = $1 AND status = $2', [roomId, 'active']);
    const remainingPlayers = parseInt(playerCountResult.rows[0].count, 10);
    if (remainingPlayers === 0) {
        await (0, exports.updateRoomStatus)(roomId, 'closed');
    }
    return true;
};
exports.leaveRoom = leaveRoom;
// 更新房间状态
const updateRoomStatus = async (roomId, status) => {
    const result = await database_1.default.query('UPDATE game_rooms SET status = $1, updated_at = NOW() WHERE id = $2', [status, roomId]);
    return result.rowCount !== null && result.rowCount > 0;
};
exports.updateRoomStatus = updateRoomStatus;
//# sourceMappingURL=roomService.js.map