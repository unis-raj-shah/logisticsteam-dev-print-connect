import {
    BASE_STRATEGY_PARAM_QUERY_DESCRIPTION,
    BASE_STRATEGY_PARAM_DISPATCH_DESCRIPTION,
    UserStrategyTypeEnum
} from '@/constants/autoSortingConstants';
import defaultStrategy from '@/models/sorting-strategy/defaultStrategy';
const strategyType = UserStrategyTypeEnum.MANUAL_CHUTE_STRATEGY;
const displayName = 'Manual Chute';
const description = 'Manual too many chutes where the quantity of chuteKey exceeds a specified value, distributing evenly across multiple chutes.';

// 定义策略函数
async function strategy(item: any, params: any = {}) {
    return await defaultStrategy.strategy(item, params);
}

// 定义策略入参描述
const paramDescription = {
    ...BASE_STRATEGY_PARAM_DISPATCH_DESCRIPTION,
    ...BASE_STRATEGY_PARAM_QUERY_DESCRIPTION
    // 添加更多的参数及其描述
};

// 导出策略函数和参数描述
export default {
    strategyType: strategyType, // 策略名称,唯一标识
    displayName: displayName, // 展示的名称
    description: description, // 策略描述
    parameters: paramDescription, // 策略参数描述
    strategy: strategy, // 策略函数
};
