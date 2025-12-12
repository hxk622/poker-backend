import express from 'express';
import { AIAnalysis, AISuggestion } from '../types';
import { aiService } from '../services/aiService';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI分析相关API
 */

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

/**
 * @swagger
 * /ai/{gameId}/analyze-hand:
 *   post:
 *     summary: AI分析牌局
 *     tags: [AI]
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
 *               holeCards:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 2
 *                 maxItems: 2
 *                 description: 手牌
 *               communityCards:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 公共牌
 *               betHistory:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: 下注历史
 *               potSize:
 *                 type: number
 *                 description: 底池大小
 *               currentBet:
 *                 type: number
 *                 description: 当前下注金额
 *               stackSize:
 *                 type: number
 *                 description: 玩家筹码
 *     responses:
 *       200:
 *         description: AI分析牌局成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 analysis:
 *                   type: object
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 */
// AI分析牌局
router.post('/:gameId/analyze-hand', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { gameId } = req.params;
    const { holeCards, communityCards, betHistory, potSize, currentBet, stackSize } = req.body;
    
    // 验证输入
    if (!holeCards || !Array.isArray(holeCards) || holeCards.length !== 2) {
      return res.status(400).json({ error: '请提供有效的手牌' });
    }
    
    // 调用AI服务分析牌局
    const analysis = aiService.analyzeHand(
      userId,
      gameId,
      holeCards,
      communityCards || [],
      betHistory || [],
      potSize || 0,
      currentBet || 0,
      stackSize || 0
    );
    
    res.status(200).json({ message: 'AI分析牌局成功', analysis });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'AI分析牌局失败' });
  }
});

/**
 * @swagger
 * /ai/{gameId}/suggestions:
 *   get:
 *     summary: 获取AI建议
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         schema:
 *           type: string
 *         required: true
 *         description: 游戏ID
 *       - in: query
 *         name: style
 *         schema:
 *           type: string
 *           enum: [gto, professional]
 *         description: AI风格
 *       - in: query
 *         name: hand
 *         schema:
 *           type: string
 *         description: 手牌（JSON格式）
 *       - in: query
 *         name: communityCards
 *         schema:
 *           type: string
 *         description: 公共牌（JSON格式）
 *       - in: query
 *         name: betHistory
 *         schema:
 *           type: string
 *         description: 下注历史（JSON格式）
 *       - in: query
 *         name: potSize
 *         schema:
 *           type: number
 *         description: 底池大小
 *       - in: query
 *         name: currentBet
 *         schema:
 *           type: number
 *         description: 当前下注金额
 *       - in: query
 *         name: stackSize
 *         schema:
 *           type: number
 *         description: 玩家筹码
 *     responses:
 *       200:
 *         description: 获取AI建议成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 suggestion:
 *                   type: object
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 */
// 获取AI建议
router.get('/:gameId/suggestions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { gameId } = req.params;
    const { style = 'gto', hand, communityCards, betHistory, potSize, currentBet, stackSize } = req.query;
    
    // 转换参数类型
    const styleStr = typeof style === 'string' ? style : 'gto';
    const handStr = typeof hand === 'string' ? hand : '';
    const communityCardsStr = typeof communityCards === 'string' ? communityCards : '';
    const betHistoryStr = typeof betHistory === 'string' ? betHistory : '';
    const potSizeStr = typeof potSize === 'string' ? potSize : '0';
    const currentBetStr = typeof currentBet === 'string' ? currentBet : '0';
    const stackSizeStr = typeof stackSize === 'string' ? stackSize : '0';
    
    // 验证输入
    if (!handStr) {
      return res.status(400).json({ error: '请提供有效的手牌' });
    }
    
    let parsedHand;
    try {
      parsedHand = JSON.parse(handStr);
      if (!Array.isArray(parsedHand) || parsedHand.length !== 2) {
        throw new Error('无效的手牌格式');
      }
    } catch (error) {
      return res.status(400).json({ error: '请提供有效的手牌JSON格式' });
    }
    
    if (!['gto', 'professional'].includes(styleStr)) {
      return res.status(400).json({ error: '无效的AI风格，支持的风格：gto, professional' });
    }
    
    // 解析其他可选参数
    let parsedCommunityCards = [];
    if (communityCardsStr) {
      try {
        parsedCommunityCards = JSON.parse(communityCardsStr);
      } catch (error) {
        // 忽略无效的公共牌格式，使用空数组
      }
    }
    
    let parsedBetHistory = [];
    if (betHistoryStr) {
      try {
        parsedBetHistory = JSON.parse(betHistoryStr);
      } catch (error) {
        // 忽略无效的下注历史格式，使用空数组
      }
    }
    
    // 调用AI服务获取建议
    const suggestion = aiService.getSuggestion(
      userId,
      gameId,
      styleStr as 'gto' | 'professional',
      parsedHand,
      parsedCommunityCards,
      parsedBetHistory,
      parseInt(potSizeStr),
      parseInt(currentBetStr),
      parseInt(stackSizeStr)
    );
    
    res.status(200).json({ message: '获取AI建议成功', suggestion });
  } catch (error: any) {
    res.status(400).json({ error: error.message || '获取AI建议失败' });
  }
});

/**
 * @swagger
 * /ai/train:
 *   post:
 *     summary: AI训练
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               trainingData:
 *                 type: object
 *                 description: 训练数据
 *     responses:
 *       200:
 *         description: AI训练成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 trainingData:
 *                   type: object
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 */
// AI训练
router.post('/train', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { trainingData } = req.body;
    
    // 验证训练数据格式
    if (!trainingData || typeof trainingData !== 'object') {
      return res.status(400).json({ error: '请提供有效的训练数据' });
    }
    
    // 调用AI服务进行训练
    const trainingResult = await aiService.trainAI({
      userId,
      ...trainingData
    });
    
    res.status(200).json({ 
      message: 'AI模型训练成功', 
      trainingId: trainingResult.trainingId,
      metrics: trainingResult.metrics,
      trainingData
    });
  } catch (error: any) {
    console.error('AI训练失败:', error);
    res.status(500).json({ error: error.message || 'AI训练失败' });
  }
});

/**
 * @swagger
 * /ai/{gameId}/analyze-hand:
 *   post:
 *     summary: 获取牌力评估
 *     tags: [AI]
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
 *               holeCards:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 2
 *                 maxItems: 2
 *                 description: 手牌
 *               communityCards:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 公共牌
 *     responses:
 *       200:
 *         description: 牌力评估成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 handStrength:
 *                   type: number
 *                 description:
 *                   type: string
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 */
// 获取牌力评估
router.post('/:gameId/analyze-hand', authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { holeCards, communityCards } = req.body;
    
    // 验证输入
    if (!holeCards || !Array.isArray(holeCards) || holeCards.length !== 2) {
      return res.status(400).json({ error: '请提供有效的手牌' });
    }
    
    // 调用AI服务计算牌力
    const handStrength = aiService['calculateHandStrength'](holeCards, communityCards || []);
    
    res.status(200).json({ 
      message: '牌力评估成功', 
      handStrength, // 牌力值(0-1)
      description: `牌力评估值为 ${(handStrength * 100).toFixed(2)}%`
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || '牌力评估失败' });
  }
});

/**
 * @swagger
 * /ai/{gameId}/calculate-odds:
 *   post:
 *     summary: 获取赔率计算
 *     tags: [AI]
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
 *               holeCards:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 2
 *                 maxItems: 2
 *                 description: 手牌
 *               communityCards:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 公共牌
 *               remainingPlayers:
 *                 type: number
 *                 description: 剩余玩家数
 *               potSize:
 *                 type: number
 *                 description: 底池大小
 *               currentBet:
 *                 type: number
 *                 description: 当前下注金额
 *               expectedFutureBets:
 *                 type: number
 *                 description: 预期未来下注
 *     responses:
 *       200:
 *         description: 赔率计算成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 winningOdds:
 *                   type: number
 *                 potOdds:
 *                   type: number
 *                 impliedOdds:
 *                   type: number
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 */
// 获取赔率计算
router.post('/:gameId/calculate-odds', authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { holeCards, communityCards, remainingPlayers, potSize, currentBet, expectedFutureBets } = req.body;
    
    // 验证输入
    if (!holeCards || !Array.isArray(holeCards) || holeCards.length !== 2) {
      return res.status(400).json({ error: '请提供有效的手牌' });
    }
    
    // 计算底池赔率
    const potOdds = aiService['calculatePotOdds'](potSize || 0, currentBet || 0);
    
    // 计算隐含赔率
    const impliedOdds = aiService['calculateImpliedOdds'](potSize || 0, currentBet || 0, expectedFutureBets || 0);
    
    // 计算牌力（作为胜率的简化表示）
    const handStrength = aiService['calculateHandStrength'](holeCards, communityCards || []);
    const winningOdds = handStrength;
    
    res.status(200).json({ 
      message: '赔率计算成功', 
      winningOdds,
      potOdds,
      impliedOdds 
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || '赔率计算失败' });
  }
});

/**
 * @swagger
 * /ai/{gameId}/analyze-opponent/{opponentId}:
 *   get:
 *     summary: 对手行为分析
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         schema:
 *           type: string
 *         required: true
 *         description: 游戏ID
 *       - in: path
 *         name: opponentId
 *         schema:
 *           type: string
 *         required: true
 *         description: 对手ID
 *     responses:
 *       200:
 *         description: 对手行为分析成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 opponentId:
 *                   type: string
 *                 analysis:
 *                   type: object
 *                   properties:
 *                     playingStyle:
 *                       type: string
 *                     bluffFrequency:
 *                       type: number
 *                     callFrequency:
 *                       type: number
 *                     raiseFrequency:
 *                       type: number
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 */
// 对手行为分析
router.get('/:gameId/analyze-opponent/:opponentId', authenticateToken, async (req, res) => {
  try {
    const { gameId, opponentId } = req.params;
    // TODO: 实现对手行为分析逻辑
    res.status(200).json({ 
      message: '对手行为分析成功', 
      opponentId,
      analysis: {
        playingStyle: 'aggressive',
        bluffFrequency: 0.3,
        callFrequency: 0.6,
        raiseFrequency: 0.4
      }
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || '对手行为分析失败' });
  }
});

/**
 * @swagger
 * /ai/{gameId}/set-mode:
 *   post:
 *     summary: 设置AI模式
 *     tags: [AI]
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
 *               mode:
 *                 type: string
 *                 description: AI模式
 *     responses:
 *       200:
 *         description: AI模式设置成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: 
 *                   type: string
 *                 gameId: 
 *                   type: string
 *                 mode: 
 *                   type: string
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 */
// 设置AI模式
router.post('/:gameId/set-mode', authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { style } = req.body;
    // TODO: 实现设置AI模式逻辑
    res.status(200).json({ 
      message: 'AI模式设置成功', 
      gameId,
      style
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'AI模式设置失败' });
  }
});

/**
 * @swagger
 * /ai/opponents:
 *   get:
 *     summary: 获取所有可用的AI对手
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取AI对手列表成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: 
 *                   type: boolean
 *                 opponents: 
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       level:
 *                         type: string
 *                       playingStyle:
 *                         type: string
 *                       bluffFrequency:
 *                         type: number
 *                       callFrequency:
 *                         type: number
 *                       raiseFrequency:
 *                         type: number
 *                       handRange:
 *                         type: array
 *                         items:
 *                           type: string
 *       401:
 *         description: 未授权
 */
// 获取AI对手列表
router.get('/opponents', authenticateToken, async (req, res) => {
  try {
    const opponents = aiService.getAvailableOpponents();
    res.status(200).json(opponents);
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取AI对手列表失败' });
  }
});

/**
 * @swagger
 * /ai/opponent/{opponentId}/hand:
 *   get:
 *     summary: 为AI对手生成手牌
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: opponentId
 *         schema:
 *           type: string
 *         required: true
 *         description: AI对手ID
 *     responses:
 *       200:
 *         description: 生成AI对手手牌成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: 
 *                   type: boolean
 *                 opponentId: 
 *                   type: string
 *                 hand: 
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       suit:
 *                         type: string
 *                       rank:
 *                         type: string
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 *       404:
 *         description: AI对手不存在
 */
// 为AI对手生成手牌
router.get('/opponent/:opponentId/hand', authenticateToken, async (req, res) => {
  try {
    const { opponentId } = req.params;
    const opponent = aiService.getOpponentById(opponentId);
    
    if (!opponent) {
      return res.status(404).json({ error: 'AI对手不存在' });
    }
    
    const hand = aiService.generateAIOpponentHand(opponent);
    res.status(200).json({ 
      success: true,
      opponentId,
      hand 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '生成AI对手手牌失败' });
  }
});

/**
 * @swagger
 * /ai/opponent/decision:
 *   post:
 *     summary: 获取AI对手的决策
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               opponentState:
 *                 type: object
 *                 properties:
 *                   opponentId:
 *                     type: string
 *                   hand:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         suit:
 *                           type: string
 *                         rank:
 *                           type: string
 *                   stackSize:
 *                     type: number
 *                   betHistory:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         action_type:
 *                           type: string
 *                         amount:
 *                           type: number
 *                   position:
 *                     type: number
 *                   folded:
 *                     type: boolean
 *               communityCards:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     suit:
 *                       type: string
 *                     rank:
 *                       type: string
 *               potSize:
 *                 type: number
 *               currentBet:
 *                 type: number
 *               minRaise:
 *                 type: number
 *     responses:
 *       200:
 *         description: 获取AI对手决策成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: 
 *                   type: boolean
 *                 decision: 
 *                   type: object
 *                   properties:
 *                     action:
 *                       type: string
 *                     amount:
 *                       type: number
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 */
// 获取AI对手决策
router.post('/opponent/decision', authenticateToken, async (req, res) => {
  try {
    const { opponentState, communityCards, potSize, currentBet, minRaise } = req.body;
    
    if (!opponentState || !communityCards || !potSize || !currentBet || !minRaise) {
      return res.status(400).json({ error: '请提供完整的请求参数' });
    }
    
    const opponent = aiService.getOpponentById(opponentState.opponentId);
    if (!opponent) {
      return res.status(404).json({ error: 'AI对手不存在' });
    }
    
    // 构建完整的AI对手状态
    const fullOpponentState = {
      opponent,
      hand: opponentState.hand,
      stackSize: opponentState.stackSize,
      betHistory: opponentState.betHistory,
      position: opponentState.position,
      folded: opponentState.folded
    };
    
    const decision = aiService.makeAIDecision(
      fullOpponentState,
      communityCards,
      potSize,
      currentBet,
      minRaise
    );
    
    res.status(200).json({
      opponentId: opponentState.opponentId,
      action: decision.action,
      amount: decision.amount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取AI对手决策失败' });
  }
});

export default router;
