"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const userService_1 = require("../services/userService");
const router = express_1.default.Router();
// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// 中间件：验证JWT令牌
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: '未提供令牌' });
    }
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '令牌无效' });
        }
        // 将用户ID存储在请求对象中
        req.user = user;
        next();
    });
};
// 用户注册
router.post('/register', async (req, res) => {
    try {
        const input = req.body;
        const user = await (0, userService_1.registerUser)(input);
        res.status(201).json({ message: '用户注册成功', user });
    }
    catch (error) {
        res.status(400).json({ error: error.message || '注册失败' });
    }
});
// 用户登录
router.post('/login', async (req, res) => {
    try {
        const input = req.body;
        const { user, token } = await (0, userService_1.loginUser)(input);
        res.status(200).json({ message: '登录成功', user, token });
    }
    catch (error) {
        res.status(401).json({ error: error.message || '登录失败' });
    }
});
// 获取用户资料
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await (0, userService_1.getUserById)(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.status(200).json({ message: '获取用户资料成功', user });
    }
    catch (error) {
        res.status(401).json({ error: error.message || '获取用户资料失败' });
    }
});
// 更新用户资料
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const data = req.body;
        const updatedUser = await (0, userService_1.updateUserProfile)(userId, data);
        res.status(200).json({ message: '更新用户资料成功', user: updatedUser });
    }
    catch (error) {
        res.status(400).json({ error: error.message || '更新用户资料失败' });
    }
});
// 获取用户统计数据
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const stats = await (0, userService_1.getUserStats)(userId);
        res.status(200).json({ message: '获取用户统计数据成功', stats });
    }
    catch (error) {
        res.status(400).json({ error: error.message || '获取用户统计数据失败' });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map