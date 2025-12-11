import { GameRoom } from '../types';
import { postgreSQLRoomDAO } from '../dao/impl/postgreSQLRoomDAO';

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

  return await postgreSQLRoomDAO.create({ 
    name, 
    description, 
    max_players, 
    min_bet, 
    max_bet, 
    table_size, 
    created_by: userId 
  });
};

// 获取房间列表
export const getRoomList = async (status?: string): Promise<GameRoom[]> => {
  if (status) {
    return await postgreSQLRoomDAO.getRoomsByStatus(status);
  }
  return await postgreSQLRoomDAO.getAll();
};

// 获取房间详情
export const getRoomById = async (roomId: string): Promise<GameRoom | null> => {
  return await postgreSQLRoomDAO.getById(roomId);
};

// 加入房间
export const joinRoom = async (roomId: string, userId: string): Promise<boolean> => {
  return await postgreSQLRoomDAO.joinRoom(roomId, userId);
};

// 离开房间
export const leaveRoom = async (roomId: string, userId: string): Promise<boolean> => {
  return await postgreSQLRoomDAO.leaveRoom(roomId, userId);
};

// 更新房间状态
export const updateRoomStatus = async (roomId: string, status: string): Promise<boolean> => {
  const result = await postgreSQLRoomDAO.update(roomId, { status });
  return result !== null;
};
