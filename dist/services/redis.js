"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// 创建Redis连接
const redis = new ioredis_1.default({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: 0, // 默认数据库
});
// 测试Redis连接
redis.ping()
    .then(() => {
    console.log('✅ Redis连接成功！');
})
    .catch(err => {
    console.error('❌ Redis连接失败:', err.message);
});
exports.default = redis;
//# sourceMappingURL=redis.js.map