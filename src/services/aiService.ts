import { AIAnalysis, AISuggestion, Card, GameAction } from '../types';

/**
 * AI服务层 - 提供德州扑克AI分析和建议功能
 */
export class AIService {
  private static instance: AIService;

  private constructor() {
    // 初始化AI模型和参数
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
    // TODO: 实现完整的牌型评估算法
    // 简单实现：随机返回一个牌型用于测试
    const handTypes: string[] = [
      'high_card', 'pair', 'two_pair', 'three_of_a_kind', 
      'straight', 'flush', 'full_house', 'four_of_a_kind', 
      'straight_flush', 'royal_flush'
    ];
    
    // 基于牌数量返回合理的牌型
    if (cards.length < 5) {
      return 'high_card';
    }
    
    // 随机选择一个牌型（实际应用中应该实现完整的牌型评估）
    return handTypes[Math.floor(Math.random() * handTypes.length)];
  }
}

// 导出AI服务单例
export const aiService = AIService.getInstance();
