import { GameRoom } from '../types';
export interface CreateRoomInput {
    name: string;
    description?: string;
    max_players?: number;
    min_bet?: number;
    max_bet?: number;
    table_size?: number;
}
export declare const createRoom: (userId: string, input: CreateRoomInput) => Promise<GameRoom>;
export declare const getRoomList: (status?: string) => Promise<GameRoom[]>;
export declare const getRoomById: (roomId: string) => Promise<GameRoom | null>;
export declare const joinRoom: (roomId: string, userId: string) => Promise<boolean>;
export declare const leaveRoom: (roomId: string, userId: string) => Promise<boolean>;
export declare const updateRoomStatus: (roomId: string, status: string) => Promise<boolean>;
