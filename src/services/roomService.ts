import pool from './database';
import { GameRoom, User } from '../types';

export interface CreateRoomInput {
  name: string;
  description?: string;
  max_players?: number;
  min_bet?: number;
  max_bet?: number;
  table_size?: number;
}

// 创建游戏房间
export const createRoom = async (userId: string, input: CreateRoomInput): Promise<GameRoom> => {
  const { 
    name, 
    description = '', 
    max_players = 9, 
    min_bet = 10, 
    max_bet = 1000, 
    table_size = 10000 
  } = input;

  const result = await pool.query(
    `INSERT INTO game_rooms (
      name, description, max_players, min_bet, max_bet, table_size, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, description, max_players, min_bet, max_bet, table_size, userId]
  );

  return result.rows[0];
};

// 获取房间列表
export const getRoomList = async (status?: string): Promise<GameRoom[]> => {
  let query = 'SELECT * FROM game_rooms';
  let params: any[] = [];

  if (status) {
    query += ' WHERE status = $1';
    params.push(status);
  }

  const result = await pool.query(query, params);
  return result.rows;
};

// 获取房间详情
export const getRoomById = async (roomId: string): Promise<GameRoom | null> => {
  const result = await pool.query('SELECT * FROM game_rooms WHERE id = $1', [roomId]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

// 加入房间
export const joinRoom = async (roomId: string, userId: string): Promise<boolean> => {
  // 检查房间是否存在
  const room = await getRoomById(roomId);
  if (!room) {
    throw new Error('房间不存在');
  }

  // 检查房间是否已满
  const playerCountResult = await pool.query(
    'SELECT COUNT(*) as count FROM room_players WHERE room_id = $1 AND status = $2',
    [roomId, 'active']
  );
  const currentPlayers = parseInt(playerCountResult.rows[0].count, 10);
  if (currentPlayers >= room.max_players) {
    throw new Error('房间已满');
  }

  // 检查玩家是否已在房间内
  const existingPlayerResult = await pool.query(
    'SELECT * FROM room_players WHERE room_id = $1 AND user_id = $2',
    [roomId, userId]
  );
  
  if (existingPlayerResult.rows.length > 0) {
    // 如果玩家已在房间内，更新状态为active
    await pool.query(
      'UPDATE room_players SET status = $1, updated_at = NOW() WHERE room_id = $2 AND user_id = $3',
      ['active', roomId, userId]
    );
  } else {
    // 将玩家加入房间
    await pool.query(
      'INSERT INTO room_players (room_id, user_id, status, joined_at) VALUES ($1, $2, $3, NOW())',
      [roomId, userId, 'active']
    );
  }

  // 更新房间当前玩家数量
  await pool.query(
    'UPDATE game_rooms SET current_players = current_players + 1 WHERE id = $1',
    [roomId]
  );

  return true;
};

// 离开房间
export const leaveRoom = async (roomId: string, userId: string): Promise<boolean> => {
  // 检查房间是否存在
  const room = await getRoomById(roomId);
  if (!room) {
    throw new Error('房间不存在');
  }

  // 检查玩家是否在房间内
  const existingPlayerResult = await pool.query(
    'SELECT * FROM room_players WHERE room_id = $1 AND user_id = $2 AND status = $3',
    [roomId, userId, 'active']
  );
  
  if (existingPlayerResult.rows.length === 0) {
    throw new Error('玩家不在该房间内');
  }

  // 更新玩家状态为离开
  await pool.query(
    'UPDATE room_players SET status = $1, updated_at = NOW() WHERE room_id = $2 AND user_id = $3',
    ['left', roomId, userId]
  );

  // 更新房间当前玩家数量
  await pool.query(
    'UPDATE game_rooms SET current_players = GREATEST(current_players - 1, 0) WHERE id = $1',
    [roomId]
  );

  // 检查房间是否为空，如果为空则更新房间状态为关闭
  const playerCountResult = await pool.query(
    'SELECT COUNT(*) as count FROM room_players WHERE room_id = $1 AND status = $2',
    [roomId, 'active']
  );
  const remainingPlayers = parseInt(playerCountResult.rows[0].count, 10);
  
  if (remainingPlayers === 0) {
    await updateRoomStatus(roomId, 'closed');
  }

  return true;
};

// 更新房间状态
export const updateRoomStatus = async (roomId: string, status: string): Promise<boolean> => {
  const result = await pool.query(
    'UPDATE game_rooms SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, roomId]
  );

  return result.rowCount !== null && result.rowCount > 0;
};
