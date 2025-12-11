import { User, RegisterUserInput } from '../types';
import { BaseDAO } from './baseDAO';

export interface UserDAO extends BaseDAO<User, string> {
  // 根据用户名获取用户
  getByUsername(username: string): Promise<User | null>;
  
  // 根据邮箱获取用户
  getByEmail(email: string): Promise<User | null>;
  
  // 根据手机号获取用户
  getByPhone(phone: string): Promise<User | null>;
  
  // 用户注册
  register(input: RegisterUserInput): Promise<User>;
  
  // 更新用户筹码
  updateChips(userId: string, chips: number): Promise<User | null>;
}
