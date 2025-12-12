import axios from 'axios';
import http from 'http';
import jwt from 'jsonwebtoken';
import { AITrainingData } from '../src/types';

// 将字符串格式的牌转换为Card[]类型
const parseCards = (cardString: string): { suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'; rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' }[] => {
  const result: { suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'; rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' }[] = [];
  
  // 处理牌，注意处理'10'的情况
  let i = 0;
  while (i < cardString.length) {
    let rank: string;
    let suitChar: string;
    
    // 检查是否是'10'
    if (i + 2 < cardString.length && cardString[i] === '1' && cardString[i + 1] === '0') {
      rank = '10';
      suitChar = cardString[i + 2].toLowerCase();
      i += 3; // 跳过'10'和花色
    } else {
      rank = cardString[i];
      suitChar = cardString[i + 1].toLowerCase();
      i += 2; // 跳过单字符点数和花色
    }
    
    // 转换花色
    let suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    switch (suitChar) {
      case 'h': suit = 'hearts'; break;
      case 'd': suit = 'diamonds'; break;
      case 'c': suit = 'clubs'; break;
      case 's': suit = 'spades'; break;
      default: suit = 'hearts'; // 默认值
    }
    
    // 确保rank是有效的点数
    const validRanks: ('2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A')[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const validRank = validRanks.find(r => r === rank);
    
    if (validRank) {
      result.push({ suit, rank: validRank });
    }
  }
  
  return result;
};

// 创建JWT令牌用于测试
const createTestToken = () => {
  const testUser = {
    id: 'test-user-123',
    username: 'testuser',
    email: 'test@example.com'
  };
  
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.sign(testUser, JWT_SECRET, { expiresIn: '24h' });
};

// 测试AI训练API
async function testAITraining() {
  try {
    const token = createTestToken();
    const apiUrl = 'http://localhost:3000/api/ai/train';
    
    // 测试数据 - 模拟一个德州扑克训练样本
    const trainingData: AITrainingData = {
      userId: 'test-user-123',
      sessionId: 'test-session-456',
      hand: parseCards('AsKs'),
      communityCards: parseCards('2s3s4s'),
      betHistory: [
        { action_type: 'raise', amount: 500 },
        { action_type: 'call', amount: 500 }
      ],
      potSize: 1000,
      currentBet: 200,
      stackSize: 5000,
      actualAction: 'raise',
      result: 'win',
      profit: 800
    };
    
    console.log('发送训练数据到AI训练API...');
    console.log('训练数据:', JSON.stringify(trainingData, null, 2));
    
    // 发送POST请求到训练API
    const response = await axios.post(apiUrl, { trainingData }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      httpAgent: new http.Agent({ keepAlive: false })
    });
    
    console.log('\nAI训练API响应:', JSON.stringify(response.data, null, 2));
    
    // 验证响应
    if (response.status === 200) {
      console.log('\n✅ AI训练API测试成功!');
      console.log('训练ID:', response.data.trainingId);
      
      // 验证返回的指标
      if (response.data.metrics) {
        console.log('\n训练指标:');
        console.log('准确率:', response.data.metrics.accuracy);
        console.log('精确率:', response.data.metrics.precision);
        console.log('召回率:', response.data.metrics.recall);
        console.log('F1分数:', response.data.metrics.f1Score);
      }
    } else {
      console.error('❌ AI训练API测试失败!');
      console.error('错误信息:', response.data.error);
    }
    
  } catch (error: any) {
    console.error('❌ 测试过程中发生错误:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('未收到响应:', error.request);
    } else {
      console.error('请求错误:', error.message);
    }
  }
}

// 测试批量训练功能
async function testBatchAITraining() {
  try {
    const token = createTestToken();
    const apiUrl = 'http://localhost:3000/api/ai/train';
    
    // 批量训练数据 - 多个德州扑克训练样本
    const batchTrainingData: AITrainingData[] = [
      {
        userId: 'test-user-123',
        sessionId: 'test-session-456',
        hand: parseCards('AsKs'),
        communityCards: parseCards('2s3s4s'),
        betHistory: [
          { action_type: 'raise', amount: 500 },
          { action_type: 'call', amount: 500 }
        ],
        potSize: 1000,
        currentBet: 200,
        stackSize: 5000,
        actualAction: 'raise',
        result: 'win',
        profit: 800
      },
      {
        userId: 'test-user-123',
        sessionId: 'test-session-789',
        hand: parseCards('QdJd'),
        communityCards: parseCards('Td9d8d'),
        betHistory: [
          { action_type: 'call', amount: 150 },
          { action_type: 'check' }
        ],
        potSize: 800,
        currentBet: 150,
        stackSize: 4000,
        actualAction: 'call',
        result: 'lose',
        profit: -150
      }
    ];
    
    console.log('\n\n=== 测试批量训练功能 ===');
    console.log('发送批量训练数据到AI训练API...');
    console.log('训练数据数量:', batchTrainingData.length);
    
    // 发送POST请求到训练API
    const response = await axios.post(apiUrl, { trainingData: batchTrainingData }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      httpAgent: new http.Agent({ keepAlive: false })
    });
    
    console.log('\nAI训练API批量响应:', JSON.stringify(response.data, null, 2));
    
    // 验证响应
    if (response.status === 200) {
      console.log('\n✅ AI批量训练API测试成功!');
      console.log('训练ID:', response.data.trainingId);
      
      // 验证返回的指标
      if (response.data.metrics) {
        console.log('\n批量训练指标:');
        console.log('准确率:', response.data.metrics.accuracy);
        console.log('精确率:', response.data.metrics.precision);
        console.log('召回率:', response.data.metrics.recall);
        console.log('F1分数:', response.data.metrics.f1Score);
      }
    } else {
      console.error('❌ AI批量训练API测试失败!');
      console.error('错误信息:', response.data.error);
    }
    
  } catch (error: any) {
    console.error('❌ 批量测试过程中发生错误:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('未收到响应:', error.request);
    } else {
      console.error('请求错误:', error.message);
    }
  }
}

// 运行测试
async function runTests() {
  console.log('=== AI训练API测试开始 ===');
  await testAITraining();
  await testBatchAITraining();
  console.log('\n=== AI训练API测试结束 ===');
}

runTests();
