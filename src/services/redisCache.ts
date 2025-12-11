import redis from './redis';
import { promisify } from 'util';

export class RedisCache {
  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param expireTime 过期时间（秒）
   */
  static async set<T>(key: string, value: T, expireTime?: number): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);
      if (expireTime) {
        await redis.set(key, serializedValue, 'EX', expireTime);
      } else {
        await redis.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @returns 缓存值，如果不存在则返回null
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * 删除缓存
   * @param key 缓存键
   */
  static async delete(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  /**
   * 批量删除缓存
   * @param keys 缓存键数组
   */
  static async deleteBatch(keys: string[]): Promise<boolean> {
    try {
      if (keys.length > 0) {
        await redis.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Redis deleteBatch error:', error);
      return false;
    }
  }

  /**
   * 设置缓存过期时间
   * @param key 缓存键
   * @param expireTime 过期时间（秒）
   */
  static async expire(key: string, expireTime: number): Promise<boolean> {
    try {
      await redis.expire(key, expireTime);
      return true;
    } catch (error) {
      console.error('Redis expire error:', error);
      return false;
    }
  }

  /**
   * 检查缓存是否存在
   * @param key 缓存键
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  /**
   * 清空所有缓存
   */
  static async flushAll(): Promise<boolean> {
    try {
      await redis.flushall();
      return true;
    } catch (error) {
      console.error('Redis flushAll error:', error);
      return false;
    }
  }

  /**
   * 获取缓存TTL（剩余过期时间，秒）
   * @param key 缓存键
   */
  static async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      console.error('Redis ttl error:', error);
      return -1;
    }
  }
}
