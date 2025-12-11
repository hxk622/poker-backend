import pool from '../../services/database';
import { User, RegisterUserInput } from '../../types';
import { UserDAO } from '../userDAO';
import { RedisCache } from '../../services/redisCache';

export class PostgreSQLUserDAO implements UserDAO {
  private static readonly TABLE_NAME = 'user_accounts';
  private static readonly CACHE_KEY_PREFIX = 'user:';

  async create(entity: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const result = await pool.query(
      `INSERT INTO ${PostgreSQLUserDAO.TABLE_NAME} (username, email, phone, avatar, chips)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [entity.username, entity.email, entity.phone, entity.avatar, entity.chips]
    );

    const user = result.rows[0];
    // 缓存用户信息
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}${user.id}`, user, 3600);
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}username:${user.username}`, user, 3600);
    if (user.email) {
      await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}email:${user.email}`, user, 3600);
    }
    if (user.phone) {
      await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}phone:${user.phone}`, user, 3600);
    }
    return user;
  }

  async getById(id: string): Promise<User | null> {
    // 先从缓存获取
    const cachedUser = await RedisCache.get<User>(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}${id}`);
    if (cachedUser) {
      return cachedUser;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLUserDAO.TABLE_NAME} WHERE user_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    // 缓存用户信息
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}${user.id}`, user, 3600);
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}username:${user.username}`, user, 3600);
    if (user.email) {
      await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}email:${user.email}`, user, 3600);
    }
    if (user.phone) {
      await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}phone:${user.phone}`, user, 3600);
    }
    return user;
  }

  async update(id: string, entity: Partial<User>): Promise<User | null> {
    // 构建更新语句
    const updateFields = Object.entries(entity)
      .map(([key, value], index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [...Object.values(entity), id];

    const result = await pool.query(
      `UPDATE ${PostgreSQLUserDAO.TABLE_NAME} SET ${updateFields}, updated_at = NOW()
       WHERE user_id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}${user.id}`, user, 3600);
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}username:${user.username}`, user, 3600);
    if (user.email) {
      await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}email:${user.email}`, user, 3600);
    }
    if (user.phone) {
      await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}phone:${user.phone}`, user, 3600);
    }
    return user;
  }

  async delete(id: string): Promise<boolean> {
    const user = await this.getById(id);
    if (!user) {
      return false;
    }

    const result = await pool.query(
      `DELETE FROM ${PostgreSQLUserDAO.TABLE_NAME} WHERE user_id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return false;
    }

    // 删除所有相关缓存
    await RedisCache.deleteBatch([
      `${PostgreSQLUserDAO.CACHE_KEY_PREFIX}${id}`,
      `${PostgreSQLUserDAO.CACHE_KEY_PREFIX}username:${user.username}`,
      ...(user.email ? [`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}email:${user.email}`] : []),
      ...(user.phone ? [`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}phone:${user.phone}`] : [])
    ]);
    return true;
  }

  async getAll(): Promise<User[]> {
    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLUserDAO.TABLE_NAME}`
    );

    return result.rows;
  }

  async getByUsername(username: string): Promise<User | null> {
    // 先从缓存获取
    const cachedUser = await RedisCache.get<User>(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}username:${username}`);
    if (cachedUser) {
      return cachedUser;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLUserDAO.TABLE_NAME} WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    // 缓存用户信息
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}${user.id}`, user, 3600);
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}username:${user.username}`, user, 3600);
    return user;
  }

  async getByEmail(email: string): Promise<User | null> {
    // 先从缓存获取
    const cachedUser = await RedisCache.get<User>(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}email:${email}`);
    if (cachedUser) {
      return cachedUser;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLUserDAO.TABLE_NAME} WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    // 缓存用户信息
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}${user.id}`, user, 3600);
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}email:${user.email}`, user, 3600);
    return user;
  }

  async getByPhone(phone: string): Promise<User | null> {
    // 先从缓存获取
    const cachedUser = await RedisCache.get<User>(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}phone:${phone}`);
    if (cachedUser) {
      return cachedUser;
    }

    const result = await pool.query(
      `SELECT * FROM ${PostgreSQLUserDAO.TABLE_NAME} WHERE phone = $1`,
      [phone]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    // 缓存用户信息
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}${user.id}`, user, 3600);
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}phone:${user.phone}`, user, 3600);
    return user;
  }

  async register(input: RegisterUserInput): Promise<User> {
    const { username, password, email, phone } = input;
    
    const result = await pool.query(
      `INSERT INTO ${PostgreSQLUserDAO.TABLE_NAME} (username, password, email, phone, chips)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [username, password, email, phone, 10000] // 默认初始筹码为10000
    );

    const user = result.rows[0];
    // 缓存用户信息
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}${user.id}`, user, 3600);
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}username:${user.username}`, user, 3600);
    if (user.email) {
      await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}email:${user.email}`, user, 3600);
    }
    if (user.phone) {
      await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}phone:${user.phone}`, user, 3600);
    }
    return user;
  }

  async updateChips(userId: string, chips: number): Promise<User | null> {
    const result = await pool.query(
      `UPDATE ${PostgreSQLUserDAO.TABLE_NAME} SET chips = $1, updated_at = NOW()
       WHERE user_id = $2 RETURNING *`,
      [chips, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    // 更新缓存
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}${user.id}`, user, 3600);
    await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}username:${user.username}`, user, 3600);
    if (user.email) {
      await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}email:${user.email}`, user, 3600);
    }
    if (user.phone) {
      await RedisCache.set(`${PostgreSQLUserDAO.CACHE_KEY_PREFIX}phone:${user.phone}`, user, 3600);
    }
    return user;
  }
}

// 创建单例实例
export const postgreSQLUserDAO = new PostgreSQLUserDAO();
