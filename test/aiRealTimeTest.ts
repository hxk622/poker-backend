import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { AIAnalysisEvent, RealTimeAnalysisToggleEvent } from '../src/types';

// 测试实时AI分析功能
async function testRealTimeAIAnalysis() {
  console.log('Testing real-time AI analysis functionality...');
  
  // 模拟用户信息
  const userId = 'test-user-123';
  const sessionId = 'test-session-456';
  
  // 生成JWT令牌
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
  
  try {
    // 连接到WebSocket服务器，传递JWT令牌
    const ws = new WebSocket('ws://localhost:3000', [token]);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connection established and authenticated');
      
      // 1. 测试实时分析开关
      const toggleEvent: RealTimeAnalysisToggleEvent = {
        type: 'real_time_analysis_toggle',
        data: {
          enabled: true,
          style: 'gto'
        }
      };
      
      ws.send(JSON.stringify(toggleEvent));
      console.log('📤 Sent real-time analysis toggle event');
      
      // 2. 测试游戏数据更新
      setTimeout(() => {
        const gameDataEvent = {
          type: 'update_game_data',
          data: {
            sessionId,
            holeCards: [{ suit: 'hearts', rank: 'A' }, { suit: 'hearts', rank: 'K' }],
            communityCards: [{ suit: 'hearts', rank: 'Q' }, { suit: 'hearts', rank: 'J' }, { suit: 'hearts', rank: '10' }],
            betHistory: [
              { action_type: 'call', amount: 10, user_id: 'opponent-1', created_at: new Date() }
            ],
            potSize: 30,
            currentBet: 20,
            stackSize: 1000
          }
        };
        
        ws.send(JSON.stringify(gameDataEvent));
        console.log('📤 Sent game data update');
      }, 1000);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📥 Received message:', JSON.stringify(message, null, 2));
      
      // 检查是否收到AI分析结果
      if (message.type === 'ai_analysis') {
        const aiAnalysis = message as AIAnalysisEvent;
        console.log('✅ Received AI analysis result:', {
          handStrength: aiAnalysis.data.analysis.hand_strength,
          recommendedAction: aiAnalysis.data.suggestion.recommended_action,
          explanation: aiAnalysis.data.suggestion.explanation
        });
        
        // 测试完成，关闭连接
        setTimeout(() => {
          ws.close();
          console.log('🔌 WebSocket connection closed');
        }, 1000);
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
    
    ws.on('close', () => {
      console.log('✅ Test completed');
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// 运行测试
testRealTimeAIAnalysis();
