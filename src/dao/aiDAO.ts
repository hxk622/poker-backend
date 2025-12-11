import { AIAnalysis, AISuggestion } from '../types';
import { BaseDAO } from './baseDAO';

export interface AIAnalysisDAO extends BaseDAO<AIAnalysis, string> {
  // 获取用户的分析记录
  getByUser(userId: string): Promise<AIAnalysis[]>;
  
  // 获取游戏会话的分析记录
  getBySession(sessionId: string): Promise<AIAnalysis[]>;
  
  // 获取最新的分析记录
  getLatestBySession(sessionId: string): Promise<AIAnalysis | null>;
}

export interface AISuggestionDAO extends BaseDAO<AISuggestion, string> {
  // 获取用户的建议记录
  getByUser(userId: string): Promise<AISuggestion[]>;
  
  // 获取游戏会话的建议记录
  getBySession(sessionId: string): Promise<AISuggestion[]>;
  
  // 获取最新的建议记录
  getLatestBySession(sessionId: string): Promise<AISuggestion | null>;
}
