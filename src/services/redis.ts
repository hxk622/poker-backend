import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// 创建Redis连接
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0, // 默认数据库
  retryStrategy: (times) => {
    // 重试策略：每次重试的间隔时间递增
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: null, // 无限重试
});

// 测试Redis连接
redis.ping()
  .then(() => {
    console.log('✅ Redis连接成功！');
  })
  .catch(err => {
    console.error('❌ Redis连接失败:', err.message);
    console.log('ℹ️  Redis服务可选，应用将继续运行...');
  });

// 监听Redis错误事件
redis.on('error', (err) => {
  console.error('❌ Redis错误:', err.message);
});

export default redis;
