import { GameRoom, CreateRoomInput } from '../types';
import { BaseDAO } from './baseDAO';

export interface RoomDAO extends BaseDAO<GameRoom, string> {
  // 获取公共房间列表
  getPublicRooms(): Promise<GameRoom[]>;
  
  // 获取用户创建的房间
  getRoomsByOwner(ownerId: string): Promise<GameRoom[]>;
  
  // 根据房间状态获取房间
  getRoomsByStatus(status: 'waiting' | 'playing' | 'finished'): Promise<GameRoom[]>;
  
  // 创建房间
  createRoom(input: CreateRoomInput, ownerId: string): Promise<GameRoom>;
  
  // 更新房间玩家数量
  updatePlayerCount(roomId: string, delta: number): Promise<GameRoom | null>;
  
  // 更新房间状态
  updateStatus(roomId: string, status: 'waiting' | 'playing' | 'finished'): Promise<GameRoom | null>;
}
