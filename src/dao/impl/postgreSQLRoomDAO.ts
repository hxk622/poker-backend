import pool from '../../services/database';
import { GameRoom, CreateRoomInput } from '../../types';
import { RoomDAO } from '../roomDAO';
import { RedisCache } from '../../services/redisCache';

export class PostgreSQLRoomDAO implements RoomDAO {
  private static readonly TABLE_NAME = 'game_rooms';
  private static readonly CACHE_KEY_PREFIX = 'room:';

  // 这个方法与接口定义不匹配，应该由createRoom方法代替
  async create(entity: Omit<GameRoom, 'id' | 'created_at' | 'updated_at'>): Promise<GameRoom> {
    const result = await pool.query(
      `INSERT INTO ${PostgreSQLRoomDAO.TABLE_NAME} (name, room_type, small_blind, big_blind, max_players, current_players, game_status, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [entity.name, entity.room_type, entity.small_blind, entity.big_blind, entity.max_players, entity.current_players || 0, entity.game_status || 'waiting', entity.owner_id]
    );

    const room = result.rows[0];
    // 缓存房间详情
    await RedisCache.set(`${PostgreSQLRoomDAO.CACHE_KEY_PREFIX}${room.id}`, room, 3600);
    // 更新房间列表缓存
    await this.invalidateRoomListCache();
    return room;
  }

  async getById(id: string): Promise<GameRoom | null> {
    // 先从缓存获取
    const cachedRoom = await RedisCache.get<GameRoom>(`${PostgreSQLRoomDAO.CACHE_KEY_PREFIX}${id}`);
    if (cachedRoom) {
      return cachedRoom;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLRoomDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const room = result.rows[0];
    // 缓存房间详情
    await RedisCache.set(`${PostgreSQLRoomDAO.CACHE_KEY_PREFIX}${room.id}`, room, 3600);
    return room;
  }

  async update(id: string, entity: Partial<GameRoom>): Promise<GameRoom | null> {
    // 构建更新语句
    const updateFields = Object.entries(entity)
      .map(([key, value], index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [...Object.values(entity), id];

    const result = await pool.query(
      `UPDATE ${PostgreSQLRoomDAO.TABLE_NAME} SET ${updateFields}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const room = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLRoomDAO.CACHE_KEY_PREFIX}${room.id}`, room, 3600);
    // 更新房间列表缓存
    await this.invalidateRoomListCache();
    return room;
  }

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM ${PostgreSQLRoomDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return false;
    }

    // 删除缓存
    await RedisCache.delete(`${PostgreSQLRoomDAO.CACHE_KEY_PREFIX}${id}`);
    // 更新房间列表缓存
    await this.invalidateRoomListCache();
    return true;
  }

  async getAll(): Promise<GameRoom[]> {
    // 先从缓存获取
    const cachedRooms = await RedisCache.get<GameRoom[]>('rooms:all');
    if (cachedRooms) {
      return cachedRooms;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLRoomDAO.TABLE_NAME}`
    );

    // 缓存房间列表
    await RedisCache.set('rooms:all', result.rows, 300);
    return result.rows;
  }

  async getPublicRooms(): Promise<GameRoom[]> {
    // 先从缓存获取
    const cachedRooms = await RedisCache.get<GameRoom[]>('rooms:public');
    if (cachedRooms) {
      return cachedRooms;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLRoomDAO.TABLE_NAME} WHERE room_type = $1`,
      ['public']
    );

    // 缓存公共房间列表
    await RedisCache.set('rooms:public', result.rows, 300);
    return result.rows;
  }

  async getRoomsByOwner(ownerId: string): Promise<GameRoom[]> {
    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLRoomDAO.TABLE_NAME} WHERE created_by = $1`,
      [ownerId]
    );

    return result.rows;
  }

  async getRoomsByStatus(status: 'waiting' | 'playing' | 'finished'): Promise<GameRoom[]> {
    // 先从缓存获取
    const cachedRooms = await RedisCache.get<GameRoom[]>(`rooms:status:${status}`);
    if (cachedRooms) {
      return cachedRooms;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLRoomDAO.TABLE_NAME} WHERE status = $1`,
      [status]
    );

    // 缓存指定状态的房间列表
    await RedisCache.set(`rooms:status:${status}`, result.rows, 300);
    return result.rows;
  }

  async createRoom(input: CreateRoomInput, ownerId: string): Promise<GameRoom> {
    const { name, room_type, small_blind, big_blind, max_players } = input;
    
    const result = await pool.query(
      `INSERT INTO ${PostgreSQLRoomDAO.TABLE_NAME} (name, room_type, small_blind, big_blind, max_players, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, room_type, small_blind, big_blind, max_players, ownerId]
    );

    const room = result.rows[0];
    // 缓存房间详情
    await RedisCache.set(`${PostgreSQLRoomDAO.CACHE_KEY_PREFIX}${room.id}`, room, 3600);
    // 更新房间列表缓存
    await this.invalidateRoomListCache();
    return room;
  }

  async updatePlayerCount(roomId: string, delta: number): Promise<GameRoom | null> {
    const result = await pool.query(
      `UPDATE ${PostgreSQLRoomDAO.TABLE_NAME} SET current_players = GREATEST(current_players + $1, 0), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [delta, roomId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const room = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLRoomDAO.CACHE_KEY_PREFIX}${room.id}`, room, 3600);
    // 更新房间列表缓存
    await this.invalidateRoomListCache();
    return room;
  }

  async updateStatus(roomId: string, status: 'waiting' | 'playing' | 'finished'): Promise<GameRoom | null> {
    return this.update(roomId, { game_status: status });
  }

  // 加入房间
  async joinRoom(roomId: string, userId: string): Promise<boolean> {
    try {
      // 检查房间是否存在且未满
      const room = await this.getById(roomId);
      if (!room) {
        return false;
      }

      if (room.current_players >= room.max_players) {
        return false;
      }

      // 检查用户是否已经在房间中
      const playerResult = await pool.query(
        `SELECT * FROM session_players WHERE room_id = $1 AND user_id = $2`,
        [roomId, userId]
      );

      if (playerResult.rows.length > 0) {
        return false;
      }

      // 将用户加入房间 - 使用默认筹码量10000
      await pool.query(
        `INSERT INTO session_players (room_id, user_id, chips, status)
         VALUES ($1, $2, $3, $4)`,
        [roomId, userId, 10000, 'active']
      );

      // 更新房间当前玩家数量
      await this.updatePlayerCount(roomId, 1);
      return true;
    } catch (error) {
      console.error('加入房间失败:', error);
      return false;
    }
  }

  // 离开房间
  async leaveRoom(roomId: string, userId: string): Promise<boolean> {
    try {
      // 检查用户是否在房间中
      const playerResult = await pool.query(
        `SELECT * FROM session_players WHERE room_id = $1 AND user_id = $2`,
        [roomId, userId]
      );

      if (playerResult.rows.length === 0) {
        return false;
      }

      // 移除用户
      await pool.query(
        `DELETE FROM session_players WHERE room_id = $1 AND user_id = $2`,
        [roomId, userId]
      );

      // 更新房间当前玩家数量
      await this.updatePlayerCount(roomId, -1);
      return true;
    } catch (error) {
      console.error('离开房间失败:', error);
      return false;
    }
  }

  // 清除房间列表相关缓存
  private async invalidateRoomListCache(): Promise<void> {
    await RedisCache.deleteBatch(['rooms:all', 'rooms:public', 'rooms:status:waiting', 'rooms:status:playing', 'rooms:status:finished']);
  }
}

// 创建单例实例
export const postgreSQLRoomDAO = new PostgreSQLRoomDAO();
