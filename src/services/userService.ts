import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './database';
import { User, RegisterUserInput, LoginUserInput } from '../types';
import { postgreSQLUserDAO } from '../dao/impl/postgreSQLUserDAO';

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
    throw new Error('必须提供邮箱、手机号或用户名');
  }
  
  if (!user) {
    throw new Error('用户不存在');
  }
  
  // 验证密码
  const isPasswordValid = await verifyPassword(password, user.password);
  
  if (!isPasswordValid) {
    throw new Error('密码错误');
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

// 更新用户筹码
export const updateUserChips = async (userId: string, chips: number): Promise<User | null> => {
  return await postgreSQLUserDAO.updateChips(userId, chips);
};

// 重置密码
export const resetPassword = async (userId: string, oldPassword: string, newPassword: string): Promise<User | null> => {
  // 获取用户信息
  const user = await postgreSQLUserDAO.getById(userId);
  
  if (!user) {
    throw new Error('用户不存在');
  }
  
  // 验证旧密码
  if (!await verifyPassword(oldPassword, user.password)) {
    throw new Error('旧密码错误');
  }
  
  // 哈希新密码
  const hashedPassword = await hashPassword(newPassword);
  
  // 更新密码
  return await postgreSQLUserDAO.update(userId, { password: hashedPassword });
};
