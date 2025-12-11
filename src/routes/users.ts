import express from 'express';
import jwt from 'jsonwebtoken';
import { registerUser, loginUser, getUserById, updateUserProfile, getUserStats } from '../services/userService';
import { User, RegisterUserInput, LoginUserInput } from '../types';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: 用户管理相关API
 */

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 中间件：验证JWT令牌
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '未提供令牌' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效' });
    }
    
    // 将用户ID存储在请求对象中
    req.user = user as { userId: string };
    next();
  });
};

// 扩展Express请求类型
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string };
    }
  }
}

/**
 * @swagger
 * /users/register:
 *   post:
 *     summary: 用户注册
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterUserInput'
 *     responses:
 *       201:
 *         description: 用户注册成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: 注册失败
 */
router.post('/register', async (req, res) => {
  try {
    const input: RegisterUserInput = req.body;
    const user = await registerUser(input);
    res.status(201).json({ message: '用户注册成功', user });
  } catch (error: any) {
    res.status(400).json({ error: error.message || '注册失败' });
  }
});

/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: 用户登录
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginUserInput'
 *           example:
 *             username: exampleuser
 *             password: password123
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       401:
 *         description: 登录失败
 */
router.post('/login', async (req, res) => {
  try {
    const input: LoginUserInput = req.body;
    const { user, token } = await loginUser(input);
    res.status(200).json({ message: '登录成功', user, token });
  } catch (error: any) {
    res.status(401).json({ error: error.message || '登录失败' });
  }
});

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: 获取用户资料
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取用户资料成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: 未授权或获取用户资料失败
 *       404:
 *         description: 用户不存在
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.status(200).json({ message: '获取用户资料成功', user });
  } catch (error: any) {
    res.status(401).json({ error: error.message || '获取用户资料失败' });
  }
});

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: 更新用户资料
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: 更新用户资料成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: 更新用户资料失败
 *       401:
 *         description: 未授权
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    const updatedUser = await updateUserProfile(userId, data);
    res.status(200).json({ message: '更新用户资料成功', user: updatedUser });
  } catch (error: any) {
    res.status(400).json({ error: error.message || '更新用户资料失败' });
  }
});

/**
 * @swagger
 * /users/stats:
 *   get:
 *     summary: 获取用户统计数据
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取用户统计数据成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     gamesPlayed:
 *                       type: number
 *                     gamesWon:
 *                       type: number
 *                     winRate:
 *                       type: number
 *                     totalChips:
 *                       type: number
 *       400:
 *         description: 获取用户统计数据失败
 *       401:
 *         description: 未授权
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const stats = await getUserStats(userId);
    res.status(200).json({ message: '获取用户统计数据成功', stats });
  } catch (error: any) {
    res.status(400).json({ error: error.message || '获取用户统计数据失败' });
  }
});

export default router;
