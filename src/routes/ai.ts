import express from 'express';
import { AIAnalysis, AISuggestion } from '../types';
import { aiService } from '../services/aiService';

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

// AI分析牌局
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { sessionId, hand, communityCards, betHistory, potSize, currentBet, stackSize } = req.body;
    
    // 验证输入
    if (!hand || !Array.isArray(hand) || hand.length !== 2) {
      return res.status(400).json({ error: '请提供有效的手牌' });
    }
    
    // 调用AI服务分析牌局
    const analysis = aiService.analyzeHand(
      userId,
      sessionId,
      hand,
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

// 获取AI建议
router.post('/recommendations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { sessionId, style = 'gto', hand, communityCards, betHistory, potSize, currentBet, stackSize } = req.body;
    
    // 验证输入
    if (!hand || !Array.isArray(hand) || hand.length !== 2) {
      return res.status(400).json({ error: '请提供有效的手牌' });
    }
    
    if (!['gto', 'professional'].includes(style)) {
      return res.status(400).json({ error: '无效的AI风格，支持的风格：gto, professional' });
    }
    
    // 调用AI服务获取建议
    const suggestion = aiService.getSuggestion(
      userId,
      sessionId,
      style as 'gto' | 'professional',
      hand,
      communityCards || [],
      betHistory || [],
      potSize || 0,
      currentBet || 0,
      stackSize || 0
    );
    
    res.status(200).json({ message: '获取AI建议成功', suggestion });
  } catch (error: any) {
    res.status(400).json({ error: error.message || '获取AI建议失败' });
  }
});

// AI训练
router.post('/train', authenticateToken, async (req, res) => {
  try {
    const { trainingData } = req.body;
    
    // TODO: 实现AI训练逻辑
    res.status(200).json({ message: 'AI训练成功', trainingData });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'AI训练失败' });
  }
});

// 获取牌力评估
router.post('/hand_strength', authenticateToken, async (req, res) => {
  try {
    const { hand, communityCards } = req.body;
    
    // 验证输入
    if (!hand || !Array.isArray(hand) || hand.length !== 2) {
      return res.status(400).json({ error: '请提供有效的手牌' });
    }
    
    // 调用AI服务计算牌力
    const handStrength = aiService['calculateHandStrength'](hand, communityCards || []);
    
    res.status(200).json({ 
      message: '牌力评估成功', 
      handStrength, // 牌力值(0-1)
      description: `牌力评估值为 ${(handStrength * 100).toFixed(2)}%`
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || '牌力评估失败' });
  }
});

// 获取赔率计算
router.post('/odds', authenticateToken, async (req, res) => {
  try {
    const { hand, communityCards, remainingPlayers, potSize, currentBet, expectedFutureBets } = req.body;
    
    // 验证输入
    if (!hand || !Array.isArray(hand) || hand.length !== 2) {
      return res.status(400).json({ error: '请提供有效的手牌' });
    }
    
    // 计算底池赔率
    const potOdds = aiService['calculatePotOdds'](potSize || 0, currentBet || 0);
    
    // 计算隐含赔率
    const impliedOdds = aiService['calculateImpliedOdds'](potSize || 0, currentBet || 0, expectedFutureBets || 0);
    
    // 计算牌力（作为胜率的简化表示）
    const handStrength = aiService['calculateHandStrength'](hand, communityCards || []);
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

export default router;
