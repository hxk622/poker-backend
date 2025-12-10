"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const gameService_1 = require("../services/gameService");
// JWT验证中间件
const verifyToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        next();
    }
    catch (error) {
        res.status(401).json({ error: '无效的认证令牌' });
    }
};
const router = express_1.default.Router();
// 执行游戏动作
const executeGameAction = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const action = req.body;
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ error: '用户未认证' });
        }
        const gameStatus = await (0, gameService_1.executeGameAction)(sessionId, userId, action);
        res.status(200).json({
            message: '游戏动作执行成功',
            data: gameStatus
        });
    }
    catch (error) {
        res.status(500).json({ error: '服务器错误', details: error.message });
    }
};
// 获取牌局历史
const getGameHistory = async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: '服务器错误', details: error.message });
    }
};
// 获取游戏统计
const getGameStats = async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: '服务器错误', details: error.message });
    }
};
// 获取当前牌局状态
const getGameStatus = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ error: '用户未认证' });
        }
        const gameStatus = await (0, gameService_1.getGameStatus)(sessionId);
        res.status(200).json({
            message: '获取牌局状态成功',
            data: gameStatus
        });
    }
    catch (error) {
        res.status(500).json({ error: '服务器错误', details: error.message });
    }
};
// 开始新牌局
const startNewGameRoute = async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ error: '用户未认证' });
        }
        const gameSession = await (0, gameService_1.startNewGame)(roomId);
        res.status(200).json({
            message: '新牌局开始成功',
            data: gameSession
        });
    }
    catch (error) {
        res.status(500).json({ error: '服务器错误', details: error.message });
    }
};
// 注册路由
router.post('/:sessionId/actions', verifyToken, executeGameAction);
router.get('/:sessionId/history', verifyToken, getGameHistory);
router.get('/stats', verifyToken, getGameStats);
router.get('/:sessionId/status', verifyToken, getGameStatus);
router.post('/:roomId/start', verifyToken, startNewGameRoute);
exports.default = router;
//# sourceMappingURL=games.js.map