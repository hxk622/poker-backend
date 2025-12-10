import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { GameSession, GameAction } from '../types';
import { startNewGame, getGameStatus as getGameStatusService, executeGameAction as executeGameActionService } from '../services/gameService';

// 扩展Express请求类型，添加userId
interface AuthenticatedRequest extends Request {
  userId?: string;
}

// JWT验证中间件
const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: '无效的认证令牌' });
  }
};

const router = express.Router();

// 执行游戏动作
const executeGameAction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const action: GameAction = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: '用户未认证' });
    }

    const gameStatus = await executeGameActionService(sessionId, userId, action);

    res.status(200).json({
      message: '游戏动作执行成功',
      data: gameStatus
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误', details: (error as Error).message });
  }
};

// 获取牌局历史
const getGameHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: '用户未认证' });
    }

    // TODO: 实现获取牌局历史逻辑
    // 1. 检查用户是否有权限访问该牌局
    // 2. 查询牌局历史记录
    // 3. 返回历史记录

    res.status(200).json({
      message: '获取牌局历史成功',
      data: {
        sessionId,
        actions: []
      }
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误', details: (error as Error).message });
  }
};

// 获取游戏统计
const getGameStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: '用户未认证' });
    }

    // TODO: 实现获取游戏统计逻辑
    // 1. 查询用户的游戏统计数据
    // 2. 返回统计结果

    res.status(200).json({
      message: '获取游戏统计成功',
      data: {
        gamesPlayed: 0,
        gamesWon: 0,
        winRate: 0,
        totalChips: 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误', details: (error as Error).message });
  }
};

// 获取当前牌局状态
const getGameStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: '用户未认证' });
    }

    const gameStatus = await getGameStatusService(sessionId);

    res.status(200).json({
      message: '获取牌局状态成功',
      data: gameStatus
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误', details: (error as Error).message });
  }
};

// 开始新牌局
const startNewGameRoute = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: '用户未认证' });
    }

    const gameSession = await startNewGame(roomId);

    res.status(200).json({
      message: '新牌局开始成功',
      data: gameSession
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误', details: (error as Error).message });
  }
};

// 注册路由
router.post('/:sessionId/actions', verifyToken, executeGameAction);
router.get('/:sessionId/history', verifyToken, getGameHistory);
router.get('/stats', verifyToken, getGameStats);
router.get('/:sessionId/status', verifyToken, getGameStatus);
router.post('/:roomId/start', verifyToken, startNewGameRoute);

export default router;
