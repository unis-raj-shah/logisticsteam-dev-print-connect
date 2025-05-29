import {
    BASE_STRATEGY_PARAM_QUERY_DESCRIPTION,
    BASE_STRATEGY_PARAM_DISPATCH_DESCRIPTION,
} from '@/constants/autoSortingConstants';
import strategyService from '@/service/autoSortingStrategyService';

const strategyType = 'singleChuteStrategy';
const displayName = 'Single Chute';
const description = 'This strategy is used to assign a single chute to a job';

// 定义策略函数
async function strategy(item: any, params: any = {}) {
    // 分配不到格口,直接返回  分配到格口时返回{chuteNo:格口号,item:item}

    // 原来已分配过格口,继续使用原格口
    if (item.chuteNo) {
        return strategyService.getAssignedChuteByItem(item);
    }
    // 未分配格口，分配全新格口
    return await strategyService.getAssignedChuteByStrategyParams(strategyType, item, params, strategyService.filterChutesExcludeAssignableCondition);
}

// 定义策略入参描述
const paramDescription = {
    ...BASE_STRATEGY_PARAM_QUERY_DESCRIPTION,
    ...BASE_STRATEGY_PARAM_DISPATCH_DESCRIPTION,
    // 添加更多的参数及其描述
};

// 导出策略函数和参数描述
export default {
    strategyType: strategyType, // 策略类型,唯一标识
    displayName: displayName, // 展示的名称
    description: description, // 策略描述
    parameters: paramDescription, // 策略参数描述
    strategy: strategy, // 策略函数
};
