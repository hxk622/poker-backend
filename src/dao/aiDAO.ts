import { AIAnalysis, AISuggestion, AITrainingData } from '../types';
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

export interface AITrainingDataDAO extends BaseDAO<AITrainingData, string> {
  // 获取用户的训练数据
  getByUser(userId: string, limit?: number): Promise<AITrainingData[]>;
  
  // 获取游戏会话的训练数据
  getBySession(sessionId: string): Promise<AITrainingData[]>;
  
  // 批量插入训练数据
  batchInsert(data: AITrainingData[]): Promise<string[]>;
  
  // 获取训练数据统计信息
  getTrainingStats(userId?: string): Promise<{
    total: number;
    byResult: Record<string, number>;
    byAction: Record<string, number>;
  }>;
}
