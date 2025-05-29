import {
    BASE_STRATEGY_PARAM_QUERY_DESCRIPTION,
    BASE_STRATEGY_PARAM_DISPATCH_DESCRIPTION,
} from '@/constants/autoSortingConstants';
import logger from '@/service/autoSortingLogService';
import strategyService from '@/service/autoSortingStrategyService';

const strategyType = 'balanceChuteStrategy';
const displayName = 'Balance Chute';
const description = 'Balance too many chutes where the quantity of chuteKey exceeds a specified value, distributing evenly across multiple chutes.';

// 定义策略函数
async function strategy(item: any, params: any = {}) {
    // 未设置条件,直接返回
    if (!params.jobQtyGreaterThen || !params.allocateChuteQuantity) return;

    // 分配不到格口,直接返回  分配到格口时返回{chuteNo:格口号,item:item}

    const jobItemCount = item.jobQty;
    if (jobItemCount < params.jobQtyGreaterThen) return;
    logger.info(`jobItemCount ${jobItemCount} Executing ${strategyType}  item:${JSON.stringify(item)}`);

    // 原来已分配过格口,继续使用原格口
    if (item.chuteNo) {
        const allocateChuteNos = item.chuteNos ? item.chuteNos.split(',') : [];
        const currentChuteNo = item.chuteNo;
        // 只有已分配过N个格口后才轮换使用已分配的格口
        if (allocateChuteNos.length >= params.allocateChuteQuantity) {
            const index = allocateChuteNos.indexOf(currentChuteNo);
            const nextIndex = (index + 1) % allocateChuteNos.length;
            const nextChuteNo = allocateChuteNos[nextIndex];
            return strategyService.getAssignedChuteByChuteNoAndItem(nextChuteNo, item);
        }
    }

    // 未分配格口，分配全新格口
    return await strategyService.getAssignedChuteByStrategyParams(strategyType, item, params, strategyService.filterChutesExcludeAssignableCondition);
}

// 定义策略入参描述
const paramDescription = {
    ...BASE_STRATEGY_PARAM_QUERY_DESCRIPTION,
    jobQtyGreaterThen: {
        description: 'When Job Qty Greater Then',
        type: 'number',
        required: true,
    },
    allocateChuteQuantity: {
        description: 'Allocate Chute Quantity',
        type: 'number',
        required: true,
    },
    ...BASE_STRATEGY_PARAM_DISPATCH_DESCRIPTION,

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
