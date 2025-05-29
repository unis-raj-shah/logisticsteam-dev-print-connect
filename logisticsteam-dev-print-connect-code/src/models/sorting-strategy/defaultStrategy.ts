import {
    BASE_STRATEGY_PARAM_QUERY_DESCRIPTION,
    BASE_STRATEGY_PARAM_DISPATCH_DESCRIPTION,
    USER_DEFAULT_STRATEGY,
    ChuteTypeEnum,
    ChuteAllocationTypeEnum,
} from '@/constants/autoSortingConstants';
import {
    getAssignedChutes,
    getChuteAllocationByRoutName,
    getChuteAllocationsByType,
    getIdleChutesByTypeAndNotInChuteNos,
    getPackagesMonitor,
    searchJobItemList,
    getIdleChutesByTypeAndInChuteNos, getChuteListByChuteNoLike,
} from '@/db/autoSorting';
import _ from 'lodash';
import cache from '@/shared/cache';

const strategyType = USER_DEFAULT_STRATEGY.strategyType;
const displayName = 'Default';
const description = USER_DEFAULT_STRATEGY.description;

// 定义策略函数
async function strategy(item: any, params: any = {}) {
    // 分配route格口
    let assignedChute = await tryDistributionRouteChute(item, params);
    // 未分配到route格口，分配terminal格口
    if (_.isEmpty(assignedChute)) {
        assignedChute = await tryDistributionTerminalChute(item, params);
    }
    return assignedChute;
}

async function tryDistributionRouteChute(item: any, params: any) {
    // route是否配置固定格口
    const chuteAllocation = await getChuteAllocationByRoutName(item.chuteKey, ChuteAllocationTypeEnum.ROUTE);
    if (!_.isEmpty(chuteAllocation.fixedChuteNos)) {
        const fixedChuteNos = chuteAllocation.fixedChuteNos;
        const enableChutes = await getChuteListByChuteNoLike({ chuteNoIn: fixedChuteNos, isEnabled: 1 });
        if (!_.isEmpty(enableChutes)) {
            const idleChutes = await getIdleChutesByTypeAndInChuteNos(ChuteTypeEnum.ROUTE, fixedChuteNos, item.chuteKey);
            if (_.isEmpty(idleChutes)) return null;
            const idleChuteNos = _.map(idleChutes, 'chuteNo');
            const chuteNo = distributionChuteNo(item.chuteNo, idleChuteNos);
            return { chuteNo: chuteNo, item: item, type: ChuteTypeEnum.ROUTE };
        }
    }
    // 获取Route需要分配格口的数量
    const chuteNumber = await mustDistributionChuteNumber(params, item);
    if (_.eq(chuteNumber, 0)) return null;
    // 是否已经分配过格口
    const chutes = await getAssignedChutes(item.chuteKey, ChuteTypeEnum.ROUTE);
    let chuteNos;
    // 需要分配格口
    if (_.size(chutes) < chuteNumber) {
        const packageMonitors = await getPackagesMonitor({ trackingNo: item.barcode });
        let idleChutes = await getNormalAvailableChutes(params, item.waveNo, isMustDistributionItem(chuteAllocation, params, packageMonitors));
        if (!_.isEmpty(params.chuteNoIn)) {
            idleChutes = _.filter(idleChutes, (o: any) => _.includes(params.chuteNoIn, o.chuteNo));
        } else if (!_.isEmpty(params.chuteNoNotIn)) {
            idleChutes = _.filter(idleChutes, (o: any) => !_.includes(params.chuteNoNotIn, o.chuteNo));
        }
        // 没有可用格口
        if (_.isEmpty(idleChutes) && _.isEmpty(chutes)) return null;
        if (!_.isEmpty(idleChutes)) {
            const key = _.keyBy(idleChutes, 'chuteNo');
            const lastGroup = cache.getCache('lastGroup') || { id: -1, name: '' };
            if (_.eq(params.allocateGroupBy, 'Group ID')) {
                const groupIds = _.orderBy(_.uniq(_.map(idleChutes, 'groupId')), (o: string) => o, [params.groupSortBy]);
                const curId = _.findIndex(groupIds, (id: number) => id == lastGroup.id) + 2;
                const nextId = curId > _.size(groupIds) ? (curId - _.size(groupIds)) : curId;
                idleChutes = _.filter(idleChutes, (o: any) => o.groupId == groupIds[nextId - 1]);
            } else if (_.eq(params.allocateGroupBy, 'Group Name')) {
                const groupNames = _.orderBy(_.uniq(_.map(idleChutes, 'groupName')), (o: string) => o, [params.groupSortBy]);
                const curId = _.findIndex(groupNames, (name: string) => name == lastGroup.name) + 2;
                const nextId = curId > _.size(groupNames) ? (curId - _.size(groupNames)) : curId;
                idleChutes = _.filter(idleChutes, (o: any) => o.groupName == groupNames[nextId - 1]);
            }
            const byStrList = [];
            const orderList = [];
            if (_.eq(params.allocateChuteBy, 'Chute ID')) {
                byStrList.push('id');
                orderList.push(params.chuteSortBy);
            } else if (_.eq(params.allocateChuteBy, 'Chute No')) {
                byStrList.push('chuteNo');
                orderList.push(params.chuteSortBy);
            }
            if (!_.isEmpty(byStrList)) {
                idleChutes = _.orderBy(idleChutes, byStrList, orderList);
            }
            chuteNos = _.map(idleChutes, 'chuteNo');
            const chuteNo = distributionChuteNo(item.chuteNo, chuteNos);
            cache.setCache('lastGroup', { id: key[chuteNo].groupId, name: key[chuteNo].groupName });
            return { chuteNo: chuteNo, item: item, type: ChuteTypeEnum.ROUTE };
        }
    }
    if (_.isEmpty(chutes)) return null;
    chuteNos = _.map(chutes, 'chuteNo');
    const chuteNo = distributionChuteNo(item.chuteNo, chuteNos);
    return { chuteNo: chuteNo, item: item, type: ChuteTypeEnum.ROUTE };
}

function isMustDistributionItem(chuteAllocation: any, params: any, packageMonitors: any): boolean {
    return _.eq(chuteAllocation.isChuteNeeded, 1) || (!_.isEmpty(packageMonitors) && params.chuteNeededForResortedPkgs);
}

async function tryDistributionTerminalChute(item: any, params: any) {
    // terminal是否配置固定格口
    const chuteAllocation = await getChuteAllocationByRoutName(item.terminal, ChuteAllocationTypeEnum.TERMINAL);
    if (!_.isEmpty(chuteAllocation.fixedChuteNos)) {
        const fixedChuteNos = chuteAllocation.fixedChuteNos;
        const enableChutes = await getChuteListByChuteNoLike({ chuteNoIn: fixedChuteNos, isEnabled: 1 });
        if (!_.isEmpty(enableChutes)) {
            const idleChutes = await getIdleChutesByTypeAndInChuteNos(ChuteTypeEnum.TERMINAL, fixedChuteNos, item.terminal);
            if (_.isEmpty(idleChutes)) return null;
            const idleChuteNos = _.map(idleChutes, 'chuteNo');
            const chuteNo = distributionChuteNo(item.chuteNo, idleChuteNos);
            return { chuteNo: chuteNo, item: item, type: ChuteTypeEnum.TERMINAL };
        }
    }
    // 是否已经分配过格口
    const chutes = await getAssignedChutes(item.terminal, ChuteTypeEnum.TERMINAL);
    let chuteNos;
    // 需要分配格口
    if (_.isEmpty(chutes)) {
        let idleChutes = await getNormalAvailableTerminalChutes(params, item.waveNo, _.eq(chuteAllocation.isChuteNeeded, 1));
        if (!_.isEmpty(params.chuteNoIn)) {
            idleChutes = _.filter(idleChutes, (o: any) => _.includes(params.chuteNoIn, o.chuteNo));
        } else if (!_.isEmpty(params.chuteNoNotIn)) {
            idleChutes = _.filter(idleChutes, (o: any) => !_.includes(params.chuteNoNotIn, o.chuteNo));
        }
        if (_.isEmpty(idleChutes)) return null;
        else {
            const key = _.keyBy(idleChutes, 'chuteNo');
            const lastGroup = cache.getCache('lastGroup') || { id: -1, name: '' };
            if (_.eq(params.allocateGroupBy, 'Group ID')) {
                const groupIds = _.orderBy(_.uniq(_.map(idleChutes, 'groupId')), (o: string) => o, [params.groupSortBy]);
                const curId = _.findIndex(groupIds, (id: number) => id == lastGroup.id) + 2;
                const nextId = curId > _.size(groupIds) ? (curId - _.size(groupIds)) : curId;
                idleChutes = _.filter(idleChutes, (o: any) => o.groupId == groupIds[nextId - 1]);
            } else if (_.eq(params.allocateGroupBy, 'Group Name')) {
                const groupNames = _.orderBy(_.uniq(_.map(idleChutes, 'groupName')), (o: string) => o, [params.groupSortBy]);
                const curId = _.findIndex(groupNames, (name: string) => name == lastGroup.name) + 2;
                const nextId = curId > _.size(groupNames) ? (curId - _.size(groupNames)) : curId;
                idleChutes = _.filter(idleChutes, (o: any) => o.groupName == groupNames[nextId - 1]);
            }
            const byStrList = [];
            const orderList = [];
            if (_.eq(params.allocateChuteBy, 'Chute ID')) {
                byStrList.push('id');
                orderList.push(params.chuteSortBy);
            } else if (_.eq(params.allocateChuteBy, 'Chute No')) {
                byStrList.push('chuteNo');
                orderList.push(params.chuteSortBy);
            }
            if (!_.isEmpty(byStrList)) {
                idleChutes = _.orderBy(idleChutes, byStrList, orderList);
            }
            chuteNos = _.map(idleChutes, 'chuteNo');
            const chuteNo = distributionChuteNo(item.chuteNo, chuteNos);
            cache.setCache('lastGroup', { id: key[chuteNo].groupId, name: key[chuteNo].groupName });
            return { chuteNo: chuteNo, item: item, type: ChuteTypeEnum.TERMINAL };
        }
    } else {
        chuteNos = _.map(chutes, 'chuteNo');
        const chuteNo = distributionChuteNo(item.chuteNo, chuteNos);
        return { chuteNo: chuteNo, item: item, type: ChuteTypeEnum.TERMINAL };
    }
}

async function mustDistributionChuteNumber(params: any, item: any) {
    if (params.multipleChuteForRoute) {
        const items = await searchJobItemList(item.waveNo, item.chuteKey);
        const qty = _.sumBy(items, 'qty');
        if (_.eq(qty, 0)) return 0;
        const assignedQty = _.sumBy(items, 'assignedQty');
        return Math.ceil((qty - assignedQty) / params.thresholdPackageQty * params.chuteAllocationQty);
    }
    return 1;
}

function distributionChuteNo(lastChuteNo: string, assignableChutes: string[]) {
    if (lastChuteNo) {
        const curId = _.findIndex(assignableChutes, (no: string) => no == lastChuteNo) + 2;
        const nextId = curId > _.size(assignableChutes) ? (curId - _.size(assignableChutes)) : curId;
        return assignableChutes[nextId - 1];
    } else {
        return _.head(assignableChutes);
    }
}

async function getNormalAvailableChutes(params: any = {}, waveNo: string, isChuteNeeded: boolean) {
    const chuteAllocations = await getChuteAllocationsByType(ChuteAllocationTypeEnum.ROUTE);
    console.log('getNormalAvailableChutes:', JSON.stringify(chuteAllocations));
    let fixedChuteNos: string[] = [];
    let stillAllocatedChuteNumber = 0;
    for (const allocation of chuteAllocations) {
        if (!_.isEmpty(allocation.fixedChuteNos)) {
            fixedChuteNos = _.union(fixedChuteNos, allocation.fixedChuteNos);
        } else if (!isChuteNeeded && _.eq(allocation.isChuteNeeded, 1)) {
            const chuteNumber = await mustDistributionChuteNumber(params, { waveNo: waveNo, chuteKey: allocation.routeName });
            const chutes = await getAssignedChutes(allocation.routeName, ChuteTypeEnum.ROUTE);
            const defNumber = chuteNumber - _.size(chutes);
            if (defNumber <= 0) continue;
            stillAllocatedChuteNumber += defNumber;
        }
    }
    const chutes = await getIdleChutesByTypeAndNotInChuteNos(ChuteTypeEnum.ROUTE, fixedChuteNos);
    if (_.size(chutes) <= stillAllocatedChuteNumber) return [];
    return chutes;
}

async function getNormalAvailableTerminalChutes(params: any = {}, waveNo: string, isChuteNeeded: boolean) {
    const chuteAllocations = await getChuteAllocationsByType(ChuteAllocationTypeEnum.TERMINAL);
    console.log('getNormalAvailableTerminalChutes:', JSON.stringify(chuteAllocations));
    let fixedChuteNos: string[] = [];
    let stillAllocatedChuteNumber = 0;
    for (const allocation of chuteAllocations) {
        if (!_.isEmpty(allocation.fixedChuteNos)) {
            fixedChuteNos = _.union(fixedChuteNos, allocation.fixedChuteNos);
        } else if (!isChuteNeeded && _.eq(allocation.isChuteNeeded, 1)) {
            const chutes = await getAssignedChutes(allocation.routeName, ChuteTypeEnum.TERMINAL);
            if (_.isEmpty(chutes)) stillAllocatedChuteNumber++;
        }
    }
    const chutes = await getIdleChutesByTypeAndNotInChuteNos(ChuteTypeEnum.TERMINAL, fixedChuteNos);
    if (_.size(chutes) <= stillAllocatedChuteNumber) return [];
    return chutes;
}

// 定义策略入参描述
const paramDescription = {
    ...BASE_STRATEGY_PARAM_QUERY_DESCRIPTION,
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
