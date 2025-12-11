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

/**
 * @swagger
 * /games/{gameId}/action:
 *   post:
 *     summary: 执行游戏动作（下注、跟注、弃牌等）
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         schema:
 *           type: string
 *         required: true
 *         description: 游戏ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [fold, check, call, raise, allin]
 *                 description: 游戏动作类型
 *               amount:
 *                 type: number
 *                 description: 下注金额（仅在raise动作时需要）
 *     responses:
 *       200:
 *         description: 游戏动作执行成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
// 执行游戏动作
const executeGameAction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const action: GameAction = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: '用户未认证' });
    }

    const gameStatus = await executeGameActionService(gameId, userId, action);

    res.status(200).json({
      message: '游戏动作执行成功',
      data: gameStatus
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误', details: (error as Error).message });
  }
};

/**
 * @swagger
 * /games/{gameId}/history:
 *   get:
 *     summary: 获取牌局历史
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         schema:
 *           type: string
 *         required: true
 *         description: 游戏ID
 *     responses:
 *       200:
 *         description: 获取牌局历史成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     gameId:
 *                       type: string
 *                     actions:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
// 获取牌局历史
const getGameHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameId } = req.params;
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
        gameId,
        actions: []
      }
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误', details: (error as Error).message });
  }
};

/**
 * @swagger
 * /games/stats:
 *   get:
 *     summary: 获取用户游戏统计
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取游戏统计成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
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
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
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

/**
 * @swagger
 * /games/{gameId}:
 *   get:
 *     summary: 获取当前牌局状态
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         schema:
 *           type: string
 *         required: true
 *         description: 游戏ID
 *     responses:
 *       200:
 *         description: 获取牌局状态成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     gameId:
 *                       type: string
 *                     players:
 *                       type: array
 *                       items:
 *                         type: object
 *                     communityCards:
 *                       type: array
 *                       items:
 *                         type: object
 *                     currentPlayer:
 *                       type: string
 *                     round:
 *                       type: string
 *                     pot:
 *                       type: number
 *                     actions:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
// 获取当前牌局状态
const getGameStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: '用户未认证' });
    }

    const gameStatus = await getGameStatusService(gameId);

    res.status(200).json({
      message: '获取牌局状态成功',
      data: gameStatus
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误', details: (error as Error).message });
  }
};

/**
 * @swagger
 * /games/{gameId}/start:
 *   post:
 *     summary: 开始新牌局
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         schema:
 *           type: string
 *         required: true
 *         description: 游戏ID
 *     responses:
 *       200:
 *         description: 新牌局开始成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     gameId:
 *                       type: string
 *                     players:
 *                       type: array
 *                       items:
 *                         type: object
 *                     communityCards:
 *                       type: array
 *                       items:
 *                         type: object
 *                     currentPlayer:
 *                       type: string
 *                     round:
 *                       type: string
 *                     pot:
 *                       type: number
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
// 开始新牌局
const startNewGameRoute = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: '用户未认证' });
    }

    const gameSession = await startNewGame(gameId);

    res.status(200).json({
      message: '新牌局开始成功',
      data: gameSession
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误', details: (error as Error).message });
  }
};

// 注册路由
router.post('/:gameId/action', verifyToken, executeGameAction);
router.get('/:gameId/history', verifyToken, getGameHistory);
router.get('/:gameId/stats', verifyToken, getGameStats);
router.get('/:gameId', verifyToken, getGameStatus);
router.post('/:gameId/start', verifyToken, startNewGameRoute);
router.get('/stats', verifyToken, getGameStats);
/**
 * @swagger
 * /games/{gameId}/ai/analysis:
 *   post:
 *     summary: 请求AI分析
 *     tags: [Games]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         schema:
 *           type: string
 *         required: true
 *         description: 游戏ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               playerCards:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 手牌
 *                 minItems: 2
 *                 maxItems: 2
 *               communityCards:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 公共牌
 *     responses:
 *       200:
 *         description: AI分析成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     gameId:
 *                       type: string
 *                     playerCards:
 *                       type: array
 *                       items:
 *                         type: string
 *                     communityCards:
 *                       type: array
 *                       items:
 *                         type: string
 *                     analysis:
 *                       type: object
 *                       properties:
 *                         handStrength:
 *                           type: number
 *                         winningOdds:
 *                           type: number
 *                         recommendedAction:
 *                           type: string
 *                         potOdds:
 *                           type: number
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.post('/:gameId/ai/analysis', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gameId } = req.params;
    const { playerCards, communityCards } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: '用户未认证' });
    }

    if (!playerCards || !Array.isArray(playerCards) || playerCards.length !== 2) {
      return res.status(400).json({ error: '请提供有效的手牌' });
    }

    // 调用AI服务进行分析
    const analysis = {
      gameId,
      playerCards,
      communityCards,
      analysis: {
        handStrength: 0.75,
        winningOdds: 0.6,
        recommendedAction: 'call',
        potOdds: 0.5
      }
    };

    res.status(200).json({
      message: 'AI分析成功',
      data: analysis
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误', details: (error as Error).message });
  }
});

export default router;
