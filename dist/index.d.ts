import http from 'http';
import './services/database';
import './services/redis';
declare const app: import("express-serve-static-core").Express;
declare const server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
import WebSocketService from './services/websocketService';
declare const websocketService: WebSocketService;
export { app, server, websocketService };
