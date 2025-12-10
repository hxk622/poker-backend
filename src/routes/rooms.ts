import express from 'express';
import { createRoom, getRoomList, getRoomById, joinRoom, leaveRoom } from '../services/roomService';
import { GameRoom } from '../types';

const router = express.Router();

// 中间件：验证JWT令牌
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '未提供令牌' });
  }
  
  // 这里应该使用JWT验证逻辑，为了简化，我们暂时直接从令牌中提取用户ID
  // TODO: 实现JWT验证
  req.user = { userId: 'test-user-id' };
  next();
};

// 扩展Express请求类型
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string };
    }
  }
}

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

// 获取房间列表
router.get('/', async (req, res) => {
  try {
    const status = req.query.status as string;
    const rooms = await getRoomList(status);
    res.status(200).json({ message: '获取房间列表成功', rooms });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取房间列表失败' });
  }
});

// 获取房间详情
router.get('/:roomId', async (req, res) => {
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
