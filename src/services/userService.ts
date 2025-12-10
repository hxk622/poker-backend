import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './database';
import { User, RegisterUserInput, LoginUserInput } from '../types';

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
  
  // 检查用户名是否已存在
  const existingUser = await pool.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  
  if (existingUser.rows.length > 0) {
    throw new Error('用户名已存在');
  }
  
  // 检查邮箱是否已存在（如果提供）
  if (email) {
    const existingEmail = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (existingEmail.rows.length > 0) {
      throw new Error('邮箱已存在');
    }
  }
  
  // 检查手机号是否已存在（如果提供）
  if (phone) {
    const existingPhone = await pool.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );
    
    if (existingPhone.rows.length > 0) {
      throw new Error('手机号已存在');
    }
  }
  
  // 哈希密码
  const hashedPassword = await hashPassword(password);
  
  // 创建用户
  const newUser = await pool.query(
    `INSERT INTO users (username, password_hash, email, phone, chips, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING *`,
    [username, hashedPassword, email, phone, 10000] // 初始筹码10000
  );
  
  return newUser.rows[0];
};

// 用户登录
export const loginUser = async (input: LoginUserInput): Promise<{ user: User; token: string }> => {
  const { email, phone, password } = input;
  
  // 根据邮箱或手机号查找用户
  let userQuery;
  let userParams;
  
  if (email) {
    userQuery = 'SELECT * FROM users WHERE email = $1';
    userParams = [email];
  } else if (phone) {
    userQuery = 'SELECT * FROM users WHERE phone = $1';
    userParams = [phone];
  } else {
    throw new Error('必须提供邮箱或手机号');
  }
  
  const result = await pool.query(userQuery, userParams);
  
  if (result.rows.length === 0) {
    throw new Error('用户不存在');
  }
  
  const user = result.rows[0];
  
  // 验证密码
  const isPasswordValid = await verifyPassword(password, user.password_hash);
  
  if (!isPasswordValid) {
    throw new Error('密码错误');
  }
  
  // 生成令牌
  const token = generateToken(user.id);
  
  return { user, token };
};

// 根据ID获取用户
export const getUserById = async (userId: string): Promise<User | null> => {
  const result = await pool.query(
    'SELECT id, username, email, phone, avatar, chips, created_at, updated_at FROM users WHERE id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0];
};

// 更新用户资料
export const updateUserProfile = async (userId: string, data: Partial<User>): Promise<User> => {
  // 构建更新查询
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;
  
  if (data.username) {
    // 检查用户名是否已存在
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND id != $2',
      [data.username, userId]
    );
    
    if (existingUser.rows.length > 0) {
      throw new Error('用户名已存在');
    }
    
    updates.push(`username = $${paramIndex++}`);
    params.push(data.username);
  }
  
  if (data.email) {
    // 检查邮箱是否已存在
    const existingEmail = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND id != $2',
      [data.email, userId]
    );
    
    if (existingEmail.rows.length > 0) {
      throw new Error('邮箱已存在');
    }
    
    updates.push(`email = $${paramIndex++}`);
    params.push(data.email);
  }
  
  if (data.phone) {
    // 检查手机号是否已存在
    const existingPhone = await pool.query(
      'SELECT * FROM users WHERE phone = $1 AND id != $2',
      [data.phone, userId]
    );
    
    if (existingPhone.rows.length > 0) {
      throw new Error('手机号已存在');
    }
    
    updates.push(`phone = $${paramIndex++}`);
    params.push(data.phone);
  }
  
  if (data.avatar) {
    updates.push(`avatar = $${paramIndex++}`);
    params.push(data.avatar);
  }
  
  updates.push(`updated_at = NOW()`);
  params.push(userId);
  
  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
  
  await pool.query(query, params);
  
  // 返回更新后的用户
  return getUserById(userId) as Promise<User>;
};

// 获取用户统计数据
export const getUserStats = async (userId: string): Promise<any> => {
  // TODO: 实现用户统计数据查询
  return {
    total_games: 0,
    total_wins: 0,
    total_losses: 0,
    win_rate: 0,
    total_chips_won: 0,
    total_chips_lost: 0,
    average_chips_per_game: 0
  };
};
