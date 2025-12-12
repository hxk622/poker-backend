import axios from 'axios';
import jwt from 'jsonwebtoken';
import { Card } from '../src/types';

// API基础URL
const API_BASE_URL = 'http://localhost:3000/api';

// 生成测试用的JWT令牌
const generateToken = (userId: string): string => {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
};

// 测试AI API功能
async function testAIApi() {
  console.log('=== AI API测试开始 ===\n');

  // 生成测试令牌
  const token = generateToken('test-user-123');
  
  // 创建axios实例
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`
    },
    httpAgent: new (require('http').Agent)({ keepAlive: false })
  });

  // 测试1: 设置AI模式
  console.log('1. 测试设置AI模式:');
  try {
    const response = await api.post('/ai/test-game-id/set-mode', {
      style: 'gto'
    });
    console.log('✅ 设置AI模式成功:', response.data.message);
    console.log('   当前模式:', response.data.style);
  } catch (error) {
    console.error('❌ 设置AI模式失败:', error);
  }
  console.log('');

  // 测试2: 获取AI对手列表
  console.log('2. 测试获取AI对手列表:');
  try {
    const response = await api.get('/ai/opponents');
    console.log(`✅ 获取AI对手列表成功，共 ${response.data.length} 个对手:`);
    response.data.forEach((opponent: any, index: number) => {
      console.log(`   ${index + 1}. ${opponent.name} (${opponent.level}, ${opponent.playingStyle})`);
    });
  } catch (error) {
    console.error('❌ 获取AI对手列表失败:', error);
  }
  console.log('');

  // 测试3: 获取AI对手手牌
  console.log('3. 测试获取AI对手手牌:');
  try {
    const response = await api.get('/ai/opponent/intermediate-1/hand');
    console.log('✅ 获取AI对手手牌成功:');
    console.log(`   对手ID: ${response.data.opponentId}`);
    console.log(`   手牌: ${response.data.hand[0].rank}${response.data.hand[0].suit} ${response.data.hand[1].rank}${response.data.hand[1].suit}`);
  } catch (error) {
    console.error('❌ 获取AI对手手牌失败:', error);
  }
  console.log('');

  // 测试4: 获取AI对手决策
  console.log('4. 测试获取AI对手决策:');
  try {
    const opponentState = {
      opponentId: 'advanced-1',
      hand: [{ suit: 'hearts', rank: 'A' }, { suit: 'hearts', rank: 'K' }],
      stackSize: 1000,
      betHistory: [{ action_type: 'call', amount: 50 }],
      position: 2,
      folded: false
    };

    const communityCards: Card[] = [
      { suit: 'hearts', rank: 'Q' },
      { suit: 'hearts', rank: 'J' },
      { suit: 'hearts', rank: '10' }
    ];

    const response = await api.post('/ai/opponent/decision', {
      opponentState,
      communityCards,
      potSize: 200,
      currentBet: 50,
      minRaise: 100
    });

    console.log('✅ 获取AI对手决策成功:');
    console.log(`   对手ID: ${response.data.opponentId}`);
    console.log(`   决策: ${response.data.action}, 金额: ${response.data.amount}`);
    console.log(`   决策时间: ${response.data.timestamp}`);
  } catch (error) {
    console.error('❌ 获取AI对手决策失败:', error);
  }

  console.log('\n=== AI API测试结束 ===');
}

// 运行测试
testAIApi().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});