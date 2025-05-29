import _ from 'lodash';
import logger from '@/service/autoSortingLogService';
import util from '@/service/utilService';
import strategies from '@/models/sorting-strategy/index';
import { LogNameEnum, LogTypeEnum, USER_DEFAULT_STRATEGY } from '@/constants/autoSortingConstants';
import {
    getIdleChutes,
    getAllChutesByCache,
    getIdleChutesByCache,
    recordExceptionLog,
    updateChuteBindingAssignedStatus, updateChuteBindingAssignedStatusCache,
} from '@/db/autoSorting';
import LockService from '@/service/lockService';

class AutoSortingStrategyService {
    fillDefaultParamsIfEmpty(params: any, paramDescription: any) {
        if (!params) params = {};
        // 遍历参数描述中的每个属性
        for (const paramName in paramDescription) {
            // @ts-ignore
            if (params[paramName] === undefined && paramDescription[paramName].default !== undefined) {
                // 如果参数对象中未定义属性值且参数描述中有默认值，则使用默认值填充参数
                // @ts-ignore
                params[paramName] = paramDescription[paramName].default;
            }
        }
    }

    getChuteNoSqlByStrategyParams(params: any) {
        let sql = '';
        if (params.chuteNoBegin) {
            sql += ` and chuteNoInt >= ${params.chuteNoBegin}`;
        }
        if (params.chuteNoEnd) {
            sql += ` and chuteNoInt <= ${params.chuteNoEnd}`;
        }
        if (!_.isEmpty(params.chuteNoIn)) {
            sql += ` and chuteNoInt in (${params.chuteNoIn.join(',')})`;
        }
        if (!_.isEmpty(params.chuteNoNotIn)) {
            sql += ` and chuteNoInt not in (${params.chuteNoNotIn.join(',')})`;
        }
        return sql;
    }

    async getAssignedChuteByStrategyParams(strategyType: string, item: any, params: any, fn?: any, fromAllChute?: boolean) {
        const startTime = Date.now();
        try {
            if (fromAllChute) {
                return await this.getChuteInAllByStrategyParamsSync(strategyType, item, params, fn);
            } else {
                return await this.getIdleChutesByStrategyParamsSyncV2(strategyType, item, params, fn);
            }
        } finally {
            const endTime = Date.now();
            const elapsedMs = endTime - startTime;
            console.info(`getAssignedChuteByStrategyParams elapsed ${elapsedMs} ms`);
        }
    }

    async getChuteInAllByStrategyParamsSync(strategyType: string, item: any, params: any, fn?: any) {
        // 未分配格口，分配全新格口
        return await LockService.acquire('getChuteByStrategyParams', async () => {
            try {
                const chuteList = await getAllChutesByCache(params);
                if (!chuteList || _.isEmpty(chuteList)) {
                    return;
                }
                let chutes = _.cloneDeep(chuteList);
                this.sortChutesByBaseStrategyParams(chutes, params);
                if (fn) {
                    chutes = await fn(chutes, strategyType, item, params);
                }
                if (!chutes || _.isEmpty(chutes)) {
                    return;
                }
                // 找到后先更新格口绑定状态
                await updateChuteBindingAssignedStatusCache(chutes[0], item.chuteKey, item.jobId);
                return this.getAssignedChuteByChute(chutes[0], item);
            } catch (e: any) {
                logger.error(`Executing ${strategyType} error: ${e.stack}`);
                await recordExceptionLog({
                    logType: LogTypeEnum.STRATEGY,
                    logName: LogNameEnum.EXCEPTION,
                    message: e.message,
                    data: JSON.stringify(params),
                });
            }
        });
    }

    async getIdleChutesByStrategyParamsSyncV2(strategyType: string, item: any, params: any, fn?: any) {
        // 未分配格口，分配全新格口
        return await LockService.acquire('getChutesByStrategyParams', async () => {
            try {
                const chuteList = await getIdleChutesByCache(params);
                if (!chuteList || _.isEmpty(chuteList)) {
                    return;
                }
                let chutes = _.cloneDeep(chuteList);
                this.sortChutesByBaseStrategyParams(chutes, params);
                if (fn) {
                    console.log('fn before', chutes);
                    chutes = await fn(chutes, strategyType, item, params);
                    console.log('fn after', chutes);
                }
                if (!chutes || _.isEmpty(chutes)) {
                    return;
                }
                // 找到后先更新格口绑定状态
                await updateChuteBindingAssignedStatusCache(chutes[0], item.chuteKey, item.jobId);
                return this.getAssignedChuteByChute(chutes[0], item);
            } catch (e: any) {
                logger.error(`Executing ${strategyType} error: ${e.stack}`);
                await recordExceptionLog({
                    logType: LogTypeEnum.STRATEGY,
                    logName: LogNameEnum.EXCEPTION,
                    message: e.message,
                    data: JSON.stringify(params),
                });
            }
        });
    }


    async getAssignedChuteByStrategyParamsSync(strategyType: string, item: any, params: any, fn?: any) {
        // 未分配格口，分配全新格口
        return await LockService.acquire('getAssignedChuteByStrategyParams', async () => {
            try {
                const chuteNoSql = this.getChuteNoSqlByStrategyParams(params);
                let chuteList = await getIdleChutes(chuteNoSql);
                if (!chuteList || _.isEmpty(chuteList)) {
                    return;
                }
                this.sortChutesByBaseStrategyParams(chuteList, params);
                if (fn) {
                    chuteList = await fn(chuteList, strategyType, item, params);
                }
                if (!chuteList || _.isEmpty(chuteList)) {
                    return;
                }
                // 找到后先更新格口绑定状态
                await updateChuteBindingAssignedStatus(chuteList[0], item.chuteKey, item.jobId);
                return this.getAssignedChuteByChute(chuteList[0], item);
            } catch (e: any) {
                logger.error(`Executing ${strategyType} error: ${e.stack}`);
                await recordExceptionLog({
                    logType: LogTypeEnum.STRATEGY,
                    logName: LogNameEnum.EXCEPTION,
                    message: e.message,
                    data: JSON.stringify(params),
                });
            }
        });
    }

    sortItemsByBaseStrategyParams(items: any, params: any) {
        if (!params.jobOrderBy) return;

        if (params.jobOrderBy == '_random') {
            items = _.shuffle(items);
        } else {
            items = _.orderBy(items, params.jobOrderBy, params.jobSortOrder);
        }
    }

    sortChutesByBaseStrategyParams(chutes: any, params: any) {
        if (!params.chuteOrderBy) return;

        if (params.chuteOrderBy == '_random') {
            chutes = _.shuffle(chutes);
        } else {
            chutes = _.orderBy(chutes, params.chuteOrderBy, params.chuteSortOrder);
        }
    }

    filterChutesExcludeAssignableCondition(chutes: any, strategyType: string, item: any, params: any) {
        return _.filter(chutes, (chute: any) => !chute.assignableCondition);
    }

    getAssignedChuteByItem(item: any) {
        return { chuteNo: item.chuteNo, item: item };
    }

    getAssignedChuteByChuteNoAndItem(chuteNo: any, item: any) {
        return { chuteNo: chuteNo, item: item };
    }

    getAssignedChuteByChute(chute: any, item: any) {
        return { chuteNo: chute.chuteNo, item: item };
    }

    getStrategiesExcludeDefault() {
        console.log('strategies', strategies);
        const filteredStrategies = _.pickBy(strategies, (strategy: any) => strategy.strategyType !== USER_DEFAULT_STRATEGY.strategyType);
        console.log('getStrategiesExcludeDefault', filteredStrategies);
        return filteredStrategies;
    }

    fillParamsAndSortItems(strategy: any, params: any, items: any) {
        // 在这里执行策略逻辑，items为查找到barcode的所有未完成的job, params 是传入的参数
        logger.info(`fillParamsAndSortItems ${strategy.strategyType} with params: ${JSON.stringify(params)}`);
        this.fillDefaultParamsIfEmpty(params, strategy.paramDescription);
        //logger.info(`Executing ${strategy.strategyType} with fillDefaultParamsIfEmpty: ${JSON.stringify(items)} ${JSON.stringify(params)}`);

        // 根据 params.orderBy 和 params.sortOrder 排序 items
        this.sortItemsByBaseStrategyParams(items, params);
        // logger.info(`Executing ${strategy.strategyType} with sortItemsByBaseStrategyParams: ${JSON.stringify(items)}`);
    }

    async tryExecuteStrategy(strategyFunction: any, businessStrategy: any, params: any, pendingItem: any) {
        const successResults = [];
        console.log('firstItem', pendingItem);
        // 执行策略函数
        try {
            const result = await strategyFunction(pendingItem, params);
            // 如果策略函数返回结果，则结束执行，返回结果
            if (result) {
                // 满足策略条件且已找到格口的
                successResults.push(result);
                console.log('successResults', result);
                return result;
            }
        } catch (e: any) {
            logger.error(`Executing ${businessStrategy.strategyName} ${businessStrategy.strategyType} params:${JSON.stringify(params)} ${e.stack}`);
            await recordExceptionLog({
                logType: LogTypeEnum.STRATEGY,
                logName: LogNameEnum.EXCEPTION,
                message: e.message,
                data: JSON.stringify(params),
            });
            throw new Error(`Executing ${businessStrategy.strategyName} ${businessStrategy.strategyType} error: ${e.message}`);
        }
        return null;
    }

    async executeStrategy(businessStrategies: any, items: any) {
        if (_.isEmpty(items)) return;
        const pendingItem = items[0];
        // 遍历执行策略列表
        for (const businessStrategy of businessStrategies) {
            logger.info(`Executing strategyName:${businessStrategy.strategyName} type:${businessStrategy.strategyType}`);
            // @ts-ignore
            const strategyFunction = strategies[businessStrategy.strategyType].strategy;
            if (!strategies[businessStrategy.strategyType]) {
                logger.error(`strategy not exists:${businessStrategy.strategyType}`);
                continue;
            }
            if (!strategyFunction) continue;
            const params = businessStrategy.parameters;
            const result = await this.tryExecuteStrategy(strategyFunction, businessStrategy, params, pendingItem);
            // 如果策略函数返回结果，则结束执行，返回结果
            if (result) {
                result.businessStrategyId = businessStrategy.id;
                result.strategyName = businessStrategy.strategyName;
                result.strategyType = businessStrategy.strategyType;
                result.displayName = strategies[businessStrategy.strategyType].displayName;
                logger.infoLog(`Executing ${businessStrategy.strategyName} - ${businessStrategy.strategyType} get chuteNo,result: ${util.stringify(result)}`);
                return result;
            } else {
                logger.info(`Executing ${businessStrategy.strategyName} - ${businessStrategy.strategyType} not get chuteNo,continue`);
            }
        }
        return null;
    }

    getStrategyByType(strategyType: string) {
        return strategies[strategyType];
    }

    getUserParamsAll(params: any, paramDescription: any) {
        console.log('getUserParamsAll', params, paramDescription);
        const userParams = _.cloneDeep(paramDescription);
        if (!params) params = {};
        // 遍历参数描述中的每个属性
        for (const paramName in paramDescription) {
            if (_.has(params, paramName)) {
                userParams[paramName].value = params[paramName];
            } else {
                if (_.has(paramDescription[paramName], 'default')) {
                    userParams[paramName].value = paramDescription[paramName].default;
                }
            }
        }
        console.log('userParams', userParams);
        return userParams;
    }

    getLabelIfSelect(param: any) {
        if (param.type != 'select') return param.value;
        for (const option of param.options) {
            if (typeof option === 'object' && _.has(option, param.value)) {
                return option[param.value];
            }
        }
        return param.value;
    }

    fillUserStrategiesIfNeed(userStrategies: any) {
        const existingStrategyNames = userStrategies.map((userStrategy: any) => userStrategy.strategyName);
        // 找到缺失的策略名字
        const missingStrategyNames = Object.keys(strategies).filter((strategyName: string) => !existingStrategyNames.includes(strategyName));
        missingStrategyNames.forEach((strategyName: string) => {
            userStrategies.push({
                strategyName: strategyName,
                isEnabled: 0,
                parameters: {}, // 这里可以根据需要初始化参数
            });
        });
    }

    getUserStrategyParams(params: any) {
        console.log('getUserStrategyParams', params);
        const userStrategyParams: any = {};
        // 遍历参数描述中的每个属性
        for (const key in params) {
            const curPar = params[key];
            const isRelationNumber = _.eq(_.get(curPar, 'type'), 'relation-number');
            if (isRelationNumber && !_.get(params, [_.get(curPar, 'supperKey'), 'value'])) continue;
            if (
                isRelationNumber ||
                _.includes(['switch', 'relation-switch', 'number'], _.get(curPar, 'type'))
            ) {
                userStrategyParams[key] = _.get(curPar, 'value');
                continue;
            }
            if (_.isEmpty(_.get(curPar, 'value'))) continue;
            userStrategyParams[key] = _.get(curPar, 'value');
        }
        console.log('getUserStrategyParams', userStrategyParams);
        return userStrategyParams;
    }

}

export default new AutoSortingStrategyService();
