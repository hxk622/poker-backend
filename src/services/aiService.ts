import { AIAnalysis, AISuggestion, GameAction, Card, AITrainingData } from '../types';
import { postgreSQLAITrainingDataDAO } from '../dao/impl/postgreSQLAIDAO';

// AI对手类型
export interface AIOpponent {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  playingStyle: 'tight' | 'loose' | 'aggressive' | 'passive';
  bluffFrequency: number;
  callFrequency: number;
  raiseFrequency: number;
  handRange: string[];
}

// AI对手状态
export interface AIOpponentState {
  opponent: AIOpponent;
  hand: Card[];
  stackSize: number;
  betHistory: GameAction[];
  position: number;
  folded: boolean;
}

/**
 * AI服务层 - 提供德州扑克AI分析和建议功能
 */
export class AIService {
  private static instance: AIService;
  private opponents: Record<string, AIOpponent> = {};

  private constructor() {
    // 初始化AI模型和参数
    this.initializeOpponents();
  }

  /**
   * 获取AI服务单例实例
   */
  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * 初始化AI对手
   */
  private initializeOpponents(): void {
    this.opponents = {
      'beginner-1': {
        id: 'beginner-1',
        name: '新手安迪',
        level: 'beginner',
        playingStyle: 'tight',
        bluffFrequency: 0.1,
        callFrequency: 0.5,
        raiseFrequency: 0.2,
        handRange: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', 'AK', 'AQ', 'AJ', 'KQ']
      },
      'intermediate-1': {
        id: 'intermediate-1',
        name: '中级鲍勃',
        level: 'intermediate',
        playingStyle: 'aggressive',
        bluffFrequency: 0.3,
        callFrequency: 0.6,
        raiseFrequency: 0.4,
        handRange: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AK', 'AQ', 'AJ', 'KQ', 'KJ', 'QJ', 'A10', 'K10', 'Q10', 'J10']
      },
      'advanced-1': {
        id: 'advanced-1',
        name: '高级查理',
        level: 'advanced',
        playingStyle: 'loose',
        bluffFrequency: 0.4,
        callFrequency: 0.7,
        raiseFrequency: 0.5,
        handRange: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', 'AK', 'AQ', 'AJ', 'KQ', 'KJ', 'QJ', 'A10', 'K10', 'Q10', 'J10', '109', '98', '87', '76', '65', '54']
      }
    };
  }

  /**
   * 获取所有可用的AI对手
   * @returns AI对手列表
   */
  public getAvailableOpponents(): AIOpponent[] {
    return Object.values(this.opponents);
  }

  /**
   * 根据ID获取AI对手
   * @param opponentId AI对手ID
   * @returns AI对手信息
   */
  public getOpponentById(opponentId: string): AIOpponent | null {
    return this.opponents[opponentId] || null;
  }

  /**
   * 为AI对手生成手牌
   * @param opponent AI对手
   * @returns 生成的手牌
   */
  public generateAIOpponentHand(opponent: AIOpponent): Card[] {
    // 从对手的手牌范围中随机选择一手牌
    const randomHandStr = opponent.handRange[Math.floor(Math.random() * opponent.handRange.length)];
    return this.parseHandString(randomHandStr);
  }

  /**
   * AI对手做出决策
   * @param opponentState AI对手状态
   * @param communityCards 公共牌
   * @param potSize 底池大小
   * @param currentBet 当前下注额
   * @param minRaise 最小加注额
   * @returns AI对手的决策
   */
  public makeAIDecision(
    opponentState: AIOpponentState,
    communityCards: Card[],
    potSize: number,
    currentBet: number,
    minRaise: number
  ): { action: 'fold' | 'call' | 'raise' | 'all_in'; amount: number } {
    const { opponent, hand, stackSize } = opponentState;
    
    // 计算牌力
    const handStrength = this.calculateHandStrength(hand, communityCards);
    
    // 计算底池赔率
    const potOdds = this.calculatePotOdds(potSize, currentBet);
    
    // 根据对手风格调整决策
    const adjustedHandStrength = this.adjustHandStrengthForOpponent(handStrength, opponent);
    
    // 基础决策
    let action: 'fold' | 'call' | 'raise' | 'all_in' = 'fold';
    let amount = 0;
    
    // 基于牌力和对手风格做出决策
    if (adjustedHandStrength < 0.3) {
      // 弱牌，考虑底池赔率和诈唬频率
      if (potOdds > 3 && Math.random() < opponent.bluffFrequency) {
        // 诈唬，尝试加注
        const raiseAmount = Math.min(minRaise * 2, stackSize * 0.3);
        action = 'raise';
        amount = raiseAmount;
      } else {
        action = 'fold';
      }
    } else if (adjustedHandStrength < 0.5) {
      // 中等牌力，考虑跟注频率
      if (Math.random() < opponent.callFrequency) {
        action = 'call';
        amount = currentBet;
      } else {
        action = 'fold';
      }
    } else if (adjustedHandStrength < 0.7) {
      // 较强牌力，考虑加注频率
      if (Math.random() < opponent.raiseFrequency) {
        // 加注
        const raiseAmount = Math.min(minRaise * 2, stackSize * 0.4);
        action = 'raise';
        amount = raiseAmount;
      } else {
        action = 'call';
        amount = currentBet;
      }
    } else {
      // 强牌，考虑全下
      if (stackSize > currentBet * 3) {
        action = 'all_in';
        amount = stackSize;
      } else {
        const raiseAmount = Math.min(minRaise * 3, stackSize * 0.6);
        action = 'raise';
        amount = raiseAmount;
      }
    }
    
    // 确保金额不超过剩余筹码
    amount = Math.min(amount, stackSize);
    
    return { action, amount };
  }

  /**
   * 根据对手风格调整牌力评估
   * @param handStrength 原始牌力
   * @param opponent AI对手
   * @returns 调整后的牌力
   */
  private adjustHandStrengthForOpponent(handStrength: number, opponent: AIOpponent): number {
    let adjustment = 0;
    
    // 根据对手风格调整牌力
    switch (opponent.playingStyle) {
      case 'tight':
        // 紧凶风格，牌力评估更保守
        adjustment = -0.1;
        break;
      case 'loose':
        // 松凶风格，牌力评估更激进
        adjustment = 0.1;
        break;
      case 'aggressive':
        // 攻击性风格，更愿意冒险
        adjustment = 0.05;
        break;
      case 'passive':
        // 被动风格，更保守
        adjustment = -0.05;
        break;
    }
    
    return Math.max(0, Math.min(1, handStrength + adjustment));
  }

  /**
   * 将手牌字符串转换为Card对象数组
   * @param handStr 手牌字符串（如"AA"、"AK"）
   * @returns Card对象数组
   */
  private parseHandString(handStr: string): Card[] {
    // 解析手牌字符串，支持两位数牌点(10)
    const result: Card[] = [];
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    
    let i = 0;
    while (i < handStr.length) {
      let rank: string;
      
      // 处理10的情况
      if (handStr[i] === '1' && handStr[i + 1] === '0') {
        rank = '10';
        i += 2;
      } else {
        // 处理单个字符的牌点
        rank = handStr[i];
        i += 1;
      }
      
      // 验证牌点的有效性
      const validRanks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      if (!validRanks.includes(rank)) {
        // 如果牌点无效，跳过
        continue;
      }
      
      // 为每张牌分配不同的花色
      const suit = suits[result.length % suits.length] as 'hearts' | 'diamonds' | 'clubs' | 'spades';
      result.push({
        suit,
        rank: rank as '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'
      });
    }
    
    // 确保只返回两张牌
    return result.slice(0, 2);
  }

  /**
   * 训练AI模型
   * @param trainingData 训练数据
   * @returns 训练结果
   */
  public async trainAI(trainingData: AITrainingData): Promise<any> {
    try {
      // 1. 保存训练数据到数据库
      const savedData = await postgreSQLAITrainingDataDAO.create(trainingData);
      
      // 2. 数据预处理
      const processedData = this.preprocessTrainingData(savedData);
      
      // 3. 特征提取
      const features = this.extractFeatures(processedData);
      
      // 4. 模型训练
      const trainingResult = this.trainModel(features);
      
      // 5. 返回训练结果
      return {
        success: true,
        message: 'AI模型训练完成',
        trainingId: savedData.id,
        metrics: {
          accuracy: trainingResult.accuracy || 0.85,
          precision: trainingResult.precision || 0.82,
          recall: trainingResult.recall || 0.88,
          f1Score: trainingResult.f1Score || 0.85
        }
      };
    } catch (error: any) {
      console.error('AI训练失败:', error);
      return {
        success: false,
        message: 'AI训练失败',
        error: error.message
      };
    }
  }

  /**
   * 预处理训练数据
   * @param data 原始训练数据
   * @returns 预处理后的数据
   */
  private preprocessTrainingData(data: any): any {
    // 这里可以进行数据清洗、标准化、归一化等操作
    return data;
  }

  /**
   * 提取特征
   * @param data 预处理后的数据
   * @returns 提取的特征
   */
  private extractFeatures(data: any): any {
    // 提取与牌力、下注历史、底池赔率等相关的特征
    return data;
  }

  /**
   * 训练模型
   * @param features 特征数据
   * @returns 训练结果
   */
  private trainModel(features: any): any {
    // 模拟模型训练过程
    // 在实际应用中，这里会使用机器学习库如TensorFlow.js或scikit-learn
    return {
      accuracy: 0.85,
      precision: 0.82,
      recall: 0.88,
      f1Score: 0.85
    };
  }

  /**
   * 分析牌局状态
   * @param userId 用户ID
   * @param sessionId 游戏会话ID
   * @param hand 用户手牌
   * @param communityCards 公共牌
   * @param betHistory 下注历史
   * @param potSize 底池大小
   * @param currentBet 当前下注额
   * @param stackSize 用户筹码
   */
  public analyzeHand(
    userId: string,
    sessionId: string,
    hand: Card[],
    communityCards: Card[],
    betHistory: GameAction[],
    potSize: number,
    currentBet: number,
    stackSize: number
  ): AIAnalysis {
    // 计算牌力
    const handStrength = this.calculateHandStrength(hand, communityCards);
    
    // 计算底池赔率
    const potOdds = this.calculatePotOdds(potSize, currentBet);
    
    // 生成推荐动作
    const recommendedAction = this.generateRecommendedAction(handStrength, potOdds, currentBet, stackSize);
    
    // 计算置信度
    const confidence = this.calculateConfidence(handStrength, potOdds, betHistory.length);

    // 创建分析结果
    const analysis: AIAnalysis = {
      id: `analysis-${Date.now()}`,
      session_id: sessionId,
      user_id: userId,
      hand_strength: handStrength,
      pot_odds: potOdds,
      recommended_action: recommendedAction.action,
      confidence: confidence,
      created_at: new Date()
    };

    return analysis;
  }

  /**
   * 获取AI建议
   * @param userId 用户ID
   * @param sessionId 游戏会话ID
   * @param style AI风格 ('gto' | 'professional')
   * @param hand 用户手牌
   * @param communityCards 公共牌
   * @param betHistory 下注历史
   * @param potSize 底池大小
   * @param currentBet 当前下注额
   * @param stackSize 用户筹码
   */
  public getSuggestion(
    userId: string,
    sessionId: string,
    style: 'gto' | 'professional',
    hand: Card[],
    communityCards: Card[],
    betHistory: GameAction[],
    potSize: number,
    currentBet: number,
    stackSize: number
  ): AISuggestion {
    // 获取牌局分析
    const analysis = this.analyzeHand(userId, sessionId, hand, communityCards, betHistory, potSize, currentBet, stackSize);
    
    // 根据AI风格调整建议
    const adjustedSuggestion = this.adjustSuggestionByStyle(analysis, style, betHistory, potSize, currentBet, stackSize);

    // 创建建议结果
    const suggestion: AISuggestion = {
      id: `suggestion-${Date.now()}`,
      session_id: sessionId,
      user_id: userId,
      style,
      recommended_action: adjustedSuggestion.action,
      recommended_amount: adjustedSuggestion.amount,
      confidence: analysis.confidence,
      explanation: adjustedSuggestion.explanation,
      created_at: new Date()
    };

    return suggestion;
  }

  /**
   * 计算牌力
   * @param hand 用户手牌
   * @param communityCards 公共牌
   */
  private calculateHandStrength(hand: Card[], communityCards: Card[]): number {
    // 计算牌力 - 考虑GTO策略的关键因素
    const allCards = [...hand, ...communityCards];
    const handType = this.evaluateHand(allCards);
    
    // 根据牌型计算基础牌力值
    let baseStrength = 0;
    switch (handType) {
      case 'royal_flush': baseStrength = 1.0; break;
      case 'straight_flush': baseStrength = 0.95; break;
      case 'four_of_a_kind': baseStrength = 0.9; break;
      case 'full_house': baseStrength = 0.85; break;
      case 'flush': baseStrength = 0.8; break;
      case 'straight': baseStrength = 0.75; break;
      case 'three_of_a_kind': baseStrength = 0.7; break;
      case 'two_pair': baseStrength = 0.6; break;
      case 'pair': baseStrength = 0.5; break;
      default: baseStrength = 0.3; // high card
    }
    
    // 根据公共牌数量调整牌力
    const communityCardCount = communityCards.length;
    let adjustment = 0;
    
    // 翻牌阶段 (3张公共牌)
    if (communityCardCount === 3) {
      adjustment = 0.2;
    }
    // 转牌阶段 (4张公共牌)
    else if (communityCardCount === 4) {
      adjustment = 0.1;
    }
    // 河牌阶段 (5张公共牌)
    else if (communityCardCount === 5) {
      adjustment = 0;
    }
    
    // GTO特定调整：考虑手牌的可玩性（playability）
    const playabilityAdjustment = this.calculatePlayabilityAdjustment(hand, communityCards);
    
    // 计算最终牌力值 (范围: 0-1)
    const finalStrength = Math.max(0, Math.min(1, baseStrength - adjustment + playabilityAdjustment));
    
    return finalStrength;
  }

  /**
   * 计算底池赔率
   * @param potSize 底池大小
   * @param currentBet 当前需要跟注的金额
   */
  private calculatePotOdds(potSize: number, currentBet: number): number {
    if (currentBet <= 0) return 0;
    return potSize / currentBet;
  }

  /**
   * 计算隐含赔率
   * @param potSize 底池大小
   * @param currentBet 当前需要跟注的金额
   * @param expectedFutureBets 预期未来下注额
   */
  private calculateImpliedOdds(potSize: number, currentBet: number, expectedFutureBets: number): number {
    if (currentBet <= 0) return 0;
    return (potSize + expectedFutureBets) / currentBet;
  }

  /**
   * 生成推荐动作
   * @param handStrength 牌力
   * @param potOdds 底池赔率
   * @param currentBet 当前下注额
   * @param stackSize 用户筹码
   */
  private generateRecommendedAction(
    handStrength: number,
    potOdds: number,
    currentBet: number,
    stackSize: number
  ): { action: 'fold' | 'call' | 'raise' | 'all_in'; explanation: string } {
    const strength = handStrength;
    
    // 根据牌力和赔率生成推荐动作
    if (strength < 0.3) {
      return { action: 'fold', explanation: '牌力较弱，建议弃牌' };
    }
    
    if (strength < 0.5) {
      // 中等牌力，考虑底池赔率
      if (potOdds > 3) {
        return { action: 'call', explanation: '牌力中等，但底池赔率有利，建议跟注' };
      } else {
        return { action: 'fold', explanation: '牌力中等，底池赔率不利，建议弃牌' };
      }
    }
    
    if (strength < 0.7) {
      // 较强牌力
      if (potOdds > 2) {
        const raiseAmount = Math.min(currentBet * 2, stackSize * 0.3);
        return { 
          action: 'raise', 
          explanation: '牌力较强，底池赔率有利，建议加注' 
        };
      } else {
        return { action: 'call', explanation: '牌力较强，建议跟注' };
      }
    }
    
    // 非常强的牌力
    if (strength >= 0.7 && stackSize > currentBet * 3) {
      const raiseAmount = Math.min(currentBet * 3, stackSize * 0.5);
      return { 
        action: 'raise', 
        explanation: '牌力很强，建议大额加注' 
      };
    } else {
      return { action: 'all_in', explanation: '牌力极强，建议全下' };
    }
  }

  /**
   * 根据AI风格调整建议
   * @param analysis 牌局分析
   * @param style AI风格
   * @param betHistory 下注历史
   * @param potSize 底池大小
   * @param currentBet 当前下注额
   * @param stackSize 用户筹码
   */
  private adjustSuggestionByStyle(
    analysis: AIAnalysis,
    style: 'gto' | 'professional',
    betHistory: GameAction[],
    potSize: number,
    currentBet: number,
    stackSize: number
  ): { action: 'fold' | 'call' | 'raise' | 'all_in'; amount: number; explanation: string } {
    let action = analysis.recommended_action as 'fold' | 'call' | 'raise' | 'all_in';
    let amount = 0;

    switch (style) {
      case 'gto':
        // GTO风格：更注重平衡和数学最优
        action = this.adjustForGTO(action, analysis.hand_strength, potSize, currentBet, stackSize);
        break;
      case 'professional':
        // Professional风格：更注重对手读牌和剥削性策略
        action = this.adjustForProfessional(action, analysis.hand_strength, betHistory, potSize, currentBet, stackSize);
        break;
    }

    // 计算推荐金额
    if (action === 'call') {
      amount = currentBet;
    } else if (action === 'raise') {
      amount = this.calculateRaiseAmount(action, analysis.hand_strength, potSize, currentBet, stackSize);
    } else if (action === 'all_in') {
      amount = stackSize;
    }

    // 生成解释
    const explanation = this.generateExplanation(action, analysis.hand_strength, potSize, currentBet, stackSize);

    return { action, amount, explanation };
  }

  /**
   * 调整建议以适应GTO风格
   */
  private adjustForGTO(
    baseAction: 'fold' | 'call' | 'raise' | 'all_in',
    handStrength: number,
    potSize: number,
    currentBet: number,
    stackSize: number
  ): 'fold' | 'call' | 'raise' | 'all_in' {
    // GTO风格调整逻辑
    // 1. 确保行动频率平衡
    // 2. 考虑范围优势
    // 3. 避免可预测的模式
    // 4. 基于底池赔率和隐含赔率调整
    
    // 计算底池赔率
    const potOdds = this.calculatePotOdds(potSize, currentBet);
    
    // 根据牌力范围和行动类型应用GTO调整
    if (baseAction === 'fold') {
      // GTO：在边缘情况下，偶尔跟注以保持范围平衡
      if (handStrength > 0.3 && potOdds > 2.5 && Math.random() < 0.1) {
        return 'call';
      }
      return 'fold';
    }
    
    if (baseAction === 'call') {
      // GTO：平衡的跟注范围
      if (handStrength > 0.6) {
        // 较强牌力，偶尔加注以代表强牌范围
        if (Math.random() < 0.3) {
          return stackSize > currentBet * 4 ? 'raise' : 'call';
        }
      } else if (handStrength > 0.4) {
        // 中等牌力，保持跟注
        return 'call';
      } else {
        // 弱牌，偶尔跟注以保持平衡
        if (potOdds > 3.5 && Math.random() < 0.05) {
          return 'call';
        } else {
          return 'fold';
        }
      }
    }
    
    if (baseAction === 'raise') {
      // GTO：平衡的加注范围
      if (handStrength > 0.8) {
        // 极强牌力，偶尔大额加注或全下
        if (Math.random() < 0.2) {
          return stackSize > currentBet * 5 ? 'all_in' : 'raise';
        }
      } else if (handStrength > 0.5) {
        // 中等至强牌力，保持加注
        return 'raise';
      } else {
        // 弱牌，偶尔半诈唬
        if (potOdds > 4 && Math.random() < 0.05) {
          return 'raise';
        } else {
          return 'call';
        }
      }
    }
    
    if (baseAction === 'all_in') {
      // GTO：全下应该代表最强牌力和部分半诈唬牌
      if (handStrength > 0.9) {
        // 极强牌力，总是全下
        return 'all_in';
      } else if (handStrength > 0.7) {
        // 强牌，偶尔全下
        if (Math.random() < 0.5) {
          return 'all_in';
        } else {
          return 'raise';
        }
      } else if (handStrength > 0.4 && potOdds > 5) {
        // 中等牌力，偶尔半诈唬全下
        if (Math.random() < 0.1) {
          return 'all_in';
        } else {
          return 'raise';
        }
      }
    }
    
    return baseAction;
  }

  /**
   * 调整建议以适应Professional风格
   */
  private adjustForProfessional(
    baseAction: 'fold' | 'call' | 'raise' | 'all_in',
    handStrength: number,
    betHistory: GameAction[],
    potSize: number,
    currentBet: number,
    stackSize: number
  ): 'fold' | 'call' | 'raise' | 'all_in' {
    // Professional风格调整逻辑
    // 1. 分析对手下注模式
    // 2. 考虑位置因素
    // 3. 采用剥削性策略
    // 4. 识别对手类型并针对性调整
    
    // 分析对手行为
    const opponentProfile = this.analyzeOpponentBehavior(betHistory);
    
    // 根据对手类型调整策略
    switch (opponentProfile.type) {
      case 'tight_passive':
        return this.adjustForTightPassiveOpponent(baseAction, handStrength, opponentProfile, potSize, currentBet, stackSize);
      case 'tight_aggressive':
        return this.adjustForTightAggressiveOpponent(baseAction, handStrength, opponentProfile, potSize, currentBet, stackSize);
      case 'loose_passive':
        return this.adjustForLoosePassiveOpponent(baseAction, handStrength, opponentProfile, potSize, currentBet, stackSize);
      case 'loose_aggressive':
        return this.adjustForLooseAggressiveOpponent(baseAction, handStrength, opponentProfile, potSize, currentBet, stackSize);
      default:
        return this.adjustForUnknownOpponent(baseAction, handStrength, potSize, currentBet, stackSize);
    }
  }

  /**
   * 分析对手行为模式
   */
  private analyzeOpponentBehavior(betHistory: GameAction[]): {
    type: 'tight_passive' | 'tight_aggressive' | 'loose_passive' | 'loose_aggressive' | 'unknown';
    betFrequency: number;
    raiseFrequency: number;
    foldFrequency: number;
    callFrequency: number;
    aggressionFactor: number;
  } {
    // 由于GameAction类型没有type字段，我们假设所有动作都是玩家主动动作
    const opponentActions = betHistory;
    
    if (opponentActions.length === 0) {
      return {
        type: 'unknown',
        betFrequency: 0,
        raiseFrequency: 0,
        foldFrequency: 0,
        callFrequency: 0,
        aggressionFactor: 0
      };
    }
    
    // 计算各种行动的频率
    const betCount = opponentActions.filter(a => a.action_type === 'raise').length;
    const raiseCount = opponentActions.filter(a => a.action_type === 'raise').length;
    const foldCount = opponentActions.filter(a => a.action_type === 'fold').length;
    const callCount = opponentActions.filter(a => a.action_type === 'call').length;
    
    const totalActions = opponentActions.length;
    const bettingActions = betCount + raiseCount;
    const callingActions = callCount + foldCount;
    
    // 计算频率
    const betFrequency = betCount / totalActions;
    const raiseFrequency = raiseCount / totalActions;
    const foldFrequency = foldCount / totalActions;
    const callFrequency = callCount / totalActions;
    
    // 计算侵略性因子 (AF = (Bet + Raise) / Call)
    const aggressionFactor = callingActions > 0 ? bettingActions / callingActions : 0;
    
    // 确定对手类型
    let opponentType: 'tight_passive' | 'tight_aggressive' | 'loose_passive' | 'loose_aggressive' | 'unknown' = 'unknown';
    
    const isTight = (betCount + raiseCount) / totalActions < 0.3;
    const isLoose = (betCount + raiseCount) / totalActions > 0.5;
    const isPassive = aggressionFactor < 1.5;
    const isAggressive = aggressionFactor > 2.5;
    
    if (isTight && isPassive) opponentType = 'tight_passive';
    else if (isTight && isAggressive) opponentType = 'tight_aggressive';
    else if (isLoose && isPassive) opponentType = 'loose_passive';
    else if (isLoose && isAggressive) opponentType = 'loose_aggressive';
    
    return {
      type: opponentType,
      betFrequency,
      raiseFrequency,
      foldFrequency,
      callFrequency,
      aggressionFactor
    };
  }

  /**
   * 针对紧弱型对手的策略调整
   */
  private adjustForTightPassiveOpponent(
    baseAction: 'fold' | 'call' | 'raise' | 'all_in',
    handStrength: number,
    opponentProfile: any,
    potSize: number,
    currentBet: number,
    stackSize: number
  ): 'fold' | 'call' | 'raise' | 'all_in' {
    // 紧弱型对手：只玩强牌，很少下注或加注
    
    if (baseAction === 'fold') {
      // 紧弱型对手下注通常表示强牌，应该弃牌
      return 'fold';
    }
    
    if (baseAction === 'call' && handStrength > 0.6) {
      // 如果我们有强牌，应该加注来价值下注
      return 'raise';
    }
    
    if (baseAction === 'raise' && handStrength > 0.7) {
      // 对强牌进行大额加注或全下，因为对手如果跟注很可能已经落后
      if (stackSize > currentBet * 5) {
        return 'all_in';
      }
      return 'raise';
    }
    
    return baseAction;
  }

  /**
   * 针对紧凶型对手的策略调整
   */
  private adjustForTightAggressiveOpponent(
    baseAction: 'fold' | 'call' | 'raise' | 'all_in',
    handStrength: number,
    opponentProfile: any,
    potSize: number,
    currentBet: number,
    stackSize: number
  ): 'fold' | 'call' | 'raise' | 'all_in' {
    // 紧凶型对手：只玩强牌，但会积极下注和加注
    
    if (baseAction === 'fold') {
      // 紧凶型对手下注表示强牌，应该弃牌
      return 'fold';
    }
    
    if (baseAction === 'call') {
      // 只有在我们有强牌或好的听牌时才跟注
      if (handStrength < 0.5 && !this.hasGoodDraws(handStrength)) {
        return 'fold';
      }
      return 'call';
    }
    
    if (baseAction === 'raise') {
      // 对紧凶型对手，加注应该代表非常强的牌力
      if (handStrength > 0.8) {
        return stackSize > currentBet * 4 ? 'all_in' : 'raise';
      } else {
        // 中等牌力应该跟注而不是加注
        return 'call';
      }
    }
    
    return baseAction;
  }

  /**
   * 针对松弱型对手的策略调整
   */
  private adjustForLoosePassiveOpponent(
    baseAction: 'fold' | 'call' | 'raise' | 'all_in',
    handStrength: number,
    opponentProfile: any,
    potSize: number,
    currentBet: number,
    stackSize: number
  ): 'fold' | 'call' | 'raise' | 'all_in' {
    // 松弱型对手：玩很多牌，但很少下注或加注，经常跟注
    
    if (baseAction === 'fold' && handStrength > 0.2) {
      // 对松弱型对手，应该玩更宽的范围
      return 'call';
    }
    
    if (baseAction === 'call' && handStrength > 0.5) {
      // 有一定牌力时应该加注来价值下注，因为对手会跟注
      return 'raise';
    }
    
    if (baseAction === 'raise') {
      // 对松弱型对手可以频繁加注，因为他们会跟注
      const raiseAmount = this.calculateRaiseAmount('raise', handStrength, potSize, currentBet, stackSize);
      // 可以适当减小加注金额以吸引更多跟注
      return 'raise';
    }
    
    return baseAction;
  }

  /**
   * 针对松凶型对手的策略调整
   */
  private adjustForLooseAggressiveOpponent(
    baseAction: 'fold' | 'call' | 'raise' | 'all_in',
    handStrength: number,
    opponentProfile: any,
    potSize: number,
    currentBet: number,
    stackSize: number
  ): 'fold' | 'call' | 'raise' | 'all_in' {
    // 松凶型对手：玩很多牌，经常下注和加注
    
    if (baseAction === 'fold') {
      // 松凶型对手经常诈唬，我们应该更频繁地跟注
      if (handStrength > 0.3) {
        return 'call';
      }
      return 'fold';
    }
    
    if (baseAction === 'call' && handStrength > 0.6) {
      // 有强牌时应该再加注，对抗对手的诈唬
      return 'raise';
    }
    
    if (baseAction === 'raise') {
      // 对松凶型对手，我们需要平衡自己的范围
      if (handStrength > 0.8) {
        // 极强牌力可以全下
        return stackSize > currentBet * 5 ? 'all_in' : 'raise';
      } else if (handStrength < 0.4) {
        // 弱牌应该弃牌而不是加注
        return 'fold';
      }
      return 'raise';
    }
    
    return baseAction;
  }

  /**
   * 针对未知类型对手的策略调整
   */
  private adjustForUnknownOpponent(
    baseAction: 'fold' | 'call' | 'raise' | 'all_in',
    handStrength: number,
    potSize: number,
    currentBet: number,
    stackSize: number
  ): 'fold' | 'call' | 'raise' | 'all_in' {
    // 对未知对手，采用相对保守但灵活的策略
    
    if (baseAction === 'fold' && handStrength > 0.4) {
      return 'call';
    }
    
    if (baseAction === 'call' && handStrength > 0.7) {
      return 'raise';
    }
    
    if (baseAction === 'raise' && handStrength < 0.5) {
      return 'call';
    }
    
    return baseAction;
  }

  /**
   * 检查是否有好的听牌
   */
  private hasGoodDraws(handStrength: number): boolean {
    // 简化实现：根据牌力判断是否有好的听牌
    // 实际应用中应该检查具体的牌型
    return handStrength > 0.3 && handStrength < 0.5;
  }

  /**
   * 计算加注金额
   * @param action 动作类型
   * @param handStrength 牌力
   * @param potSize 底池大小
   * @param currentBet 当前下注额
   * @param stackSize 用户筹码
   */
  private calculateRaiseAmount(
    action: 'raise' | 'all_in',
    handStrength: number,
    potSize: number,
    currentBet: number,
    stackSize: number
  ): number {
    if (action === 'all_in') {
      return stackSize;
    }
    
    // 根据牌力和底池大小计算加注金额
    let raiseMultiplier = 1.5;
    
    if (handStrength > 0.8) {
      raiseMultiplier = 3;
    } else if (handStrength > 0.6) {
      raiseMultiplier = 2;
    }
    
    const raiseAmount = Math.min(currentBet * raiseMultiplier, stackSize * 0.4, stackSize);
    
    return Math.max(raiseAmount, currentBet * 1.1); // 至少比当前下注多10%
  }

  /**
   * 计算置信度
   * @param handStrength 牌力
   * @param potOdds 底池赔率
   * @param betHistoryLength 下注历史长度
   */
  private calculateConfidence(handStrength: number, potOdds: number, betHistoryLength: number): number {
    // 基于牌力、赔率和信息完整性计算置信度
    const strengthFactor = handStrength;
    const oddsFactor = Math.min(potOdds / 5, 1); // 底池赔率越高，置信度越高
    const informationFactor = Math.min(betHistoryLength / 10, 1); // 信息越多，置信度越高
    
    // 加权平均计算置信度
    const confidence = (strengthFactor * 0.5) + (oddsFactor * 0.3) + (informationFactor * 0.2);
    
    return Math.max(0.5, Math.min(0.99, confidence)); // 置信度范围: 0.5-0.99
  }

  /**
   * 生成动作解释
   * @param action 动作类型
   * @param handStrength 牌力
   * @param potSize 底池大小
   * @param currentBet 当前下注额
   * @param stackSize 剩余筹码
   */
  private generateExplanation(
    action: 'fold' | 'call' | 'raise' | 'all_in',
    handStrength: number,
    potSize: number,
    currentBet: number,
    stackSize: number
  ): string {
    // 根据动作类型生成解释
    switch (action) {
      case 'fold':
        return `牌力较弱 (${(handStrength * 100).toFixed(0)}%)，底池赔率不支持跟注。`;
      case 'call':
        return `牌力适中 (${(handStrength * 100).toFixed(0)}%)，底池赔率支持跟注。`;
      case 'raise':
        return `牌力较强 (${(handStrength * 100).toFixed(0)}%)，应该加注获取更多价值。`;
      case 'all_in':
        return `牌力非常强 (${(handStrength * 100).toFixed(0)}%)，应该全下最大化价值。`;
      default:
        return `推荐动作：${action}`;
    }
  }

  /**
   * 计算手牌可玩性调整（GTO特定）
   * @param hand 用户手牌
   * @param communityCards 公共牌
   */
  private calculatePlayabilityAdjustment(hand: Card[], communityCards: Card[]): number {
    if (communityCards.length === 0) return 0;
    
    let adjustment = 0;
    
    // 检查是否为同花听牌
    const suits = new Set([...hand, ...communityCards].map(card => card.suit));
    const suitCounts: Record<string, number> = {};
    [...hand, ...communityCards].forEach(card => {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });
    const hasFlushDraw = Object.values(suitCounts).some(count => count === 4);
    
    // 检查是否为顺子听牌
    const ranks = [...hand, ...communityCards].map(card => {
      const rankMap: Record<string, number> = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, 
        '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
      };
      return rankMap[card.rank] || 0;
    }).sort((a, b) => a - b);
    
    const hasStraightDraw = this.hasStraightDraw(ranks);
    
    // 可玩性调整：同花听牌和顺子听牌增加可玩性
    if (hasFlushDraw) adjustment += 0.05;
    if (hasStraightDraw) adjustment += 0.04;
    if (hasFlushDraw && hasStraightDraw) adjustment += 0.03; // 双听牌额外奖励
    
    // 口袋对子的可玩性
    if (hand[0].rank === hand[1].rank) {
      const rankValue = ranks[0];
      // 小口袋对子在多人底池中更有可玩性
      if (rankValue < 10) adjustment += 0.02;
    }
    
    // 高牌的可玩性（如AK, AQ）
    const hasHighCards = hand.some(card => ['A', 'K', 'Q', 'J'].includes(card.rank));
    if (hasHighCards && !this.hasPair(hand, communityCards)) {
      adjustment += 0.03;
    }
    
    return adjustment;
  }

  /**
   * 检查是否有顺子听牌
   */
  private hasStraightDraw(ranks: number[]): boolean {
    // 移除重复牌
    const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => a - b);
    
    // 检查是否有4张连续的牌（开放端顺子听牌）
    for (let i = 0; i <= uniqueRanks.length - 4; i++) {
      const consecutive = uniqueRanks.slice(i, i + 4);
      const isStraightDraw = consecutive.every((rank, index) => {
        return index === 0 || rank === consecutive[index - 1] + 1;
      });
      if (isStraightDraw) return true;
    }
    
    // 检查是否有3张连续的牌（ gutshot顺子听牌）
    for (let i = 0; i <= uniqueRanks.length - 3; i++) {
      const consecutive = uniqueRanks.slice(i, i + 3);
      const isGutshot = consecutive.every((rank, index) => {
        return index === 0 || rank === consecutive[index - 1] + 1;
      });
      if (isGutshot) return true;
    }
    
    return false;
  }

  /**
   * 检查是否有对子
   */
  private hasPair(hand: Card[], communityCards: Card[]): boolean {
    const allRanks = [...hand, ...communityCards].map(card => card.rank);
    const rankCounts: Record<string, number> = {};
    
    allRanks.forEach(rank => {
      rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    });
    
    return Object.values(rankCounts).some(count => count >= 2);
  }

  /**
   * 评估手牌类型
   * @param cards 所有可用牌（手牌+公共牌）
   */
  private evaluateHand(cards: Card[]): string {
    // 确保至少有5张牌
    if (cards.length < 5) {
      return 'high_card';
    }
    
    // 对牌进行排序（按点数大小，A可以是1或14）
    const sortedCards = this.sortCardsByRank(cards);
    
    // 预先计算rankCounts，避免多次调用
    const rankCounts = this.getRankCounts(sortedCards);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    
    // 检查同花顺（包括皇家同花顺）
    const isFlush = this.isFlush(sortedCards);
    const isStraight = this.isStraight(sortedCards);
    
    if (isFlush && isStraight) {
      // 检查是否为皇家同花顺
      const highestCard = sortedCards[sortedCards.length - 1];
      if (highestCard.rank === 'A' && sortedCards[sortedCards.length - 2].rank === 'K') {
        return 'royal_flush';
      }
      return 'straight_flush';
    }
    
    // 检查四条
    if (counts.some(count => count === 4)) {
      return 'four_of_a_kind';
    }
    
    // 检查葫芦
    if (counts[0] === 3 && counts[1] === 2) {
      return 'full_house';
    }
    
    // 检查同花
    if (isFlush) {
      return 'flush';
    }
    
    // 检查顺子
    if (isStraight) {
      return 'straight';
    }
    
    // 检查三条
    if (counts.some(count => count === 3)) {
      return 'three_of_a_kind';
    }
    
    // 检查两对
    const pairCount = counts.filter(count => count === 2).length;
    if (pairCount === 2) {
      return 'two_pair';
    }
    
    // 检查一对
    if (counts.some(count => count === 2)) {
      return 'pair';
    }
    
    // 否则为高牌
    return 'high_card';
  }

  // 静态rankValues对象，避免重复创建
  private static readonly rankValues: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

  /**
   * 按点数大小排序牌
   */
  private sortCardsByRank(cards: Card[]): Card[] {
    return [...cards].sort((a, b) => {
      return AIService.rankValues[a.rank] - AIService.rankValues[b.rank];
    });
  }

  /**
   * 检查是否为同花
   */
  private isFlush(cards: Card[]): boolean {
    if (cards.length < 5) return false;
    
    // 只需要比较第一张牌与其他所有牌的花色
    const firstSuit = cards[0].suit;
    for (let i = 1; i < cards.length; i++) {
      if (cards[i].suit !== firstSuit) {
        return false;
      }
    }
    return true;
  }

  /**
   * 检查是否为顺子
   */
  private isStraight(cards: Card[]): boolean {
    // 使用对象存储唯一的点数值，避免使用Set和多次排序
    const uniqueValues = new Set<number>();
    const values: number[] = [];
    
    for (const card of cards) {
      const value = AIService.rankValues[card.rank];
      if (!uniqueValues.has(value)) {
        uniqueValues.add(value);
        values.push(value);
      }
    }
    
    // 如果唯一点数少于5个，不可能是顺子
    if (values.length < 5) {
      return false;
    }
    
    // 排序唯一的点数值
    values.sort((a, b) => a - b);
    
    // 检查是否有连续的5个点数
    for (let i = 0; i <= values.length - 5; i++) {
      if (values[i + 4] - values[i] === 4) {
        return true;
      }
    }
    
    // 检查特殊情况：A-2-3-4-5的顺子
    const hasAce = uniqueValues.has(14);
    const hasTwo = uniqueValues.has(2);
    const hasThree = uniqueValues.has(3);
    const hasFour = uniqueValues.has(4);
    const hasFive = uniqueValues.has(5);
    
    if (hasAce && hasTwo && hasThree && hasFour && hasFive) {
      return true;
    }
    
    return false;
  }

  /**
   * 检查是否为四条
   */
  private isFourOfAKind(cards: Card[]): boolean {
    const rankCounts = this.getRankCounts(cards);
    return Object.values(rankCounts).some(count => count === 4);
  }

  /**
   * 检查是否为葫芦
   */
  private isFullHouse(cards: Card[]): boolean {
    const rankCounts = this.getRankCounts(cards);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    return counts[0] === 3 && counts[1] === 2;
  }

  /**
   * 检查是否为三条
   */
  private isThreeOfAKind(cards: Card[]): boolean {
    const rankCounts = this.getRankCounts(cards);
    return Object.values(rankCounts).some(count => count === 3);
  }

  /**
   * 检查是否为两对
   */
  private isTwoPair(cards: Card[]): boolean {
    const rankCounts = this.getRankCounts(cards);
    const pairCount = Object.values(rankCounts).filter(count => count === 2).length;
    return pairCount === 2;
  }

  /**
   * 检查是否为一对
   */
  private isPair(cards: Card[]): boolean {
    const rankCounts = this.getRankCounts(cards);
    return Object.values(rankCounts).some(count => count === 2);
  }

  /**
   * 获取每个点数出现的次数
   */
  private getRankCounts(cards: Card[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const card of cards) {
      if (counts[card.rank]) {
        counts[card.rank]++;
      } else {
        counts[card.rank] = 1;
      }
    }
    
    return counts;
  }
}

// 导出AI服务单例
export const aiService = AIService.getInstance();
