import express from 'express';
import jwt from 'jsonwebtoken';
import { createRoom, getRoomList, getRoomById, joinRoom, leaveRoom } from '../services/roomService';
import { GameRoom } from '../types';

const router = express.Router();

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
 * tags:
 *   name: Rooms
 *   description: 房间管理相关API
 */

/**
 * @swagger
 * /rooms:
 *   post:
 *     summary: 创建房间
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               maxPlayers:
 *                 type: number
 *               buyIn:
 *                 type: number
 *               smallBlind:
 *                 type: number
 *               bigBlind:
 *                 type: number
 *     responses:
 *       201:
 *         description: 房间创建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 room:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     hostId:
 *                       type: string
 *                     players:
 *                       type: array
 *                       items:
 *                         type: object
 *                     maxPlayers:
 *                       type: number
 *                     buyIn:
 *                       type: number
 *                     smallBlind:
 *                       type: number
 *                     bigBlind:
 *                       type: number
 *                     status:
 *                       type: string
 *       400:
 *         description: 创建房间失败
 *       401:
 *         description: 未授权
 */
// 创建房间
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const input = req.body;
    const room = await createRoom(userId, input);
    res.status(201).json({ message: '房间创建成功', room });
  } catch (error: any) {
    res.status(400).json({ error: error.message || '创建房间失败' });
  }
});

/**
 * @swagger
 * /rooms:
 *   get:
 *     summary: 获取房间列表
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 房间状态筛选
 *     responses:
 *       200:
 *         description: 获取房间列表成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 rooms:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       hostId:
 *                         type: string
 *                       playerCount:
 *                         type: number
 *                       maxPlayers:
 *                         type: number
 *                       buyIn:
 *                         type: number
 *                       smallBlind:
 *                         type: number
 *                       bigBlind:
 *                         type: number
 *                       status:
 *                         type: string
 *       500:
 *         description: 获取房间列表失败
 */
// 获取房间列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const status = req.query.status as string;
    const rooms = await getRoomList(status);
    res.status(200).json({ message: '获取房间列表成功', rooms });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取房间列表失败' });
  }
});

/**
 * @swagger
 * /rooms/{roomId}:
 *   get:
 *     summary: 获取房间详情
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
 *         description: 房间ID
 *     responses:
 *       200:
 *         description: 获取房间详情成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 room:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     hostId:
 *                       type: string
 *                     players:
 *                       type: array
 *                       items:
 *                         type: object
 *                     maxPlayers:
 *                       type: number
 *                     buyIn:
 *                       type: number
 *                     smallBlind:
 *                       type: number
 *                     bigBlind:
 *                       type: number
 *                     status:
 *                       type: string
 *       400:
 *         description: 获取房间详情失败
 *       401:
 *         description: 未授权
 *       404:
 *         description: 房间不存在
 */
// 获取房间详情
router.get('/:roomId', authenticateToken, async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const room = await getRoomById(roomId);
    
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }
    
    res.status(200).json({ message: '获取房间详情成功', room });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取房间详情失败' });
  }
});

/**
 * @swagger
 * /rooms/{roomId}/join:
 *   post:
 *     summary: 加入房间
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
 *         description: 房间ID
 *     responses:
 *       200:
 *         description: 加入房间成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: 加入房间失败
 *       401:
 *         description: 未授权
 */
// 加入房间
router.post('/:roomId/join', authenticateToken, async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const userId = req.user!.userId;
    const success = await joinRoom(roomId, userId);
    
    if (success) {
      res.status(200).json({ message: '加入房间成功' });
    } else {
      res.status(400).json({ error: '加入房间失败' });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message || '加入房间失败' });
  }
});

/**
 * @swagger
 * /rooms/{roomId}/leave:
 *   post:
 *     summary: 离开房间
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         schema:
 *           type: string
 *         required: true
 *         description: 房间ID
 *     responses:
 *       200:
 *         description: 离开房间成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: 离开房间失败
 *       401:
 *         description: 未授权
 */
// 离开房间
router.post('/:roomId/leave', authenticateToken, async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const userId = req.user!.userId;
    const success = await leaveRoom(roomId, userId);
    
    if (success) {
      res.status(200).json({ message: '离开房间成功' });
    } else {
      res.status(400).json({ error: '离开房间失败' });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message || '离开房间失败' });
  }
});

export default router;
