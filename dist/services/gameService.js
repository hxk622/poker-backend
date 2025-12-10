"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineWinner = exports.evaluateHandStrength = exports.executeGameAction = exports.getGameStatus = exports.startNewGame = exports.shuffleDeck = exports.generateDeck = void 0;
const database_1 = __importDefault(require("./database"));
const websocketInstance_1 = require("./websocketInstance");
// 生成标准52张扑克牌
const generateDeck = () => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    return deck;
};
exports.generateDeck = generateDeck;
// 洗牌算法
const shuffleDeck = (deck) => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};
exports.shuffleDeck = shuffleDeck;
// 开始新牌局
const startNewGame = async (roomId) => {
    // 获取房间内的活跃玩家
    const playersResult = await database_1.default.query('SELECT user_id FROM room_players WHERE room_id = $1 AND status = $2', [roomId, 'active']);
    if (playersResult.rows.length < 2) {
        throw new Error('房间内至少需要2名玩家才能开始游戏');
    }
    // 随机选择一名玩家作为庄家
    const dealerIndex = Math.floor(Math.random() * playersResult.rows.length);
    const dealerId = playersResult.rows[dealerIndex].user_id;
    // 创建新的牌局
    const gameSessionResult = await database_1.default.query(`INSERT INTO game_sessions (
      room_id, dealer_id, pot, current_round, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`, [roomId, dealerId, 0, 'preflop', 'in_progress']);
    const gameSession = gameSessionResult.rows[0];
    // 生成并洗牌
    const deck = (0, exports.generateDeck)();
    const shuffledDeck = (0, exports.shuffleDeck)(deck);
    // 为每个玩家发两张底牌
    for (let i = 0; i < playersResult.rows.length; i++) {
        const playerId = playersResult.rows[i].user_id;
        const holeCards = [
            shuffledDeck[i * 2],
            shuffledDeck[i * 2 + 1]
        ];
        // 保存玩家牌局信息
        await database_1.default.query(`INSERT INTO player_sessions (
        session_id, player_id, hole_cards, chips_in_pot, chips_remaining, status, position
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
            gameSession.id,
            playerId,
            JSON.stringify(holeCards),
            0,
            // TODO: 获取玩家的筹码数
            10000,
            'active',
            // 设置玩家位置
            i === dealerIndex ? 'btn' :
                i === (dealerIndex + 1) % playersResult.rows.length ? 'sb' :
                    i === (dealerIndex + 2) % playersResult.rows.length ? 'bb' :
                        i === (dealerIndex + 3) % playersResult.rows.length ? 'utg' :
                            i === (dealerIndex + playersResult.rows.length - 1) % playersResult.rows.length ? 'co' : 'mp'
        ]);
    }
    // 创建社区牌记录
    await database_1.default.query('INSERT INTO community_cards (session_id, flop, turn, river) VALUES ($1, $2, $3, $4)', [gameSession.id, JSON.stringify([]), null, null]);
    return gameSession;
};
exports.startNewGame = startNewGame;
// 获取当前牌局状态
const getGameStatus = async (sessionId) => {
    // 获取牌局基本信息
    const sessionResult = await database_1.default.query('SELECT * FROM game_sessions WHERE id = $1', [sessionId]);
    if (sessionResult.rows.length === 0) {
        throw new Error('牌局不存在');
    }
    const session = sessionResult.rows[0];
    // 获取玩家信息
    const playersResult = await database_1.default.query('SELECT * FROM player_sessions WHERE session_id = $1', [sessionId]);
    const players = playersResult.rows;
    // 获取社区牌
    const communityCardsResult = await database_1.default.query('SELECT * FROM community_cards WHERE session_id = $1', [sessionId]);
    const communityCards = communityCardsResult.rows[0];
    return {
        session,
        players,
        communityCards
    };
};
exports.getGameStatus = getGameStatus;
// 执行游戏动作
const executeGameAction = async (sessionId, playerId, action) => {
    // 获取当前牌局状态
    const gameStatus = await (0, exports.getGameStatus)(sessionId);
    const { session, players, communityCards } = gameStatus;
    // 检查玩家是否在当前牌局中
    const currentPlayer = players.find((p) => p.player_id === playerId);
    if (!currentPlayer) {
        throw new Error('玩家不在当前牌局中');
    }
    // 检查玩家状态是否活跃
    if (currentPlayer.status !== 'active') {
        throw new Error('玩家当前无法行动');
    }
    // TODO: 检查是否轮到该玩家行动
    // TODO: 验证动作的合法性
    // 记录动作
    await database_1.default.query(`INSERT INTO actions (
      session_id, player_id, action_type, amount, round, created_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())`, [
        sessionId,
        playerId,
        action.action_type,
        action.amount || 0,
        session.current_round
    ]);
    // 更新玩家筹码和底池
    if (action.action_type === 'call' || action.action_type === 'raise' || action.action_type === 'all_in') {
        const amount = action.amount || 0;
        // 更新玩家已下注筹码
        await database_1.default.query('UPDATE player_sessions SET chips_in_pot = chips_in_pot + $1, chips_remaining = chips_remaining - $1 WHERE id = $2', [amount, currentPlayer.id]);
        // 更新底池大小
        await database_1.default.query('UPDATE game_sessions SET pot = pot + $1 WHERE id = $2', [amount, sessionId]);
    }
    else if (action.action_type === 'fold') {
        // 更新玩家状态为已弃牌
        await database_1.default.query('UPDATE player_sessions SET status = $1 WHERE id = $2', ['folded', currentPlayer.id]);
    }
    // TODO: 检查当前轮次是否结束
    // TODO: 进入下一轮或结束牌局
    // 获取更新后的游戏状态
    const updatedGameStatus = await (0, exports.getGameStatus)(sessionId);
    // 通过WebSocket广播游戏状态更新
    const wsEvent = {
        type: 'game_state_update',
        data: updatedGameStatus
    };
    // 广播给所有在房间内的玩家
    if (session.room_id) {
        const websocketService = (0, websocketInstance_1.getWebSocketService)();
        websocketService.broadcastToRoom(session.room_id, wsEvent);
    }
    return updatedGameStatus;
};
exports.executeGameAction = executeGameAction;
// 牌力评估函数
const evaluateHandStrength = (holeCards, communityCards) => {
    // TODO: 实现牌力评估算法
    // 返回0-1之间的数值，表示手牌强度
    return Math.random();
};
exports.evaluateHandStrength = evaluateHandStrength;
// 胜负判定
const determineWinner = async (sessionId) => {
    // TODO: 实现胜负判定算法
    // 1. 获取所有未弃牌玩家
    // 2. 评估每个玩家的手牌强度
    // 3. 确定获胜者
    // 4. 分配筹码
    // 5. 更新牌局状态
    return {
        winners: [],
        handStrengths: []
    };
};
exports.determineWinner = determineWinner;
//# sourceMappingURL=gameService.js.map