import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './database';
import { User, RegisterUserInput, LoginUserInput } from '../types';
import { postgreSQLUserDAO } from '../dao/impl/postgreSQLUserDAO';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '24h';

// 哈希密码
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// 验证密码
const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

// 生成JWT令牌
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// 用户注册
export const registerUser = async (input: RegisterUserInput): Promise<User> => {
  const { username, password, email, phone } = input;
  
  // 哈希密码
  const hashedPassword = await hashPassword(password);
  
  // 创建用户
  return await postgreSQLUserDAO.register({ 
    username, 
    password: hashedPassword, 
    email, 
    phone 
  });
};

// 用户登录
export const loginUser = async (input: LoginUserInput): Promise<{ user: User; token: string }> => {
  const { email, phone, username, password } = input;
  
  // 根据邮箱、手机号或用户名查找用户
  let user: User | null = null;
  
  if (email) {
    user = await postgreSQLUserDAO.getByEmail(email);
  } else if (phone) {
    user = await postgreSQLUserDAO.getByPhone(phone);
  } else if (username) {
    user = await postgreSQLUserDAO.getByUsername(username);
  } else {
    throw new BadRequestError('必须提供邮箱、手机号或用户名');
  }
  
  if (!user) {
    throw new NotFoundError('用户不存在');
  }
  
  // 验证密码
  const isPasswordValid = await verifyPassword(password, user.password);
  
  if (!isPasswordValid) {
    throw new UnauthorizedError('密码错误');
  }
  
  // 生成令牌
  const token = generateToken(user.id);
  
  return { user, token };
};

// 根据ID获取用户
export const getUserById = async (userId: string): Promise<User | null> => {
  return await postgreSQLUserDAO.getById(userId);
};

// 更新用户资料
export const updateUserProfile = async (userId: string, data: Partial<User>): Promise<User | null> => {
  // 移除密码相关字段，密码更新应单独处理
  const { password, ...updateData } = data;
  
  // 更新用户
  return await postgreSQLUserDAO.update(userId, updateData);
};

// 获取用户统计数据
export const getUserStats = async (userId: string): Promise<any> => {
  try {
    // 从user_stats表获取用户统计数据
    const result = await pool.query(
      `SELECT * FROM user_stats WHERE user_id = $1`,
      [userId]
    );

    // 如果存在统计数据，直接返回
    if (result.rows.length > 0) {
      const stats = result.rows[0];
      return {
        total_games: stats.total_games,
        total_wins: stats.total_wins,
        total_losses: stats.total_losses,
        win_rate: stats.total_games > 0 ? (stats.total_wins / stats.total_games * 100).toFixed(2) + '%' : '0%',
        total_chips_won: stats.total_chips_won,
        total_chips_lost: stats.total_chips_lost,
        average_chips_per_game: stats.total_games > 0 ? Math.round(stats.total_chips_won / stats.total_games) : 0
      };
    }

    // 如果不存在统计数据，从原始表计算
    const gameStatsResult = await pool.query(
      `SELECT
        COUNT(DISTINCT gs.id) as total_games,
        COUNT(CASE WHEN sp.is_winner = true THEN 1 END) as total_wins
      FROM session_players sp
      JOIN game_sessions gs ON sp.session_id = gs.id
      WHERE sp.user_id = $1 AND gs.status = 'finished'`,
      [userId]
    );

    const chipStatsResult = await pool.query(
      `SELECT
        SUM(CASE WHEN sp.is_winner = true THEN sp.chips ELSE 0 END) as total_chips_won,
        SUM(CASE WHEN sp.is_winner = false THEN sp.bet_amount ELSE 0 END) as total_chips_lost
      FROM session_players sp
      JOIN game_sessions gs ON sp.session_id = gs.id
      WHERE sp.user_id = $1 AND gs.status = 'finished'`,
      [userId]
    );

    const gameStats = gameStatsResult.rows[0];
    const chipStats = chipStatsResult.rows[0];

    const totalGames = parseInt(gameStats.total_games) || 0;
    const totalWins = parseInt(gameStats.total_wins) || 0;
    const totalLosses = totalGames - totalWins;
    const winRate = totalGames > 0 ? (totalWins / totalGames * 100).toFixed(2) + '%' : '0%';
    const totalChipsWon = parseInt(chipStats.total_chips_won) || 0;
    const totalChipsLost = parseInt(chipStats.total_chips_lost) || 0;
    const averageChipsPerGame = totalGames > 0 ? Math.round(totalChipsWon / totalGames) : 0;

    // 将计算结果保存到user_stats表，以便后续快速查询
    await pool.query(
      `INSERT INTO user_stats (user_id, total_games, total_wins, total_losses, total_chips_won, total_chips_lost)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE
       SET total_games = $2, total_wins = $3, total_losses = $4, total_chips_won = $5, total_chips_lost = $6, updated_at = NOW()`,
      [userId, totalGames, totalWins, totalLosses, totalChipsWon, totalChipsLost]
    );

    return {
      total_games: totalGames,
      total_wins: totalWins,
      total_losses: totalLosses,
      win_rate: winRate,
      total_chips_won: totalChipsWon,
      total_chips_lost: totalChipsLost,
      average_chips_per_game: averageChipsPerGame
    };
  } catch (error: any) {
    console.error('获取用户统计数据失败:', error);
    // 如果查询失败，返回默认值
    return {
      total_games: 0,
      total_wins: 0,
      total_losses: 0,
      win_rate: '0%',
      total_chips_won: 0,
      total_chips_lost: 0,
      average_chips_per_game: 0
    };
  }
};

// 更新用户筹码
export const updateUserChips = async (userId: string, chips: number): Promise<User | null> => {
  return await postgreSQLUserDAO.updateChips(userId, chips);
};

// 重置密码
export const resetPassword = async (userId: string, oldPassword: string, newPassword: string): Promise<User | null> => {
  // 获取用户信息
  const user = await postgreSQLUserDAO.getById(userId);
  
  if (!user) {
    throw new NotFoundError('用户不存在');
  }
  
  // 验证旧密码
  if (!await verifyPassword(oldPassword, user.password)) {
    throw new UnauthorizedError('旧密码错误');
  }
  
  // 哈希新密码
  const hashedPassword = await hashPassword(newPassword);
  
  // 更新密码
  return await postgreSQLUserDAO.update(userId, { password: hashedPassword });
};
