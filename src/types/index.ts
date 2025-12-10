// 用户信息
export interface User {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  avatar?: string;
  chips: number;
  created_at: Date;
  updated_at: Date;
}

// 用户注册输入
export interface RegisterUserInput {
  username: string;
  password: string;
  email?: string;
  phone?: string;
}

// 用户登录输入
export interface LoginUserInput {
  email?: string;
  phone?: string;
  password: string;
}

export interface LoginUserInput {
  email?: string;
  phone?: string;
  password: string;
}

// 游戏房间相关类型
export interface GameRoom {
  id: string;
  name: string;
  owner_id: string;
  room_type: 'public' | 'private';
  small_blind: number;
  big_blind: number;
  max_players: number;
  current_players: number;
  game_status: 'waiting' | 'playing' | 'finished';
  created_at: Date;
}

export interface CreateRoomInput {
  name: string;
  room_type: 'public' | 'private';
  small_blind: number;
  big_blind: number;
  max_players: number;
}

// 牌局相关类型
export interface GameSession {
  id: string;
  room_id: string;
  dealer_id: string;
  pot: number;
  current_round: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  status: 'in_progress' | 'finished';
  created_at: Date;
  finished_at?: Date;
}

// 玩家牌局相关类型
export interface PlayerSession {
  id: string;
  session_id: string;
  player_id: string;
  hole_cards: Card[];
  chips_in_pot: number;
  chips_remaining: number;
  status: 'active' | 'folded' | 'all_in' | 'out';
  position: 'sb' | 'bb' | 'utg' | 'mp' | 'co' | 'btn';
}

// 动作记录相关类型
export interface Action {
  id: string;
  session_id: string;
  player_id: string;
  action_type: 'fold' | 'check' | 'call' | 'raise' | 'all_in';
  amount: number;
  round: 'preflop' | 'flop' | 'turn' | 'river';
  created_at: Date;
}

export interface GameAction {
  action_type: 'fold' | 'check' | 'call' | 'raise' | 'all_in';
  amount?: number;
}

// 卡牌相关类型
export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
}

// 社区牌相关类型
export interface CommunityCards {
  id: string;
  session_id: string;
  flop: Card[];
  turn?: Card;
  river?: Card;
}

// AI分析相关类型
export interface AIAnalysis {
  id: string;
  session_id: string;
  user_id: string;
  hand_strength: number;
  pot_odds: number;
  recommended_action: string;
  confidence: number;
  created_at: Date;
}

export interface AISuggestion {
  id: string;
  session_id: string;
  user_id: string;
  style: 'gto' | 'professional';
  recommended_action: string;
  recommended_amount?: number;
  confidence: number;
  explanation: string;
  created_at: Date;
}

export interface AIActionRecommendation {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all_in';
  amount?: number;
  reasoning: string;
  confidence: number;
}

// WebSocket事件相关类型
export interface WebSocketEvent {
  type: string;
  data: any;
}
