import pool from '../../services/database';
import { AIAnalysis, AISuggestion } from '../../types';
import { AIAnalysisDAO, AISuggestionDAO } from '../aiDAO';
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

// 创建单例实例
export const postgreSQLAIAnalysisDAO = new PostgreSQLAIAnalysisDAO();
export const postgreSQLAISuggestionDAO = new PostgreSQLAISuggestionDAO();
