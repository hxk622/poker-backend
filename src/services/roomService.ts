import { GameRoom, CreateRoomInput as GameCreateRoomInput } from '../types';
import { postgreSQLRoomDAO } from '../dao/impl/postgreSQLRoomDAO';
import loggerService from '../services/loggerService';

export interface CreateRoomInput {
  name: string;
  room_type: 'public' | 'private';
  small_blind: number;
  big_blind: number;
  max_players: number;
}

// 创建游戏房间
export const createRoom = async (userId: string, input: CreateRoomInput): Promise<GameRoom> => {
  const { 
    name, 
    room_type, 
    small_blind, 
    big_blind, 
    max_players 
  } = input;

  return await postgreSQLRoomDAO.createRoom(input, userId);
};

// 获取房间列表
export const getRoomList = async (status?: 'waiting' | 'playing' | 'finished'): Promise<GameRoom[]> => {
  try {
    if (status) {
      return await postgreSQLRoomDAO.getRoomsByStatus(status);
    }
    return await postgreSQLRoomDAO.getAll();
  } catch (error) {
    loggerService.error('获取房间列表失败:', error);
    throw new Error('获取房间列表失败');
  }
};

// 获取房间详情
export const getRoomById = async (roomId: string): Promise<GameRoom | null> => {
  try {
    const room = await postgreSQLRoomDAO.getById(roomId);
    return room;
  } catch (error) {
    loggerService.error('获取房间详情失败:', error);
    throw new Error('获取房间详情失败');
  }
};

// 加入房间
export const joinRoom = async (roomId: string, userId: string): Promise<boolean> => {
  try {
    const success = await postgreSQLRoomDAO.joinRoom(roomId, userId);
    return success;
  } catch (error) {
    loggerService.error('加入房间失败:', error);
    throw new Error('加入房间失败');
  }
};

// 离开房间
export const leaveRoom = async (roomId: string, userId: string): Promise<boolean> => {
  try {
    const success = await postgreSQLRoomDAO.leaveRoom(roomId, userId);
    return success;
  } catch (error) {
    loggerService.error('离开房间失败:', error);
    throw new Error('离开房间失败');
  }
};

// 更新房间状态
export const updateRoomStatus = async (roomId: string, status: 'waiting' | 'playing' | 'finished'): Promise<boolean> => {
  const result = await postgreSQLRoomDAO.updateStatus(roomId, status);
  return result !== null;
};
