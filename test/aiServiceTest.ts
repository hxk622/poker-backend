import { AIService } from '../src/services/aiService';
import { Card, GameAction } from '../src/types';

// 创建AI服务实例
const aiService = AIService.getInstance();

// 测试AI服务的各种功能
async function testAIService() {
  console.log('=== AI服务单元测试开始 ===\n');

  // 测试1: 获取可用对手
  console.log('1. 测试获取可用对手:');
  try {
    const opponents = aiService.getAvailableOpponents();
    console.log(`✅ 获取到 ${opponents.length} 个AI对手:`);
    opponents.forEach(opponent => {
      console.log(`   - ${opponent.name} (${opponent.level}, ${opponent.playingStyle})`);
    });
  } catch (error) {
    console.error('❌ 获取可用对手失败:', error);
  }
  console.log('');

  // 测试2: 根据ID获取对手
  console.log('2. 测试根据ID获取对手:');
  try {
    const opponent = aiService.getOpponentById('beginner-1');
    if (opponent) {
      console.log(`✅ 获取到对手: ${opponent.name}`);
      console.log(`   水平: ${opponent.level}, 风格: ${opponent.playingStyle}`);
      console.log(`   诈唬频率: ${opponent.bluffFrequency}, 跟注频率: ${opponent.callFrequency}`);
    } else {
      console.error('❌ 对手不存在');
    }
  } catch (error) {
    console.error('❌ 根据ID获取对手失败:', error);
  }
  console.log('');

  // 测试3: 生成AI对手手牌
  console.log('3. 测试生成AI对手手牌:');
  try {
    const opponent = aiService.getOpponentById('intermediate-1');
    if (opponent) {
      const hand = aiService.generateAIOpponentHand(opponent);
      console.log(`✅ 为对手 ${opponent.name} 生成手牌:`);
      console.log(`   ${hand[0].rank}${hand[0].suit} ${hand[1].rank}${hand[1].suit}`);
      console.log(`   (手牌范围包含 ${opponent.handRange.length} 种组合)`);
    }
  } catch (error) {
    console.error('❌ 生成AI对手手牌失败:', error);
  }
  console.log('');

  // 测试4: 牌力计算
  console.log('4. 测试牌力计算:');
  try {
    // 皇家同花顺 (最高牌力)
    const royalFlushHand: Card[] = [
      { suit: 'hearts', rank: 'A' },
      { suit: 'hearts', rank: 'K' }
    ];
    const royalFlushCommunity: Card[] = [
      { suit: 'hearts', rank: 'Q' },
      { suit: 'hearts', rank: 'J' },
      { suit: 'hearts', rank: '10' }
    ];
    const royalFlushStrength = aiService['calculateHandStrength'](royalFlushHand, royalFlushCommunity);
    console.log(`   皇家同花顺牌力: ${(royalFlushStrength * 100).toFixed(2)}%`);

    // 四条 (很强的牌力)
    const fourOfAKindHand: Card[] = [
      { suit: 'spades', rank: 'A' },
      { suit: 'hearts', rank: 'A' }
    ];
    const fourOfAKindCommunity: Card[] = [
      { suit: 'diamonds', rank: 'A' },
      { suit: 'clubs', rank: 'A' },
      { suit: 'spades', rank: 'K' }
    ];
    const fourOfAKindStrength = aiService['calculateHandStrength'](fourOfAKindHand, fourOfAKindCommunity);
    console.log(`   四条牌力: ${(fourOfAKindStrength * 100).toFixed(2)}%`);

    // 高牌 (较弱的牌力)
    const highCardHand: Card[] = [
      { suit: 'spades', rank: 'K' },
      { suit: 'hearts', rank: 'J' }
    ];
    const highCardCommunity: Card[] = [
      { suit: 'diamonds', rank: '2' },
      { suit: 'clubs', rank: '3' },
      { suit: 'spades', rank: '5' }
    ];
    const highCardStrength = aiService['calculateHandStrength'](highCardHand, highCardCommunity);
    console.log(`   高牌牌力: ${(highCardStrength * 100).toFixed(2)}%`);

    console.log('✅ 牌力计算测试完成');
  } catch (error) {
    console.error('❌ 牌力计算测试失败:', error);
  }
  console.log('');

  // 测试5: 底池赔率计算
  console.log('5. 测试底池赔率计算:');
  try {
    const potOdds1 = aiService['calculatePotOdds'](100, 20);
    console.log(`   底池 $100, 需跟注 $20, 赔率: ${potOdds1.toFixed(2)}:1`);

    const potOdds2 = aiService['calculatePotOdds'](500, 100);
    console.log(`   底池 $500, 需跟注 $100, 赔率: ${potOdds2.toFixed(2)}:1`);

    const potOdds3 = aiService['calculatePotOdds'](200, 50);
    console.log(`   底池 $200, 需跟注 $50, 赔率: ${potOdds3.toFixed(2)}:1`);

    console.log('✅ 底池赔率计算测试完成');
  } catch (error) {
    console.error('❌ 底池赔率计算测试失败:', error);
  }
  console.log('');

  // 测试6: AI对手决策
  console.log('6. 测试AI对手决策:');
  try {
    const opponent = aiService.getOpponentById('advanced-1');
    if (opponent) {
      const opponentState = {
        opponent,
        hand: [{ suit: 'hearts' as const, rank: 'A' as const }, { suit: 'hearts' as const, rank: 'K' as const }],
        stackSize: 1000,
        betHistory: [{ action_type: 'call' as const, amount: 50 }],
        position: 2,
        folded: false
      };

      const communityCards: Card[] = [
        { suit: 'hearts' as const, rank: 'Q' as const },
        { suit: 'hearts' as const, rank: 'J' as const },
        { suit: 'hearts' as const, rank: '10' as const }
      ];

      const decision = aiService.makeAIDecision(opponentState, communityCards, 200, 50, 100);
      console.log(`   AI对手 ${opponent.name} 的决策:`);
      console.log(`   动作: ${decision.action}, 金额: ${decision.amount}`);
      console.log('✅ AI对手决策测试完成');
    }
  } catch (error) {
    console.error('❌ AI对手决策测试失败:', error);
  }

  console.log('\n=== AI服务单元测试结束 ===');
}

// 运行测试
testAIService().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});