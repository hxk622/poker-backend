import pool from '../../services/database';
import { AIAnalysis, AISuggestion, AITrainingData } from '../../types';
import { AIAnalysisDAO, AISuggestionDAO, AITrainingDataDAO } from '../aiDAO';
import { RedisCache } from '../../services/redisCache';

export class PostgreSQLAIAnalysisDAO implements AIAnalysisDAO {
  private static readonly TABLE_NAME = 'ai_analyses';
  private static readonly CACHE_KEY_PREFIX = 'ai_analysis:';

  async create(entity: Omit<AIAnalysis, 'id' | 'created_at' | 'updated_at'>): Promise<AIAnalysis> {
    const result = await pool.query(
      `INSERT INTO ${PostgreSQLAIAnalysisDAO.TABLE_NAME} (session_id, user_id, hand_strength, pot_odds, recommended_action, confidence)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [entity.session_id, entity.user_id, entity.hand_strength, entity.pot_odds, entity.recommended_action, entity.confidence]
    );

    const analysis = result.rows[0];
    // 缓存AI分析记录
    await RedisCache.set(`${PostgreSQLAIAnalysisDAO.CACHE_KEY_PREFIX}${analysis.id}`, analysis, 3600);
    // 清除会话分析列表缓存
    await RedisCache.delete(`ai_analyses:session:${entity.session_id}`);
    await RedisCache.delete(`ai_analyses:user:${entity.user_id}`);
    // 设置最新分析缓存
    await RedisCache.set(`ai_analyses:session:${entity.session_id}:latest`, analysis, 3600);
    return analysis;
  }

  async getById(id: string): Promise<AIAnalysis | null> {
    // 先从缓存获取
    const cachedAnalysis = await RedisCache.get<AIAnalysis>(`${PostgreSQLAIAnalysisDAO.CACHE_KEY_PREFIX}${id}`);
    if (cachedAnalysis) {
      return cachedAnalysis;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAIAnalysisDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const analysis = result.rows[0];
    // 缓存AI分析记录
    await RedisCache.set(`${PostgreSQLAIAnalysisDAO.CACHE_KEY_PREFIX}${analysis.id}`, analysis, 3600);
    return analysis;
  }

  async update(id: string, entity: Partial<AIAnalysis>): Promise<AIAnalysis | null> {
    // 构建更新语句
    const updateFields = Object.entries(entity)
      .map(([key, value], index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [...Object.values(entity), id];

    const result = await pool.query(
      `UPDATE ${PostgreSQLAIAnalysisDAO.TABLE_NAME} SET ${updateFields}
       WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const analysis = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLAIAnalysisDAO.CACHE_KEY_PREFIX}${analysis.id}`, analysis, 3600);
    // 清除相关列表缓存
    await RedisCache.delete(`ai_analyses:session:${analysis.session_id}`);
    await RedisCache.delete(`ai_analyses:user:${analysis.user_id}`);
    // 检查是否需要更新最新分析缓存
    const latestAnalysis = await this.getLatestBySession(analysis.session_id);
    if (latestAnalysis && latestAnalysis.id === analysis.id) {
      await RedisCache.set(`ai_analyses:session:${analysis.session_id}:latest`, analysis, 3600);
    }
    return analysis;
  }

  async delete(id: string): Promise<boolean> {
    const analysis = await this.getById(id);
    if (!analysis) {
      return false;
    }

    const result = await pool.query(
      `DELETE FROM ${PostgreSQLAIAnalysisDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return false;
    }

    // 删除缓存
    await RedisCache.delete(`${PostgreSQLAIAnalysisDAO.CACHE_KEY_PREFIX}${id}`);
    // 清除相关列表缓存
    await RedisCache.delete(`ai_analyses:session:${analysis.session_id}`);
    await RedisCache.delete(`ai_analyses:user:${analysis.user_id}`);
    // 检查是否需要更新最新分析缓存
    const latestAnalysis = await this.getLatestBySession(analysis.session_id);
    if (latestAnalysis) {
      await RedisCache.set(`ai_analyses:session:${analysis.session_id}:latest`, latestAnalysis, 3600);
    } else {
      await RedisCache.delete(`ai_analyses:session:${analysis.session_id}:latest`);
    }
    return true;
  }

  async getAll(): Promise<AIAnalysis[]> {
    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAIAnalysisDAO.TABLE_NAME}`
    );

    return result.rows;
  }

  async getByUser(userId: string): Promise<AIAnalysis[]> {
    // 先从缓存获取
    const cachedAnalyses = await RedisCache.get<AIAnalysis[]>(`ai_analyses:user:${userId}`);
    if (cachedAnalyses) {
      return cachedAnalyses;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAIAnalysisDAO.TABLE_NAME} WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    // 缓存用户分析列表
    await RedisCache.set(`ai_analyses:user:${userId}`, result.rows, 3600);
    return result.rows;
  }

  async getBySession(sessionId: string): Promise<AIAnalysis[]> {
    // 先从缓存获取
    const cachedAnalyses = await RedisCache.get<AIAnalysis[]>(`ai_analyses:session:${sessionId}`);
    if (cachedAnalyses) {
      return cachedAnalyses;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAIAnalysisDAO.TABLE_NAME} WHERE session_id = $1 ORDER BY created_at DESC`,
      [sessionId]
    );

    // 缓存会话分析列表
    await RedisCache.set(`ai_analyses:session:${sessionId}`, result.rows, 3600);
    return result.rows;
  }

  async getLatestBySession(sessionId: string): Promise<AIAnalysis | null> {
    // 先从缓存获取
    const cachedAnalysis = await RedisCache.get<AIAnalysis>(`ai_analyses:session:${sessionId}:latest`);
    if (cachedAnalysis) {
      return cachedAnalysis;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAIAnalysisDAO.TABLE_NAME} WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const analysis = result.rows[0];
    // 缓存最新分析记录
    await RedisCache.set(`ai_analyses:session:${sessionId}:latest`, analysis, 3600);
    return analysis;
  }
}

export class PostgreSQLAISuggestionDAO implements AISuggestionDAO {
  private static readonly TABLE_NAME = 'ai_suggestions';
  private static readonly CACHE_KEY_PREFIX = 'ai_suggestion:';

  async create(entity: Omit<AISuggestion, 'id' | 'created_at' | 'updated_at'>): Promise<AISuggestion> {
    const result = await pool.query(
      `INSERT INTO ${PostgreSQLAISuggestionDAO.TABLE_NAME} (session_id, user_id, style, recommended_action, recommended_amount, confidence, explanation)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [entity.session_id, entity.user_id, entity.style, entity.recommended_action, entity.recommended_amount, entity.confidence, entity.explanation]
    );

    const suggestion = result.rows[0];
    // 缓存AI建议记录
    await RedisCache.set(`${PostgreSQLAISuggestionDAO.CACHE_KEY_PREFIX}${suggestion.id}`, suggestion, 3600);
    // 清除会话建议列表缓存
    await RedisCache.delete(`ai_suggestions:session:${entity.session_id}`);
    await RedisCache.delete(`ai_suggestions:user:${entity.user_id}`);
    // 设置最新建议缓存
    await RedisCache.set(`ai_suggestions:session:${entity.session_id}:latest`, suggestion, 3600);
    return suggestion;
  }

  async getById(id: string): Promise<AISuggestion | null> {
    // 先从缓存获取
    const cachedSuggestion = await RedisCache.get<AISuggestion>(`${PostgreSQLAISuggestionDAO.CACHE_KEY_PREFIX}${id}`);
    if (cachedSuggestion) {
      return cachedSuggestion;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAISuggestionDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const suggestion = result.rows[0];
    // 缓存AI建议记录
    await RedisCache.set(`${PostgreSQLAISuggestionDAO.CACHE_KEY_PREFIX}${suggestion.id}`, suggestion, 3600);
    return suggestion;
  }

  async update(id: string, entity: Partial<AISuggestion>): Promise<AISuggestion | null> {
    // 构建更新语句
    const updateFields = Object.entries(entity)
      .map(([key, value], index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [...Object.values(entity), id];

    const result = await pool.query(
      `UPDATE ${PostgreSQLAISuggestionDAO.TABLE_NAME} SET ${updateFields}
       WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const suggestion = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLAISuggestionDAO.CACHE_KEY_PREFIX}${suggestion.id}`, suggestion, 3600);
    // 清除相关列表缓存
    await RedisCache.delete(`ai_suggestions:session:${suggestion.session_id}`);
    await RedisCache.delete(`ai_suggestions:user:${suggestion.user_id}`);
    // 检查是否需要更新最新建议缓存
    const latestSuggestion = await this.getLatestBySession(suggestion.session_id);
    if (latestSuggestion && latestSuggestion.id === suggestion.id) {
      await RedisCache.set(`ai_suggestions:session:${suggestion.session_id}:latest`, suggestion, 3600);
    }
    return suggestion;
  }

  async delete(id: string): Promise<boolean> {
    const suggestion = await this.getById(id);
    if (!suggestion) {
      return false;
    }

    const result = await pool.query(
      `DELETE FROM ${PostgreSQLAISuggestionDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return false;
    }

    // 删除缓存
    await RedisCache.delete(`${PostgreSQLAISuggestionDAO.CACHE_KEY_PREFIX}${id}`);
    // 清除相关列表缓存
    await RedisCache.delete(`ai_suggestions:session:${suggestion.session_id}`);
    await RedisCache.delete(`ai_suggestions:user:${suggestion.user_id}`);
    // 检查是否需要更新最新建议缓存
    const latestSuggestion = await this.getLatestBySession(suggestion.session_id);
    if (latestSuggestion) {
      await RedisCache.set(`ai_suggestions:session:${suggestion.session_id}:latest`, latestSuggestion, 3600);
    } else {
      await RedisCache.delete(`ai_suggestions:session:${suggestion.session_id}:latest`);
    }
    return true;
  }

  async getAll(): Promise<AISuggestion[]> {
    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAISuggestionDAO.TABLE_NAME}`
    );

    return result.rows;
  }

  async getByUser(userId: string): Promise<AISuggestion[]> {
    // 先从缓存获取
    const cachedSuggestions = await RedisCache.get<AISuggestion[]>(`ai_suggestions:user:${userId}`);
    if (cachedSuggestions) {
      return cachedSuggestions;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAISuggestionDAO.TABLE_NAME} WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    // 缓存用户建议列表
    await RedisCache.set(`ai_suggestions:user:${userId}`, result.rows, 3600);
    return result.rows;
  }

  async getBySession(sessionId: string): Promise<AISuggestion[]> {
    // 先从缓存获取
    const cachedSuggestions = await RedisCache.get<AISuggestion[]>(`ai_suggestions:session:${sessionId}`);
    if (cachedSuggestions) {
      return cachedSuggestions;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAISuggestionDAO.TABLE_NAME} WHERE session_id = $1 ORDER BY created_at DESC`,
      [sessionId]
    );

    // 缓存会话建议列表
    await RedisCache.set(`ai_suggestions:session:${sessionId}`, result.rows, 3600);
    return result.rows;
  }

  async getLatestBySession(sessionId: string): Promise<AISuggestion | null> {
    // 先从缓存获取
    const cachedSuggestion = await RedisCache.get<AISuggestion>(`ai_suggestions:session:${sessionId}:latest`);
    if (cachedSuggestion) {
      return cachedSuggestion;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAISuggestionDAO.TABLE_NAME} WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const suggestion = result.rows[0];
    // 缓存最新建议记录
    await RedisCache.set(`ai_suggestions:session:${sessionId}:latest`, suggestion, 3600);
    return suggestion;
  }
}

// 实现AITrainingDataDAO接口
export class PostgreSQLAITrainingDataDAO implements AITrainingDataDAO {
  private static readonly TABLE_NAME = 'ai_training_data';
  private static readonly CACHE_KEY_PREFIX = 'ai_training_data:';

  async create(entity: Omit<AITrainingData, 'id' | 'created_at' | 'updated_at'>): Promise<AITrainingData> {
    const result = await pool.query(
      `INSERT INTO ${PostgreSQLAITrainingDataDAO.TABLE_NAME} (user_id, session_id, hole_cards, community_cards, hand_strength, recommended_action, actual_action, action_result, context_data) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        entity.user_id,
        entity.session_id,
        JSON.stringify(entity.hole_cards),
        JSON.stringify(entity.community_cards),
        entity.hand_strength,
        entity.recommended_action,
        entity.actual_action,
        entity.action_result,
        JSON.stringify(entity.context_data || {})
      ]
    );

    const trainingData = result.rows[0];
    // 缓存训练数据
    await RedisCache.set(`${PostgreSQLAITrainingDataDAO.CACHE_KEY_PREFIX}${trainingData.id}`, trainingData, 3600);
    // 清除相关列表缓存
    await RedisCache.delete(`ai_training_data:user:${trainingData.user_id}`);
    await RedisCache.delete(`ai_training_data:session:${trainingData.session_id}`);
    return trainingData;
  }

  async getById(id: string): Promise<AITrainingData | null> {
    // 先从缓存获取
    const cachedData = await RedisCache.get<AITrainingData>(`${PostgreSQLAITrainingDataDAO.CACHE_KEY_PREFIX}${id}`);
    if (cachedData) {
      return cachedData;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAITrainingDataDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const trainingData = result.rows[0];
    // 缓存训练数据
    await RedisCache.set(`${PostgreSQLAITrainingDataDAO.CACHE_KEY_PREFIX}${trainingData.id}`, trainingData, 3600);
    return trainingData;
  }

  async update(id: string, entity: Partial<AITrainingData>): Promise<AITrainingData | null> {
    // 处理JSON字段
    const processedEntity = { ...entity };
    if (processedEntity.hole_cards) {
      (processedEntity as any).hole_cards = JSON.stringify(processedEntity.hole_cards);
    }
    if (processedEntity.community_cards) {
      (processedEntity as any).community_cards = JSON.stringify(processedEntity.community_cards);
    }
    if (processedEntity.context_data) {
      (processedEntity as any).context_data = JSON.stringify(processedEntity.context_data);
    }

    // 构建更新语句
    const updateFields = Object.entries(processedEntity)
      .map(([key, value], index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [...Object.values(processedEntity), id];

    const result = await pool.query(
      `UPDATE ${PostgreSQLAITrainingDataDAO.TABLE_NAME} SET ${updateFields}, updated_at = NOW() 
       WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const trainingData = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLAITrainingDataDAO.CACHE_KEY_PREFIX}${trainingData.id}`, trainingData, 3600);
    // 清除相关列表缓存
    await RedisCache.delete(`ai_training_data:user:${trainingData.user_id}`);
    await RedisCache.delete(`ai_training_data:session:${trainingData.session_id}`);
    return trainingData;
  }

  async delete(id: string): Promise<boolean> {
    const trainingData = await this.getById(id);
    if (!trainingData) {
      return false;
    }

    const result = await pool.query(
      `DELETE FROM ${PostgreSQLAITrainingDataDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return false;
    }

    // 删除缓存
    await RedisCache.delete(`${PostgreSQLAITrainingDataDAO.CACHE_KEY_PREFIX}${id}`);
    // 清除相关列表缓存
    await RedisCache.delete(`ai_training_data:user:${trainingData.user_id}`);
    await RedisCache.delete(`ai_training_data:session:${trainingData.session_id}`);
    return true;
  }

  async getAll(): Promise<AITrainingData[]> {
    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAITrainingDataDAO.TABLE_NAME} ORDER BY created_at DESC`
    );
    return result.rows;
  }

  async getByUser(userId: string, limit?: number): Promise<AITrainingData[]> {
    // 先从缓存获取
    const cacheKey = `ai_training_data:user:${userId}${limit ? `:${limit}` : ''}`;
    const cachedData = await RedisCache.get<AITrainingData[]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const query = limit 
      ? `SELECT * FROM ${PostgreSQLAITrainingDataDAO.TABLE_NAME} WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`
      : `SELECT * FROM ${PostgreSQLAITrainingDataDAO.TABLE_NAME} WHERE user_id = $1 ORDER BY created_at DESC`;
    
    const values = limit ? [userId, limit] : [userId];
    
    const result = await pool.query(query, values);

    // 缓存用户训练数据
    await RedisCache.set(cacheKey, result.rows, 3600);
    return result.rows;
  }

  async getBySession(sessionId: string): Promise<AITrainingData[]> {
    // 先从缓存获取
    const cachedData = await RedisCache.get<AITrainingData[]>(`ai_training_data:session:${sessionId}`);
    if (cachedData) {
      return cachedData;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLAITrainingDataDAO.TABLE_NAME} WHERE session_id = $1 ORDER BY created_at DESC`,
      [sessionId]
    );

    // 缓存会话训练数据
    await RedisCache.set(`ai_training_data:session:${sessionId}`, result.rows, 3600);
    return result.rows;
  }

  async batchInsert(data: AITrainingData[]): Promise<string[]> {
    if (data.length === 0) {
      return [];
    }

    // 构建批量插入SQL
    const placeholders = data.map((_, i) => 
      `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9})`
    ).join(', ');

    const values = data.flatMap(item => [
      item.user_id,
      item.session_id,
      JSON.stringify(item.hole_cards),
      JSON.stringify(item.community_cards),
      item.hand_strength,
      item.recommended_action,
      item.actual_action,
      item.action_result,
      JSON.stringify(item.context_data || {})
    ]);

    const result = await pool.query(
      `INSERT INTO ${PostgreSQLAITrainingDataDAO.TABLE_NAME} (user_id, session_id, hole_cards, community_cards, hand_strength, recommended_action, actual_action, action_result, context_data) 
       VALUES ${placeholders} RETURNING id`,
      values
    );

    // 清除相关缓存
    const userIds = new Set(data.map(item => item.user_id));
    const sessionIds = new Set(data.map(item => item.session_id));
    
    for (const userId of userIds) {
      await RedisCache.delete(`ai_training_data:user:${userId}`);
      // 清除带limit的缓存
      await RedisCache.deletePattern(`ai_training_data:user:${userId}:*`);
    }
    
    for (const sessionId of sessionIds) {
      await RedisCache.delete(`ai_training_data:session:${sessionId}`);
    }

    return result.rows.map(row => row.id);
  }

  async getTrainingStats(userId?: string): Promise<{
    total: number;
    byResult: Record<string, number>;
    byAction: Record<string, number>;
  }> {
    // 先从缓存获取
    const cacheKey = `ai_training_stats${userId ? `:${userId}` : ''}`;
    const cachedStats = await RedisCache.get<{ total: number; byResult: Record<string, number>; byAction: Record<string, number> }>(cacheKey);
    if (cachedStats) {
      return cachedStats;
    }

    const whereClause = userId ? 'WHERE user_id = $1' : '';
    const values = userId ? [userId] : [];

    // 获取总数
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total FROM ${PostgreSQLAITrainingDataDAO.TABLE_NAME} ${whereClause}`,
      values
    );
    const total = parseInt(totalResult.rows[0].total, 10);

    // 按结果统计
    const resultResult = await pool.query(
      `SELECT action_result, COUNT(*) as count FROM ${PostgreSQLAITrainingDataDAO.TABLE_NAME} ${whereClause} GROUP BY action_result`,
      values
    );
    const byResult: Record<string, number> = {};
    resultResult.rows.forEach(row => {
      byResult[row.action_result] = parseInt(row.count, 10);
    });

    // 按行动统计
    const actionResult = await pool.query(
      `SELECT actual_action, COUNT(*) as count FROM ${PostgreSQLAITrainingDataDAO.TABLE_NAME} ${whereClause} GROUP BY actual_action`,
      values
    );
    const byAction: Record<string, number> = {};
    actionResult.rows.forEach(row => {
      byAction[row.actual_action] = parseInt(row.count, 10);
    });

    const stats = { total, byResult, byAction };
    // 缓存统计信息
    await RedisCache.set(cacheKey, stats, 3600);
    return stats;
  }
}

// 创建单例实例
export const postgreSQLAIAnalysisDAO = new PostgreSQLAIAnalysisDAO();
export const postgreSQLAISuggestionDAO = new PostgreSQLAISuggestionDAO();
export const postgreSQLAITrainingDataDAO = new PostgreSQLAITrainingDataDAO();
