import pool from '../../services/database';
import { GameSession, PlayerSession, Action, CommunityCards } from '../../types';
import { GameSessionDAO, PlayerSessionDAO, ActionDAO, CommunityCardsDAO } from '../gameDAO';
import { RedisCache } from '../../services/redisCache';

export class PostgreSQLGameSessionDAO implements GameSessionDAO {
  private static readonly TABLE_NAME = 'game_sessions';
  private static readonly CACHE_KEY_PREFIX = 'game_session:';

  async create(entity: Omit<GameSession, 'id' | 'created_at' | 'updated_at'>): Promise<GameSession> {
    const result = await pool.query(
      `INSERT INTO ${PostgreSQLGameSessionDAO.TABLE_NAME} (room_id, dealer_id, pot, current_round, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [entity.room_id, entity.dealer_id, entity.pot, entity.current_round, entity.status]
    );

    const session = result.rows[0];
    // 缓存游戏会话
    await RedisCache.set(`${PostgreSQLGameSessionDAO.CACHE_KEY_PREFIX}${session.id}`, session, 3600);
    return session;
  }

  async getById(id: string): Promise<GameSession | null> {
    // 先从缓存获取
    const cachedSession = await RedisCache.get<GameSession>(`${PostgreSQLGameSessionDAO.CACHE_KEY_PREFIX}${id}`);
    if (cachedSession) {
      return cachedSession;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLGameSessionDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];
    // 缓存游戏会话
    await RedisCache.set(`${PostgreSQLGameSessionDAO.CACHE_KEY_PREFIX}${session.id}`, session, 3600);
    return session;
  }

  async update(id: string, entity: Partial<GameSession>): Promise<GameSession | null> {
    // 构建更新语句
    const updateFields = Object.entries(entity)
      .map(([key, value], index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [...Object.values(entity), id];

    const result = await pool.query(
      `UPDATE ${PostgreSQLGameSessionDAO.TABLE_NAME} SET ${updateFields}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLGameSessionDAO.CACHE_KEY_PREFIX}${session.id}`, session, 3600);
    return session;
  }

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM ${PostgreSQLGameSessionDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return false;
    }

    // 删除缓存
    await RedisCache.delete(`${PostgreSQLGameSessionDAO.CACHE_KEY_PREFIX}${id}`);
    return true;
  }

  async getAll(): Promise<GameSession[]> {
    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLGameSessionDAO.TABLE_NAME}`
    );

    return result.rows;
  }

  async getSessionsByRoom(roomId: string): Promise<GameSession[]> {
    // 先从缓存获取
    const cachedSessions = await RedisCache.get<GameSession[]>(`game_sessions:room:${roomId}`);
    if (cachedSessions) {
      return cachedSessions;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLGameSessionDAO.TABLE_NAME} WHERE room_id = $1`,
      [roomId]
    );

    // 缓存房间游戏会话列表
    await RedisCache.set(`game_sessions:room:${roomId}`, result.rows, 300);
    return result.rows;
  }

  async getActiveSessions(): Promise<GameSession[]> {
    // 先从缓存获取
    const cachedSessions = await RedisCache.get<GameSession[]>('game_sessions:active');
    if (cachedSessions) {
      return cachedSessions;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLGameSessionDAO.TABLE_NAME} WHERE status = $1`,
      ['in_progress']
    );

    // 缓存活跃游戏会话列表
    await RedisCache.set('game_sessions:active', result.rows, 60);
    return result.rows;
  }

  async updateRound(sessionId: string, round: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'): Promise<GameSession | null> {
    return this.update(sessionId, { current_round: round });
  }

  async updateStatus(sessionId: string, status: 'in_progress' | 'finished'): Promise<GameSession | null> {
    return this.update(sessionId, { status });
  }

  async updatePot(sessionId: string, pot: number): Promise<GameSession | null> {
    return this.update(sessionId, { pot });
  }
}

export class PostgreSQLPlayerSessionDAO implements PlayerSessionDAO {
  private static readonly TABLE_NAME = 'player_sessions';
  private static readonly CACHE_KEY_PREFIX = 'player_session:';

  async create(entity: Omit<PlayerSession, 'id' | 'created_at' | 'updated_at'>): Promise<PlayerSession> {
    const result = await pool.query(
      `INSERT INTO ${PostgreSQLPlayerSessionDAO.TABLE_NAME} (session_id, player_id, hole_cards, chips_in_pot, chips_remaining, status, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [entity.session_id, entity.player_id, JSON.stringify(entity.hole_cards), entity.chips_in_pot, entity.chips_remaining, entity.status, entity.position]
    );

    const playerSession = result.rows[0];
    // 缓存玩家会话
    await RedisCache.set(`${PostgreSQLPlayerSessionDAO.CACHE_KEY_PREFIX}${playerSession.id}`, playerSession, 3600);
    return playerSession;
  }

  async getById(id: string): Promise<PlayerSession | null> {
    // 先从缓存获取
    const cachedSession = await RedisCache.get<PlayerSession>(`${PostgreSQLPlayerSessionDAO.CACHE_KEY_PREFIX}${id}`);
    if (cachedSession) {
      return cachedSession;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLPlayerSessionDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const playerSession = result.rows[0];
    // 缓存玩家会话
    await RedisCache.set(`${PostgreSQLPlayerSessionDAO.CACHE_KEY_PREFIX}${playerSession.id}`, playerSession, 3600);
    return playerSession;
  }

  async update(id: string, entity: Partial<PlayerSession>): Promise<PlayerSession | null> {
    // 处理hole_cards的JSON序列化
    const processedEntity = { ...entity };
    if (processedEntity.hole_cards) {
      (processedEntity as any).hole_cards = JSON.stringify(processedEntity.hole_cards);
    }

    // 构建更新语句
    const updateFields = Object.entries(processedEntity)
      .map(([key, value], index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [...Object.values(processedEntity), id];

    const result = await pool.query(
      `UPDATE ${PostgreSQLPlayerSessionDAO.TABLE_NAME} SET ${updateFields}
       WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const playerSession = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLPlayerSessionDAO.CACHE_KEY_PREFIX}${playerSession.id}`, playerSession, 3600);
    return playerSession;
  }

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM ${PostgreSQLPlayerSessionDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return false;
    }

    // 删除缓存
    await RedisCache.delete(`${PostgreSQLPlayerSessionDAO.CACHE_KEY_PREFIX}${id}`);
    return true;
  }

  async getAll(): Promise<PlayerSession[]> {
    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLPlayerSessionDAO.TABLE_NAME}`
    );

    return result.rows;
  }

  async getPlayersBySession(sessionId: string): Promise<PlayerSession[]> {
    // 先从缓存获取
    const cachedPlayers = await RedisCache.get<PlayerSession[]>(`player_sessions:session:${sessionId}`);
    if (cachedPlayers) {
      return cachedPlayers;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLPlayerSessionDAO.TABLE_NAME} WHERE session_id = $1`,
      [sessionId]
    );

    // 缓存会话玩家列表
    await RedisCache.set(`player_sessions:session:${sessionId}`, result.rows, 300);
    return result.rows;
  }

  async getActiveSessionByPlayer(roomId: string, playerId: string): Promise<PlayerSession | null> {
    const result = await pool.query(
      `SELECT ps.* FROM ${PostgreSQLPlayerSessionDAO.TABLE_NAME} ps
       JOIN game_sessions gs ON ps.session_id = gs.id
       WHERE gs.room_id = $1 AND ps.player_id = $2 AND gs.status = $3`,
      [roomId, playerId, 'in_progress']
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async updateStatus(sessionId: string, playerId: string, status: 'active' | 'folded' | 'all_in' | 'out'): Promise<PlayerSession | null> {
    const result = await pool.query(
      `UPDATE ${PostgreSQLPlayerSessionDAO.TABLE_NAME} SET status = $1
       WHERE session_id = $2 AND player_id = $3 RETURNING *`,
      [status, sessionId, playerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const playerSession = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLPlayerSessionDAO.CACHE_KEY_PREFIX}${playerSession.id}`, playerSession, 3600);
    // 更新会话玩家列表缓存
    await RedisCache.delete(`player_sessions:session:${sessionId}`);
    return playerSession;
  }

  async updateChips(sessionId: string, playerId: string, chipsInPot: number, chipsRemaining: number): Promise<PlayerSession | null> {
    const result = await pool.query(
      `UPDATE ${PostgreSQLPlayerSessionDAO.TABLE_NAME} SET chips_in_pot = $1, chips_remaining = $2
       WHERE session_id = $3 AND player_id = $4 RETURNING *`,
      [chipsInPot, chipsRemaining, sessionId, playerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const playerSession = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLPlayerSessionDAO.CACHE_KEY_PREFIX}${playerSession.id}`, playerSession, 3600);
    // 更新会话玩家列表缓存
    await RedisCache.delete(`player_sessions:session:${sessionId}`);
    return playerSession;
  }
}

export class PostgreSQLActionDAO implements ActionDAO {
  private static readonly TABLE_NAME = 'actions';
  private static readonly CACHE_KEY_PREFIX = 'action:';

  async create(entity: Omit<Action, 'id' | 'created_at' | 'updated_at'>): Promise<Action> {
    const result = await pool.query(
      `INSERT INTO ${PostgreSQLActionDAO.TABLE_NAME} (session_id, player_id, action_type, amount, round)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [entity.session_id, entity.player_id, entity.action_type, entity.amount, entity.round]
    );

    const action = result.rows[0];
    // 缓存动作记录
    await RedisCache.set(`${PostgreSQLActionDAO.CACHE_KEY_PREFIX}${action.id}`, action, 3600);
    // 清除会话动作列表缓存
    await RedisCache.delete(`actions:session:${entity.session_id}`);
    await RedisCache.delete(`actions:session:${entity.session_id}:round:${entity.round}`);
    return action;
  }

  async getById(id: string): Promise<Action | null> {
    // 先从缓存获取
    const cachedAction = await RedisCache.get<Action>(`${PostgreSQLActionDAO.CACHE_KEY_PREFIX}${id}`);
    if (cachedAction) {
      return cachedAction;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLActionDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const action = result.rows[0];
    // 缓存动作记录
    await RedisCache.set(`${PostgreSQLActionDAO.CACHE_KEY_PREFIX}${action.id}`, action, 3600);
    return action;
  }

  async update(id: string, entity: Partial<Action>): Promise<Action | null> {
    // 构建更新语句
    const updateFields = Object.entries(entity)
      .map(([key, value], index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [...Object.values(entity), id];

    const result = await pool.query(
      `UPDATE ${PostgreSQLActionDAO.TABLE_NAME} SET ${updateFields}
       WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const action = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLActionDAO.CACHE_KEY_PREFIX}${action.id}`, action, 3600);
    // 清除会话动作列表缓存
    await RedisCache.delete(`actions:session:${action.session_id}`);
    await RedisCache.delete(`actions:session:${action.session_id}:round:${action.round}`);
    return action;
  }

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM ${PostgreSQLActionDAO.TABLE_NAME} WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return false;
    }

    const action = result.rows[0];
    // 删除缓存
    await RedisCache.delete(`${PostgreSQLActionDAO.CACHE_KEY_PREFIX}${id}`);
    // 清除会话动作列表缓存
    await RedisCache.delete(`actions:session:${action.session_id}`);
    await RedisCache.delete(`actions:session:${action.session_id}:round:${action.round}`);
    return true;
  }

  async getAll(): Promise<Action[]> {
    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLActionDAO.TABLE_NAME}`
    );

    return result.rows;
  }

  async getActionsBySession(sessionId: string): Promise<Action[]> {
    // 先从缓存获取
    const cachedActions = await RedisCache.get<Action[]>(`actions:session:${sessionId}`);
    if (cachedActions) {
      return cachedActions;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLActionDAO.TABLE_NAME} WHERE session_id = $1 ORDER BY created_at`,
      [sessionId]
    );

    // 缓存会话动作列表
    await RedisCache.set(`actions:session:${sessionId}`, result.rows, 300);
    return result.rows;
  }

  async getActionsByRound(sessionId: string, round: 'preflop' | 'flop' | 'turn' | 'river'): Promise<Action[]> {
    // 先从缓存获取
    const cachedActions = await RedisCache.get<Action[]>(`actions:session:${sessionId}:round:${round}`);
    if (cachedActions) {
      return cachedActions;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLActionDAO.TABLE_NAME} WHERE session_id = $1 AND round = $2 ORDER BY created_at`,
      [sessionId, round]
    );

    // 缓存会话特定回合动作列表
    await RedisCache.set(`actions:session:${sessionId}:round:${round}`, result.rows, 300);
    return result.rows;
  }
}

export class PostgreSQLCommunityCardsDAO implements CommunityCardsDAO {
  private static readonly TABLE_NAME = 'community_cards';
  private static readonly CACHE_KEY_PREFIX = 'community_cards:';

  async create(entity: Omit<CommunityCards, 'id' | 'created_at' | 'updated_at'>): Promise<CommunityCards> {
    const result = await pool.query(
      `INSERT INTO ${PostgreSQLCommunityCardsDAO.TABLE_NAME} (session_id, flop, turn, river)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [entity.session_id, JSON.stringify(entity.flop), JSON.stringify(entity.turn), JSON.stringify(entity.river)]
    );

    const communityCards = result.rows[0];
    // 缓存公共牌
    await RedisCache.set(`${PostgreSQLCommunityCardsDAO.CACHE_KEY_PREFIX}${communityCards.session_id}`, communityCards, 3600);
    return communityCards;
  }

  async getById(id: string): Promise<CommunityCards | null> {
    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLCommunityCardsDAO.TABLE_NAME} WHERE id = $1`,
      [id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async update(id: string, entity: Partial<CommunityCards>): Promise<CommunityCards | null> {
    // 处理牌的JSON序列化
    const processedEntity = { ...entity };
    if (processedEntity.flop) {
      (processedEntity as any).flop = JSON.stringify(processedEntity.flop);
    }
    if (processedEntity.turn) {
      (processedEntity as any).turn = JSON.stringify(processedEntity.turn);
    }
    if (processedEntity.river) {
      (processedEntity as any).river = JSON.stringify(processedEntity.river);
    }

    // 构建更新语句
    const updateFields = Object.entries(processedEntity)
      .map(([key, value], index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [...Object.values(processedEntity), id];

    const result = await pool.query(
      `UPDATE ${PostgreSQLCommunityCardsDAO.TABLE_NAME} SET ${updateFields}
       WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const communityCards = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLCommunityCardsDAO.CACHE_KEY_PREFIX}${communityCards.session_id}`, communityCards, 3600);
    return communityCards;
  }

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM ${PostgreSQLCommunityCardsDAO.TABLE_NAME} WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return false;
    }

    const communityCards = result.rows[0];
    // 删除缓存
    await RedisCache.delete(`${PostgreSQLCommunityCardsDAO.CACHE_KEY_PREFIX}${communityCards.session_id}`);
    return true;
  }

  async getAll(): Promise<CommunityCards[]> {
    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLCommunityCardsDAO.TABLE_NAME}`
    );

    return result.rows;
  }

  async getBySession(sessionId: string): Promise<CommunityCards | null> {
    // 先从缓存获取
    const cachedCards = await RedisCache.get<CommunityCards>(`${PostgreSQLCommunityCardsDAO.CACHE_KEY_PREFIX}${sessionId}`);
    if (cachedCards) {
      return cachedCards;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLCommunityCardsDAO.TABLE_NAME} WHERE session_id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const communityCards = result.rows[0];
    // 缓存公共牌
    await RedisCache.set(`${PostgreSQLCommunityCardsDAO.CACHE_KEY_PREFIX}${sessionId}`, communityCards, 3600);
    return communityCards;
  }

  async updateFlop(sessionId: string, flop: any[]): Promise<CommunityCards | null> {
    const result = await pool.query(
      `UPDATE ${PostgreSQLCommunityCardsDAO.TABLE_NAME} SET flop = $1
       WHERE session_id = $2 RETURNING *`,
      [JSON.stringify(flop), sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const communityCards = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLCommunityCardsDAO.CACHE_KEY_PREFIX}${sessionId}`, communityCards, 3600);
    return communityCards;
  }

  async updateTurn(sessionId: string, turn: any): Promise<CommunityCards | null> {
    const result = await pool.query(
      `UPDATE ${PostgreSQLCommunityCardsDAO.TABLE_NAME} SET turn = $1
       WHERE session_id = $2 RETURNING *`,
      [JSON.stringify(turn), sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const communityCards = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLCommunityCardsDAO.CACHE_KEY_PREFIX}${sessionId}`, communityCards, 3600);
    return communityCards;
  }

  async updateRiver(sessionId: string, river: any): Promise<CommunityCards | null> {
    const result = await pool.query(
      `UPDATE ${PostgreSQLCommunityCardsDAO.TABLE_NAME} SET river = $1
       WHERE session_id = $2 RETURNING *`,
      [JSON.stringify(river), sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const communityCards = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLCommunityCardsDAO.CACHE_KEY_PREFIX}${sessionId}`, communityCards, 3600);
    return communityCards;
  }
}

// 创建单例实例
export const postgreSQLGameSessionDAO = new PostgreSQLGameSessionDAO();
export const postgreSQLPlayerSessionDAO = new PostgreSQLPlayerSessionDAO();
export const postgreSQLActionDAO = new PostgreSQLActionDAO();
export const postgreSQLCommunityCardsDAO = new PostgreSQLCommunityCardsDAO();
