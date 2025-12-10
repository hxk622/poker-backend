import pool from './database';
import { GameSession, PlayerSession, Card, CommunityCards, GameAction, WebSocketEvent } from '../types';
import { getWebSocketService } from './websocketInstance';
import LoggerService from './loggerService';

// 生成标准52张扑克牌
export const generateDeck = (): Card[] => {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: Card['rank'][] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  
  return deck;
};

// 洗牌算法
export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// 开始新牌局
export const startNewGame = async (roomId: string): Promise<GameSession> => {
  // 获取房间内的活跃玩家
  const playersResult = await pool.query(
    'SELECT user_id FROM room_players WHERE room_id = $1 AND status = $2',
    [roomId, 'active']
  );
  
  if (playersResult.rows.length < 2) {
    throw new Error('房间内至少需要2名玩家才能开始游戏');
  }
  
  // 随机选择一名玩家作为庄家
  const dealerIndex = Math.floor(Math.random() * playersResult.rows.length);
  const dealerId = playersResult.rows[dealerIndex].user_id;
  
  // 创建新的牌局
  const gameSessionResult = await pool.query(
    `INSERT INTO game_sessions (
      room_id, dealer_id, pot, current_round, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
    [roomId, dealerId, 0, 'preflop', 'in_progress']
  );
  
  const gameSession = gameSessionResult.rows[0];
  
  // 记录游戏开始事件
  LoggerService.gameEvent('Game started', gameSession.id, undefined, {
    playerCount: playersResult.rows.length,
    roomId
  });
  
  // 生成并洗牌
  const deck = generateDeck();
  const shuffledDeck = shuffleDeck(deck);
  
  // 为每个玩家发两张底牌
  const playerPositions: Record<string, string> = {};
  const playerIds = playersResult.rows.map(row => row.user_id);
  
  for (let i = 0; i < playerIds.length; i++) {
    const playerId = playerIds[i];
    const holeCards = [
      shuffledDeck[i * 2],
      shuffledDeck[i * 2 + 1]
    ];
    
    // 设置玩家位置
    const position = i === dealerIndex ? 'btn' : 
                    i === (dealerIndex + 1) % playerIds.length ? 'sb' :
                    i === (dealerIndex + 2) % playerIds.length ? 'bb' :
                    i === (dealerIndex + 3) % playerIds.length ? 'utg' :
                    i === (dealerIndex + playerIds.length - 1) % playerIds.length ? 'co' : 'mp';
    
    playerPositions[playerId] = position;
    
    // 获取玩家的真实筹码数
    const userResult = await pool.query(
      'SELECT chips FROM user_accounts WHERE user_id = $1',
      [playerId]
    );
    
    const chips = userResult.rows[0]?.chips || 10000; // 默认10000筹码
    
    // 保存玩家牌局信息
    await pool.query(
      `INSERT INTO player_sessions (
        session_id, player_id, hole_cards, chips_in_pot, chips_remaining, status, position
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        gameSession.id, 
        playerId, 
        JSON.stringify(holeCards), 
        0, 
        chips, 
        'active',
        position
      ]
    );
  }
  
  // 创建社区牌记录
  await pool.query(
    'INSERT INTO community_cards (session_id, flop, turn, river) VALUES ($1, $2, $3, $4)',
    [gameSession.id, JSON.stringify([]), null, null]
  );
  
  // 处理盲注
  await placeBlinds(gameSession.id, playerIds, dealerIndex, playerPositions);
  
  return gameSession;
};

// 处理盲注
const placeBlinds = async (sessionId: string, playerIds: string[], dealerIndex: number, playerPositions: Record<string, string>) => {
  // 盲注大小（可以根据游戏设置调整）
  const smallBlind = 50;
  const bigBlind = smallBlind * 2;
  
  // 小盲注玩家
  const sbIndex = (dealerIndex + 1) % playerIds.length;
  const sbPlayerId = playerIds[sbIndex];
  
  // 大盲注玩家
  const bbIndex = (dealerIndex + 2) % playerIds.length;
  const bbPlayerId = playerIds[bbIndex];
  
  // 放置小盲注
  await pool.query(
    `UPDATE player_sessions 
     SET chips_in_pot = chips_in_pot + $1, chips_remaining = chips_remaining - $1 
     WHERE session_id = $2 AND player_id = $3`,
    [smallBlind, sessionId, sbPlayerId]
  );
  
  // 放置大盲注
  await pool.query(
    `UPDATE player_sessions 
     SET chips_in_pot = chips_in_pot + $1, chips_remaining = chips_remaining - $1 
     WHERE session_id = $2 AND player_id = $3`,
    [bigBlind, sessionId, bbPlayerId]
  );
  
  // 更新底池大小
  await pool.query(
    `UPDATE game_sessions SET pot = pot + $1 WHERE id = $2`,
    [smallBlind + bigBlind, sessionId]
  );
  
  // 记录盲注动作
  await pool.query(
    `INSERT INTO actions (session_id, player_id, action_type, amount, round, created_at) 
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [sessionId, sbPlayerId, 'small_blind', smallBlind, 'preflop']
  );
  
  await pool.query(
    `INSERT INTO actions (session_id, player_id, action_type, amount, round, created_at) 
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [sessionId, bbPlayerId, 'big_blind', bigBlind, 'preflop']
  );
};

// 发翻牌
export const dealFlop = async (sessionId: string): Promise<any> => {
  // 1. 验证当前轮次是否为preflop
  const sessionResult = await pool.query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
  if (sessionResult.rows.length === 0) {
    throw new Error('牌局不存在');
  }
  
  const session = sessionResult.rows[0];
  if (session.current_round !== 'preflop' || session.status !== 'in_progress') {
    throw new Error('当前轮次不能发翻牌');
  }
  
  // 2. 获取剩余的牌（跳过已发的底牌）
  const playersResult = await pool.query('SELECT * FROM player_sessions WHERE session_id = $1', [sessionId]);
  const playersCount = playersResult.rows.length;
  
  // 计算已发底牌数
  const dealtCards = playersCount * 2;
  
  // 重新生成并洗牌（实际应用中应该保存剩余牌组，这里简化处理）
  const deck = generateDeck();
  const shuffledDeck = shuffleDeck(deck);
  
  // 3. 选择翻牌（跳过已发的底牌）
  const flop = [shuffledDeck[dealtCards], shuffledDeck[dealtCards + 1], shuffledDeck[dealtCards + 2]];
  
  // 4. 更新社区牌
  await pool.query(
    'UPDATE community_cards SET flop = $1 WHERE session_id = $2',
    [JSON.stringify(flop), sessionId]
  );
  
  // 5. 更新牌局轮次到flop
  await pool.query(
    'UPDATE game_sessions SET current_round = $1 WHERE id = $2',
    ['flop', sessionId]
  );
  
  // 6. 获取更新后的游戏状态
  const updatedGameStatus = await getGameStatus(sessionId);
  
  // 7. 广播游戏状态更新
  const wsEvent: WebSocketEvent = {
    type: 'game_state_update',
    data: updatedGameStatus
  };
  
  const websocketService = getWebSocketService();
  websocketService.broadcastToRoom(session.room_id, wsEvent);
  
  return updatedGameStatus;
};

// 发转牌
export const dealTurn = async (sessionId: string): Promise<any> => {
  // 1. 验证当前轮次是否为flop
  const sessionResult = await pool.query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
  if (sessionResult.rows.length === 0) {
    throw new Error('牌局不存在');
  }
  
  const session = sessionResult.rows[0];
  if (session.current_round !== 'flop' || session.status !== 'in_progress') {
    throw new Error('当前轮次不能发转牌');
  }
  
  // 2. 获取剩余的牌（跳过已发的底牌和翻牌）
  const playersResult = await pool.query('SELECT * FROM player_sessions WHERE session_id = $1', [sessionId]);
  const playersCount = playersResult.rows.length;
  
  // 计算已发牌数
  const dealtCards = playersCount * 2 + 3; // 底牌 + 翻牌
  
  // 重新生成并洗牌（实际应用中应该保存剩余牌组，这里简化处理）
  const deck = generateDeck();
  const shuffledDeck = shuffleDeck(deck);
  
  // 3. 选择转牌
  const turn = shuffledDeck[dealtCards];
  
  // 4. 更新社区牌
  await pool.query(
    'UPDATE community_cards SET turn = $1 WHERE session_id = $2',
    [turn, sessionId]
  );
  
  // 5. 更新牌局轮次到turn
  await pool.query(
    'UPDATE game_sessions SET current_round = $1 WHERE id = $2',
    ['turn', sessionId]
  );
  
  // 6. 获取更新后的游戏状态
  const updatedGameStatus = await getGameStatus(sessionId);
  
  // 7. 广播游戏状态更新
  const wsEvent: WebSocketEvent = {
    type: 'game_state_update',
    data: updatedGameStatus
  };
  
  const websocketService = getWebSocketService();
  websocketService.broadcastToRoom(session.room_id, wsEvent);
  
  return updatedGameStatus;
};

// 发河牌
export const dealRiver = async (sessionId: string): Promise<any> => {
  // 1. 验证当前轮次是否为turn
  const sessionResult = await pool.query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
  if (sessionResult.rows.length === 0) {
    throw new Error('牌局不存在');
  }
  
  const session = sessionResult.rows[0];
  if (session.current_round !== 'turn' || session.status !== 'in_progress') {
    throw new Error('当前轮次不能发河牌');
  }
  
  // 2. 获取剩余的牌（跳过已发的底牌、翻牌和转牌）
  const playersResult = await pool.query('SELECT * FROM player_sessions WHERE session_id = $1', [sessionId]);
  const playersCount = playersResult.rows.length;
  
  // 计算已发牌数
  const dealtCards = playersCount * 2 + 4; // 底牌 + 翻牌 + 转牌
  
  // 重新生成并洗牌（实际应用中应该保存剩余牌组，这里简化处理）
  const deck = generateDeck();
  const shuffledDeck = shuffleDeck(deck);
  
  // 3. 选择河牌
  const river = shuffledDeck[dealtCards];
  
  // 4. 更新社区牌
  await pool.query(
    'UPDATE community_cards SET river = $1 WHERE session_id = $2',
    [river, sessionId]
  );
  
  // 5. 更新牌局轮次到river
  await pool.query(
    'UPDATE game_sessions SET current_round = $1 WHERE id = $2',
    ['river', sessionId]
  );
  
  // 6. 获取更新后的游戏状态
  const updatedGameStatus = await getGameStatus(sessionId);
  
  // 7. 广播游戏状态更新
  const wsEvent: WebSocketEvent = {
    type: 'game_state_update',
    data: updatedGameStatus
  };
  
  const websocketService = getWebSocketService();
  websocketService.broadcastToRoom(session.room_id, wsEvent);
  
  return updatedGameStatus;
};

// 结束当前轮次并进入下一轮
export const endCurrentRound = async (sessionId: string): Promise<any> => {
  // 1. 获取当前牌局状态
  const sessionResult = await pool.query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
  if (sessionResult.rows.length === 0) {
    throw new Error('牌局不存在');
  }
  
  const session = sessionResult.rows[0];
  
  // 2. 根据当前轮次决定下一步操作
  switch (session.current_round) {
    case 'preflop':
      // 进入翻牌轮
      return await dealFlop(sessionId);
    case 'flop':
      // 进入转牌轮
      return await dealTurn(sessionId);
    case 'turn':
      // 进入河牌轮
      return await dealRiver(sessionId);
    case 'river':
      // 进入摊牌阶段，判定胜负
      return await determineWinner(sessionId);
    default:
      throw new Error('无效的游戏轮次');
  }
};

// 获取当前牌局状态
export const getGameStatus = async (sessionId: string): Promise<any> => {
  // 获取牌局基本信息
  const sessionResult = await pool.query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
  if (sessionResult.rows.length === 0) {
    throw new Error('牌局不存在');
  }
  
  const session = sessionResult.rows[0];
  
  // 获取玩家信息
  const playersResult = await pool.query('SELECT * FROM player_sessions WHERE session_id = $1', [sessionId]);
  const players = playersResult.rows;
  
  // 获取社区牌
  const communityCardsResult = await pool.query('SELECT * FROM community_cards WHERE session_id = $1', [sessionId]);
  const communityCards = communityCardsResult.rows[0];
  
  return {
    session,
    players,
    communityCards
  };
};

// 执行游戏动作
export const executeGameAction = async (sessionId: string, playerId: string, action: GameAction): Promise<any> => {
  // 记录玩家动作
  LoggerService.playerAction(action.action_type, sessionId, playerId, {
    amount: action.amount
  });
  
  // 获取当前牌局状态
  const gameStatus = await getGameStatus(sessionId);
  const { session, players, communityCards } = gameStatus;
  
  // 检查玩家是否在当前牌局中
  const currentPlayer = players.find((p: any) => p.player_id === playerId);
  if (!currentPlayer) {
    LoggerService.errorEvent(new Error('玩家不在当前牌局中'), sessionId, playerId);
    throw new Error('玩家不在当前牌局中');
  }
  
  // 检查玩家状态是否活跃
  if (currentPlayer.status !== 'active') {
    throw new Error('玩家当前无法行动');
  }
  
  // 1. 检查是否轮到该玩家行动
  const activePlayers = players.filter((p: any) => p.status === 'active');
  if (activePlayers.length <= 1) {
    // 只剩一名玩家，直接判定胜负
    return await determineWinner(sessionId);
  }
  
  // 2. 验证动作的合法性
  validateAction(action, currentPlayer, players, session.pot);
  
  // 3. 记录动作
  await pool.query(
    `INSERT INTO actions (session_id, player_id, action_type, amount, round, created_at) 
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      sessionId,
      playerId,
      action.action_type,
      action.amount || 0,
      session.current_round
    ]
  );
  
  // 4. 更新玩家筹码和底池
  if (action.action_type === 'call' || action.action_type === 'raise' || action.action_type === 'all_in') {
    const amount = action.amount || 0;
    
    // 更新玩家已下注筹码
    await pool.query(
      'UPDATE player_sessions SET chips_in_pot = chips_in_pot + $1, chips_remaining = chips_remaining - $1 WHERE id = $2',
      [amount, currentPlayer.id]
    );
    
    // 更新底池大小
    await pool.query(
      'UPDATE game_sessions SET pot = pot + $1 WHERE id = $2',
      [amount, sessionId]
    );
    
    // 处理全下情况
    if (action.action_type === 'all_in' || currentPlayer.chips_remaining - amount <= 0) {
      await pool.query(
        'UPDATE player_sessions SET status = $1 WHERE id = $2',
        ['all_in', currentPlayer.id]
      );
    }
  } else if (action.action_type === 'fold') {
    // 更新玩家状态为已弃牌
    await pool.query(
      'UPDATE player_sessions SET status = $1 WHERE id = $2',
      ['folded', currentPlayer.id]
    );
  }
  
  // 5. 检查当前轮次是否结束
  const updatedPlayers = (await pool.query('SELECT * FROM player_sessions WHERE session_id = $1', [sessionId])).rows;
  const updatedActivePlayers = updatedPlayers.filter((p: any) => p.status === 'active' || p.status === 'all_in');
  
  // 检查是否所有活跃玩家都已行动
  const allPlayersActed = updatedActivePlayers.every((p: any) => {
    // 这里简化处理，实际应该检查每个玩家是否已经在当前轮次行动
    return true;
  });
  
  let updatedGameStatus;
  if (allPlayersActed) {
    // 所有玩家都已行动，进入下一轮
    updatedGameStatus = await endCurrentRound(sessionId);
  } else {
    // 获取更新后的游戏状态
    updatedGameStatus = await getGameStatus(sessionId);
  }
  
  // 6. 通过WebSocket广播游戏状态更新
  const wsEvent: WebSocketEvent = {
    type: 'game_state_update',
    data: updatedGameStatus
  };
  
  // 广播给所有在房间内的玩家
  if (session.room_id) {
    const websocketService = getWebSocketService();
    websocketService.broadcastToRoom(session.room_id, wsEvent);
  }
  
  return updatedGameStatus;
};

// 验证动作合法性
const validateAction = (action: GameAction, currentPlayer: any, players: any[], pot: number): void => {
  // 获取当前最大下注
  const maxBet = Math.max(...players.map((p: any) => p.chips_in_pot));
  const playerBet = currentPlayer.chips_in_pot;
  const betToCall = maxBet - playerBet;
  
  switch (action.action_type) {
    case 'fold':
      // 弃牌总是合法的
      break;
    case 'check':
      // 只有当没有需要跟注的金额时才能check
      if (betToCall > 0) {
        throw new Error('当前有需要跟注的金额，不能check');
      }
      break;
    case 'call':
      // call的金额必须等于需要跟注的金额
      if (action.amount !== betToCall) {
        throw new Error(`call的金额必须等于需要跟注的金额: ${betToCall}`);
      }
      // 检查玩家是否有足够的筹码
      if (currentPlayer.chips_remaining < betToCall) {
        throw new Error('玩家筹码不足');
      }
      break;
    case 'raise':
      // raise的金额必须大于当前最大下注
      if (!action.amount || action.amount <= maxBet) {
        throw new Error('raise的金额必须大于当前最大下注');
      }
      // 检查玩家是否有足够的筹码
      if (currentPlayer.chips_remaining < (action.amount - playerBet)) {
        throw new Error('玩家筹码不足');
      }
      break;
    case 'all_in':
      // all_in使用玩家所有剩余筹码
      if (action.amount !== currentPlayer.chips_remaining) {
        throw new Error('all_in的金额必须等于玩家所有剩余筹码');
      }
      break;
    default:
      throw new Error('无效的游戏动作');
  }
};

// 牌型强度权重
const HAND_STRENGTH_WEIGHTS: Record<string, number> = {
  'high_card': 0,
  'pair': 1,
  'two_pair': 2,
  'three_of_a_kind': 3,
  'straight': 4,
  'flush': 5,
  'full_house': 6,
  'four_of_a_kind': 7,
  'straight_flush': 8,
  'royal_flush': 9
};

// 点数值映射
const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// 牌型识别函数
export const evaluateHand = (cards: Card[]): { handType: string; highCard: Card | null } => {
  // 确保至少有5张牌
  if (cards.length < 5) {
    return { handType: 'high_card', highCard: cards.length > 0 ? cards[cards.length - 1] : null };
  }
  
  // 对牌进行排序
  const sortedCards = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
  
  // 检查同花顺（包括皇家同花顺）
  if (isFlush(sortedCards) && isStraight(sortedCards)) {
    const highestCard = sortedCards[0];
    if (highestCard.rank === 'A' && sortedCards[1].rank === 'K') {
      return { handType: 'royal_flush', highCard: highestCard };
    }
    return { handType: 'straight_flush', highCard: highestCard };
  }
  
  // 检查四条
  if (isFourOfAKind(sortedCards)) {
    return { handType: 'four_of_a_kind', highCard: sortedCards[0] };
  }
  
  // 检查葫芦
  if (isFullHouse(sortedCards)) {
    return { handType: 'full_house', highCard: sortedCards[0] };
  }
  
  // 检查同花
  if (isFlush(sortedCards)) {
    return { handType: 'flush', highCard: sortedCards[0] };
  }
  
  // 检查顺子
  if (isStraight(sortedCards)) {
    return { handType: 'straight', highCard: sortedCards[0] };
  }
  
  // 检查三条
  if (isThreeOfAKind(sortedCards)) {
    return { handType: 'three_of_a_kind', highCard: sortedCards[0] };
  }
  
  // 检查两对
  if (isTwoPair(sortedCards)) {
    return { handType: 'two_pair', highCard: sortedCards[0] };
  }
  
  // 检查一对
  if (isPair(sortedCards)) {
    return { handType: 'pair', highCard: sortedCards[0] };
  }
  
  // 否则为高牌
  return { handType: 'high_card', highCard: sortedCards[0] };
};

// 牌力评估函数
export const evaluateHandStrength = (holeCards: Card[], communityCards: Card[]): number => {
  // 组合所有可用牌
  const allCards = [...holeCards, ...communityCards];
  
  // 如果牌数不足，返回0
  if (allCards.length < 5) {
    return 0;
  }
  
  // 评估牌型
  const { handType, highCard } = evaluateHand(allCards);
  
  // 计算基本牌力（基于牌型）
  const baseStrength = HAND_STRENGTH_WEIGHTS[handType] / 9; // 归一化到0-1范围
  
  // 根据牌型的具体大小进行调整
  let adjustment = 0;
  if (highCard) {
    adjustment = RANK_VALUES[highCard.rank] / 14 / 10; // 为高牌增加微调
  }
  
  // 返回最终牌力（0-1之间）
  return Math.min(1, baseStrength + adjustment);
};

// 辅助函数：检查同花
const isFlush = (cards: Card[]): boolean => {
  const suits = new Set(cards.map(card => card.suit));
  return suits.size === 1;
};

// 辅助函数：检查顺子
const isStraight = (cards: Card[]): boolean => {
  // 获取唯一的点数值并排序（从大到小）
  const uniqueValues = Array.from(new Set(cards.map(card => RANK_VALUES[card.rank]))).sort((a, b) => b - a);
  
  // 检查是否有连续的5个点数
  for (let i = 0; i <= uniqueValues.length - 5; i++) {
    let isSequence = true;
    for (let j = 0; j < 4; j++) {
      if (uniqueValues[i + j] - uniqueValues[i + j + 1] !== 1) {
        isSequence = false;
        break;
      }
    }
    if (isSequence) {
      return true;
    }
  }
  
  // 检查特殊情况：A-2-3-4-5的顺子
  const hasAce = uniqueValues.includes(14);
  const hasTwo = uniqueValues.includes(2);
  const hasThree = uniqueValues.includes(3);
  const hasFour = uniqueValues.includes(4);
  const hasFive = uniqueValues.includes(5);
  
  return hasAce && hasTwo && hasThree && hasFour && hasFive;
};

// 辅助函数：检查四条
const isFourOfAKind = (cards: Card[]): boolean => {
  const rankCounts = getRankCounts(cards);
  return Object.values(rankCounts).some(count => count === 4);
};

// 辅助函数：检查葫芦
const isFullHouse = (cards: Card[]): boolean => {
  const rankCounts = getRankCounts(cards);
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  return counts[0] === 3 && counts[1] === 2;
};

// 辅助函数：检查三条
const isThreeOfAKind = (cards: Card[]): boolean => {
  const rankCounts = getRankCounts(cards);
  return Object.values(rankCounts).some(count => count === 3);
};

// 辅助函数：检查两对
const isTwoPair = (cards: Card[]): boolean => {
  const rankCounts = getRankCounts(cards);
  const pairCount = Object.values(rankCounts).filter(count => count === 2).length;
  return pairCount === 2;
};

// 辅助函数：检查一对
const isPair = (cards: Card[]): boolean => {
  const rankCounts = getRankCounts(cards);
  return Object.values(rankCounts).some(count => count === 2);
};

// 辅助函数：获取每个点数出现的次数
const getRankCounts = (cards: Card[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  
  for (const card of cards) {
    if (counts[card.rank]) {
      counts[card.rank]++;
    } else {
      counts[card.rank] = 1;
    }
  }
  
  return counts;
};

// 确定获胜者
export const determineWinner = async (sessionId: string): Promise<any> => {
  // 获取当前牌局状态
  const gameStatus = await getGameStatus(sessionId);
  const { session, players, communityCards } = gameStatus;
  
  // 记录游戏结束事件
  LoggerService.gameEvent('Game ended', sessionId, undefined, {
    pot: session.pot,
    playerCount: players.length
  });
  
  // 获取所有未弃牌的玩家
  const activePlayers = players.filter((p: any) => p.status !== 'folded');
  
  // 如果只剩一名玩家，直接获胜
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    // 将所有底池筹码分配给获胜者
    await pool.query(
      'UPDATE player_sessions SET chips_remaining = chips_remaining + $1 WHERE id = $2',
      [session.pot, winner.id]
    );
    
    // 更新牌局状态为已结束
    await pool.query(
      'UPDATE game_sessions SET status = $1, ended_at = NOW() WHERE id = $2',
      ['completed', sessionId]
    );
    
    // 记录获胜信息
    const winnerInfo = {
      session_id: sessionId,
      winner_player_id: winner.player_id,
      winning_hand: 'default',
      amount_won: session.pot
    };
    
    return winnerInfo;
  }
  
  // 计算每个玩家的手牌强度
  const playersWithHandStrength = await Promise.all(
    activePlayers.map(async (player: any) => {
      // 获取玩家的两张手牌
      const cardsResult = await pool.query(
        'SELECT card_1, card_2 FROM player_sessions WHERE id = $1',
        [player.id]
      );
      
      const { card_1, card_2 } = cardsResult.rows[0];
      
      // 计算手牌强度
      const handStrength = evaluateHandStrength([card_1, card_2], communityCards);
      
      // 定义所有可用牌
      const allCards = [card_1, card_2, ...communityCards];
      
      return {
        ...player,
        handStrength,
        allCards
      };
    })
  );
  
  // 确定获胜者（支持底池分割）
  const winners = determineWinnersWithPotSplitting(playersWithHandStrength);
  
  // 分配筹码
  let totalDistributed = 0;
  for (const winner of winners) {
    await pool.query(
      'UPDATE player_sessions SET chips_remaining = chips_remaining + $1 WHERE id = $2',
      [winner.amountWon, winner.player.id]
    );
    totalDistributed += winner.amountWon;
  }
  
  // 验证分配的筹码总和是否等于底池大小
  if (totalDistributed !== session.pot) {
    console.error('筹码分配错误，底池大小与分配总和不一致');
  }
  
  // 更新牌局状态为已结束
  await pool.query(
    'UPDATE game_sessions SET status = $1, ended_at = NOW() WHERE id = $2',
    ['completed', sessionId]
  );
  
  // 返回获胜信息
  const winnerInfos = winners.map(winner => ({
    session_id: sessionId,
    winner_player_id: winner.player.player_id,
    winning_hand: winner.handType,
    amount_won: winner.amountWon
  }));
  
  return winnerInfos;
};

// 确定获胜者并处理底池分割
const determineWinnersWithPotSplitting = (players: any[]): any[] => {
  // 按手牌强度降序排序
  const sortedPlayers = [...players].sort((a, b) => b.handStrength - a.handStrength);
  
  // 计算底池分割
  interface PotWinner {
    player: any;
    handType: string;
    amountWon: number;
  }
  const pots: PotWinner[] = [];
  let remainingPot = players.reduce((sum, p) => sum + p.chips_in_pot, 0);
  const playersByBet = [...players].sort((a, b) => a.chips_in_pot - b.chips_in_pot);
  
  // 处理底池分割
  for (let i = 0; i < playersByBet.length; i++) {
    const player = playersByBet[i];
    const nextPlayer = playersByBet[i + 1];
    const betAmount = nextPlayer ? nextPlayer.chips_in_pot - player.chips_in_pot : player.chips_in_pot;
    
    if (betAmount > 0) {
      const potSize = betAmount * (playersByBet.length - i);
      const eligiblePlayers = sortedPlayers.filter(p => p.chips_in_pot >= player.chips_in_pot + betAmount);
      
      // 在符合条件的玩家中找到最强的手牌
      const maxStrength = Math.max(...eligiblePlayers.map(p => p.handStrength));
      const winnersForPot = eligiblePlayers.filter(p => p.handStrength === maxStrength);
      
      // 平均分配该底池
      const amountPerWinner = potSize / winnersForPot.length;
      
      for (const winner of winnersForPot) {
        const existingWinner = pots.find(p => p.player.id === winner.id);
        if (existingWinner) {
          existingWinner.amountWon += amountPerWinner;
        } else {
          // 获取手牌类型
          const { handType } = evaluateHand(winner.allCards);
          pots.push({
            player: winner,
            handType,
            amountWon: amountPerWinner
          });
        }
      }
      
      remainingPot -= potSize;
    }
  }
  
  return pots;
};
