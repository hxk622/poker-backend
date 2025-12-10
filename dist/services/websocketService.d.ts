import { WebSocket } from 'ws';
import http from 'http';
import { WebSocketEvent } from '../types';
export interface WebSocketClient {
    id: string;
    userId: string;
    socket: WebSocket;
    roomId?: string;
    sessionId?: string;
}
export declare class WebSocketService {
    private wss;
    private clients;
    constructor(server: http.Server);
    private setupEventHandlers;
    private handleConnection;
    private handleMessage;
    private handleJoinRoom;
    private handleLeaveRoom;
    private handleGameAction;
    private handleChatMessage;
    private handleClose;
    private handleError;
    sendToClient(clientId: string, message: WebSocketEvent): void;
    broadcastToRoom(roomId: string, message: WebSocketEvent, excludeClientId?: string): void;
    broadcast(message: WebSocketEvent): void;
    getClientsInRoom(roomId: string): WebSocketClient[];
    getClientCount(): number;
    close(): void;
}
export default WebSocketService;
