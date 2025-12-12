import { GameSession, PlayerSession, Card, CommunityCards, GameAction, WebSocketEvent } from '../types';
import { getWebSocketService } from './websocketInstance';
import LoggerService from './loggerService';
import { postgreSQLGameSessionDAO } from '../dao/impl/postgreSQLGameDAO';
import { postgreSQLPlayerSessionDAO } from '../dao/impl/postgreSQLGameDAO';
import { postgreSQLActionDAO } from '../dao/impl/postgreSQLGameDAO';
import { postgreSQLCommunityCardsDAO } from '../dao/impl/postgreSQLGameDAO';
import { postgreSQLUserDAO } from '../dao/impl/postgreSQLUserDAO';
import pool from './database';

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
  const roomPlayersResult = await pool.query(
    `SELECT user_id FROM session_players WHERE room_id = $1 AND status = $2`,
    [roomId, 'active']
  );
  
  const roomPlayers = roomPlayersResult.rows;
  
  if (roomPlayers.length < 2) {
    throw new Error('房间内至少需要2名玩家才能开始游戏');
  }
  
  // 随机选择一名玩家作为庄家
  const dealerIndex = Math.floor(Math.random() * roomPlayers.length);
  const dealerId = roomPlayers[dealerIndex].user_id;
  
  // 创建新的牌局
  const gameSession = await postgreSQLGameSessionDAO.create({
    room_id: roomId,
    dealer_id: dealerId,
    pot: 0,
    current_round: 'preflop',
    status: 'in_progress'
  });
  
  // 记录游戏开始事件
  LoggerService.gameEvent('Game started', gameSession.id, undefined, {
    playerCount: roomPlayers.length,
    roomId
  });
  
  // 生成并洗牌
  const deck = generateDeck();
  const shuffledDeck = shuffleDeck(deck);
  
  // 为每个玩家发两张底牌
  const playerPositions: Record<string, string> = {};
  const playerIds = roomPlayers.map(player => player.user_id);
  
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
    const user = await postgreSQLUserDAO.getById(playerId);
    const chips = user?.chips || 10000; // 默认10000筹码
    
    // 保存玩家牌局信息
    await postgreSQLPlayerSessionDAO.create({
      session_id: gameSession.id,
      player_id: playerId,
      hole_cards: holeCards,
      chips_in_pot: 0,
      chips_remaining: chips,
      status: 'active',
      position: position
    });
  }
  
  // 创建初始社区牌（空）
  await postgreSQLCommunityCardsDAO.create({
    session_id: gameSession.id,
    flop: []
  });
  
  // 放置盲注
  await placeBlinds(gameSession.id, roomId, playerIds, dealerIndex, playerPositions);
  
  return gameSession;
};

// 处理盲注
const placeBlinds = async (sessionId: string, roomId: string, playerIds: string[], dealerIndex: number, playerPositions: Record<string, string>) => {
  // 盲注大小（可以根据游戏设置调整）
  const smallBlind = 50;
  const bigBlind = smallBlind * 2;
  
  // 小盲注玩家
  const sbIndex = (dealerIndex + 1) % playerIds.length;
  const sbPlayerId = playerIds[sbIndex];
  
  // 大盲注玩家
  const bbIndex = (dealerIndex + 2) % playerIds.length;
  const bbPlayerId = playerIds[bbIndex];
  
  // 获取玩家当前状态
  const allPlayers = await postgreSQLPlayerSessionDAO.getPlayersBySession(sessionId);
  const sbPlayer = allPlayers.find(p => p.player_id === sbPlayerId);
  const bbPlayer = allPlayers.find(p => p.player_id === bbPlayerId);
  
  if (!sbPlayer || !bbPlayer) {
    throw new Error('无法获取玩家信息');
  }
  
  // 放置小盲注
  await postgreSQLPlayerSessionDAO.updateChips(
    sessionId,
    sbPlayerId,
    sbPlayer.chips_in_pot + smallBlind,
    sbPlayer.chips_remaining - smallBlind
  );
  
  // 放置大盲注
  await postgreSQLPlayerSessionDAO.updateChips(
    sessionId,
    bbPlayerId,
    bbPlayer.chips_in_pot + bigBlind,
    bbPlayer.chips_remaining - bigBlind
  );
  
  // 更新底池大小
  await postgreSQLGameSessionDAO.updatePot(sessionId, smallBlind + bigBlind);
  
  // 记录盲注动作
  await postgreSQLActionDAO.create({
    session_id: sessionId,
    player_id: sbPlayerId,
    action_type: 'call',
    amount: smallBlind,
    round: 'preflop'
  });
  
  await postgreSQLActionDAO.create({
    session_id: sessionId,
    player_id: bbPlayerId,
    action_type: 'call',
    amount: bigBlind,
    round: 'preflop'
  });
};

// 发翻牌
export const dealFlop = async (sessionId: string): Promise<any> => {
  // 1. 验证当前轮次是否为preflop
  const session = await postgreSQLGameSessionDAO.getById(sessionId);
  if (!session) {
    throw new Error('牌局不存在');
  }
  
  if (session.current_round !== 'preflop' || session.status !== 'in_progress') {
    throw new Error('当前轮次不能发翻牌');
  }
  
  // 2. 获取剩余的牌（跳过已发的底牌）
  const players = await postgreSQLPlayerSessionDAO.getPlayersBySession(sessionId);
  const playersCount = players.length;
  
  // 计算已发牌数
  const dealtCards = playersCount * 2;
  
  // 重新生成并洗牌（实际应用中应该保存剩余牌组，这里简化处理）
  const deck = generateDeck();
  const shuffledDeck = shuffleDeck(deck);
  
  // 3. 选择翻牌（3张）
  const flop = shuffledDeck.slice(dealtCards, dealtCards + 3);
  
  // 4. 更新社区牌
  await postgreSQLCommunityCardsDAO.updateFlop(sessionId, flop);
  
  // 5. 更新牌局轮次到flop
  await postgreSQLGameSessionDAO.updateRound(sessionId, 'flop');
  
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
  const session = await postgreSQLGameSessionDAO.getById(sessionId);
  if (!session) {
    throw new Error('牌局不存在');
  }
  
  if (session.current_round !== 'flop' || session.status !== 'in_progress') {
    throw new Error('当前轮次不能发转牌');
  }
  
  // 2. 获取剩余的牌（跳过已发的底牌和翻牌）
  const players = await postgreSQLPlayerSessionDAO.getPlayersBySession(sessionId);
  const playersCount = players.length;
  
  // 计算已发牌数
  const dealtCards = playersCount * 2 + 3; // 底牌 + 翻牌
  
  // 重新生成并洗牌（实际应用中应该保存剩余牌组，这里简化处理）
  const deck = generateDeck();
  const shuffledDeck = shuffleDeck(deck);
  
  // 3. 选择转牌
  const turn = shuffledDeck[dealtCards];
  
  // 4. 更新社区牌
  await postgreSQLCommunityCardsDAO.updateTurn(sessionId, turn);
  
  // 5. 更新牌局轮次到turn
  await postgreSQLGameSessionDAO.updateRound(sessionId, 'turn');
  
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
  const session = await postgreSQLGameSessionDAO.getById(sessionId);
  if (!session) {
    throw new Error('牌局不存在');
  }
  
  if (session.current_round !== 'turn' || session.status !== 'in_progress') {
    throw new Error('当前轮次不能发河牌');
  }
  
  // 2. 获取剩余的牌（跳过已发的底牌、翻牌和转牌）
  const players = await postgreSQLPlayerSessionDAO.getPlayersBySession(sessionId);
  const playersCount = players.length;
  
  // 计算已发牌数
  const dealtCards = playersCount * 2 + 4; // 底牌 + 翻牌 + 转牌
  
  // 重新生成并洗牌（实际应用中应该保存剩余牌组，这里简化处理）
  const deck = generateDeck();
  const shuffledDeck = shuffleDeck(deck);
  
  // 3. 选择河牌
  const river = shuffledDeck[dealtCards];
  
  // 4. 更新社区牌
  await postgreSQLCommunityCardsDAO.updateRiver(sessionId, river);
  
  // 5. 更新牌局轮次到river
  await postgreSQLGameSessionDAO.updateRound(sessionId, 'river');
  
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
  const session = await postgreSQLGameSessionDAO.getById(sessionId);
  if (!session) {
    throw new Error('牌局不存在');
  }
  
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
  const session = await postgreSQLGameSessionDAO.getById(sessionId);
  if (!session) {
    throw new Error('牌局不存在');
  }
  
  // 获取玩家信息
  const players = await postgreSQLPlayerSessionDAO.getPlayersBySession(sessionId);
  
  // 获取社区牌
  const communityCards = await postgreSQLCommunityCardsDAO.getBySession(sessionId);
  
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
  await postgreSQLActionDAO.create({
    session_id: sessionId,
    player_id: playerId,
    action_type: action.action_type,
    amount: action.amount || 0,
    round: session.current_round
  });
  
  // 4. 更新玩家筹码和底池
  if (action.action_type === 'call' || action.action_type === 'raise' || action.action_type === 'all_in') {
    const amount = action.amount || 0;
    const totalBet = currentPlayer.chips_in_pot + amount;
    const newChipsRemaining = currentPlayer.chips_remaining - amount;
    
    // 更新玩家筹码
    await postgreSQLPlayerSessionDAO.updateChips(sessionId, playerId, totalBet, newChipsRemaining);
    
    // 更新底池大小
    await postgreSQLGameSessionDAO.updatePot(sessionId, session.pot + amount);
    
    // 处理全下情况
    if (action.action_type === 'all_in' || newChipsRemaining <= 0) {
      await postgreSQLPlayerSessionDAO.updateStatus(sessionId, playerId, 'all_in');
    }
  } else if (action.action_type === 'fold') {
    // 更新玩家状态为已弃牌
    await postgreSQLPlayerSessionDAO.updateStatus(sessionId, playerId, 'folded');
  }
  
  // 5. 检查当前轮次是否结束
  const updatedPlayers = await postgreSQLPlayerSessionDAO.getPlayersBySession(sessionId);
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
    const totalChips = winner.chips_in_pot + session.pot;
    await postgreSQLPlayerSessionDAO.updateChips(sessionId, winner.player_id, totalChips, 0);
    
    // 更新牌局状态为已结束
    await postgreSQLGameSessionDAO.updateStatus(sessionId, 'finished');
    
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
      const playerSession = await postgreSQLPlayerSessionDAO.getById(player.id);
      
      if (!playerSession) {
        throw new Error(`玩家牌局信息不存在: ${player.id}`);
      }
      
      const { hole_cards } = playerSession;
      
      // 计算手牌强度
      const handStrength = evaluateHandStrength(hole_cards, communityCards);
      
      // 定义所有可用牌
      const allCards = [...hole_cards, ...communityCards];
      
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
    const totalChips = winner.player.chips_in_pot + winner.amountWon;
    await postgreSQLPlayerSessionDAO.updateChips(sessionId, winner.player.player_id, totalChips, 0);
    totalDistributed += winner.amountWon;
  }
  
  // 验证分配的筹码总和是否等于底池大小
  if (totalDistributed !== session.pot) {
    console.error('筹码分配错误，底池大小与分配总和不一致');
  }
  
  // 更新牌局状态为已结束
    await postgreSQLGameSessionDAO.updateStatus(sessionId, 'finished');
  
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
