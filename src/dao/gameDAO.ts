import { GameSession, PlayerSession, Action, CommunityCards } from '../types';
import { BaseDAO } from './baseDAO';

export interface GameSessionDAO extends BaseDAO<GameSession, string> {
  // 获取房间内的所有游戏会话
  getSessionsByRoom(roomId: string): Promise<GameSession[]>;
  
  // 获取活跃的游戏会话
  getActiveSessions(): Promise<GameSession[]>;
  
  // 更新游戏回合
  updateRound(sessionId: string, round: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'): Promise<GameSession | null>;
  
  // 更新游戏状态
  updateStatus(sessionId: string, status: 'in_progress' | 'finished'): Promise<GameSession | null>;
  
  // 更新底池金额
  updatePot(sessionId: string, pot: number): Promise<GameSession | null>;
}

export interface PlayerSessionDAO extends BaseDAO<PlayerSession, string> {
  // 获取游戏会话中的所有玩家
  getPlayersBySession(sessionId: string): Promise<PlayerSession[]>;
  
  // 获取特定玩家在房间内的活跃会话
  getActiveSessionByPlayer(roomId: string, playerId: string): Promise<PlayerSession | null>;
  
  // 更新玩家状态
  updateStatus(sessionId: string, playerId: string, status: 'active' | 'folded' | 'all_in' | 'out'): Promise<PlayerSession | null>;
  
  // 更新玩家筹码
  updateChips(sessionId: string, playerId: string, chipsInPot: number, chipsRemaining: number): Promise<PlayerSession | null>;
}

export interface ActionDAO extends BaseDAO<Action, string> {
  // 获取游戏会话中的所有动作
  getActionsBySession(sessionId: string): Promise<Action[]>;
  
  // 获取游戏会话特定回合的动作
  getActionsByRound(sessionId: string, round: 'preflop' | 'flop' | 'turn' | 'river'): Promise<Action[]>;
}

export interface CommunityCardsDAO extends BaseDAO<CommunityCards, string> {
  // 根据游戏会话获取公共牌
  getBySession(sessionId: string): Promise<CommunityCards | null>;
  
  // 更新翻牌
  updateFlop(sessionId: string, flop: any[]): Promise<CommunityCards | null>;
  
  // 更新转牌
  updateTurn(sessionId: string, turn: any): Promise<CommunityCards | null>;
  
  // 更新河牌
  updateRiver(sessionId: string, river: any): Promise<CommunityCards | null>;
}
