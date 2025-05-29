import {ipcRenderer} from 'electron';
import {initDB} from '@/db/initDB';
import os from 'os';
import fs from 'fs';
import _ from 'lodash';
import dayjs from 'dayjs';
import {
    AUTO_SORTING_PLATFORM,
    AUTO_SORTING_PLATFORM_PROD,
    ChuteAllocationTypeEnum,
    ChuteAssignableConditionEnum,
    ChuteDetailStatusEnum,
    ChuteTypeEnum,
    ChuteWorkStatusEnum,
    CONFIG_KEY,
    Constants,
    FullPackageInformationSourceEnum,
    JobItemPackageTypeEnum,
    JobItemStatusEnum,
    JobStatusEnum,
    LogNameEnum,
    LogTypeEnum,
    LSO_TRANSIT_PACKAGE_LABEL,
    OperationTypeEnum,
    PackageMonitorStatusEnum,
    PackageTypeEnum,
    QueueTypeEnum,
    TABLE,
    USER_DEFAULT_STRATEGY,
    WaveStatusEnum,
    WISE_HEADERS,
    WISE_HEADERS_PROD,
} from '@/constants/autoSortingConstants';
import axios from 'axios';
import logger from '@/service/autoSortingLogService';
import Util from '@/service/utilService';
import {createSqliteConnection} from '@/db/SQLiteDBConnection';
import strategyService from '@/service/autoSortingStrategyService';
import LockService from '@/service/lockService';
import cache from '@/shared/cache';
import handlebars from 'handlebars';
import XLSX from 'xlsx';

let wiseHeaders: any;
console.log('uptime', os.uptime());
let db: any;
let dbPath: any;
let userHome: any;
const platformJsonName = 'AutoSorting_platform.json';
if (process.env.NODE_ENV === 'production' && process.env.VUE_APP_LSO) {
    wiseHeaders = WISE_HEADERS_PROD.lso;
} else if (process.env.VUE_APP_LSO) {
    wiseHeaders = WISE_HEADERS.saas;
} else {
    wiseHeaders = WISE_HEADERS.wise;
}

export const getUserHome = async () => {
    console.log('process.type', process.type);
    if (process.type != 'renderer') {
        return process.env.HOME || process.env.USERPROFILE;
    }
    return await ipcRenderer.invoke('getUserHome');
};

export const autoSortingMainInit = (mainWindow: any, ipcMain: any) => {
    ipcMain.handle('auto-sorting-main-message', async (e: any, args: any) => {
        console.log('auto-sorting-main-message >>> ', args);
        if (args === 'refreshCurrentBusiness') {
            await getCurrentBusiness();
            return;
        }
        if (args === 'refreshChuteInfoList') {
            global.chuteList = await getChuteInfoList();
            return;
        }
    });

    ipcMain.handle('pullWave', async () => {
        return await pullWave();
    });

    ipcMain.handle('aScanQueue', async () => {
        return await aScanQueue();
    });

    ipcMain.handle('packageBondedQueue', async () => {
        return await packageBondedQueue();
    });

    ipcMain.handle('getAmazonawsPackageQueue', async () => {
        return await getAmazonawsPackageQueue();
    });
    // mainWindow.on('closed', async () => {
    //     console.log('mainWindow closed');
    //     if (db) {
    //         console.log('准备安全结束数据库:', process.type, db);
    //         try {
    //             await db.close();
    //             console.log('已安全结束');
    //         } catch (e) {
    //             console.log('关闭数据库连接失败:', e);
    //         }
    //     }
    // });
    // app.on('before-quit', () => {
    //     console.log('before-quit');
    //     if (db) {
    //         console.log('准备安全结束数据库:', process.type, db);
    //         try {
    //             db.close().then((e: any) => {
    //                 console.log('close db', e);
    //             }).catch((e: any) => {
    //                 console.log('close db error', e);
    //             });
    //             console.log('已安全结束');
    //         } catch (e) {
    //             console.log('关闭数据库连接失败:', e);
    //         }
    //     }
    // });
};

export const closeDB = async () => {
    if (db) {
        console.log('准备安全结束数据库:', process.type, db);
        try {
            const res = await db.close();
            console.log('已安全结束', res);
        } catch (e) {
            console.log('关闭数据库连接失败:', e);
        }
    }
};

export const autoSortingInit = async () => {
    console.log('uptime in init', os.uptime());
    if (db) return;
    userHome = await getUserHome();
    dbPath = `${userHome}/AutoSorting.db`;
    console.log('dbPath', dbPath);
    // db = new SQLiteDB(dbPath);

    db = createSqliteConnection(dbPath);
    await initDB(db, dbPath);
    console.log('db init success');
};

export const getDBForTransaction = async () => {
    if (!dbPath) {
        if (!userHome) userHome = await getUserHome();
        dbPath = `${userHome}/AutoSorting.db`;
    }
    return createSqliteConnection(dbPath);
};

export const autoSortingInitBak = async (mainWindow: any, ipcMain: any) => {
    // db = new SQLiteDB(sqliteDBPath);
    // await initDB(db, sqliteDBPath);
    // global.sqliteDB = db;
    // console.log('db init success', global.sqliteDB);

    ipcMain.handle('sqliteDB', async (e: any, args: any) => {
        console.log('sqliteDB >>> ', args);
        try {
            if (args.params) {
                return await db[args.method](args.tableName, args.data, args.params);
            }
            return await db[args.method](args.tableName, args.data);
        } catch (e: any) {
            console.log(e);
            return { isError: true, message: e.message };
        }
    });
};

async function autoSortingIpcRenderer(args: any) {
    const res = await ipcRenderer.invoke('sqliteDB', args);
    if (res.isError) {
        throw new Error(res.message);
    }
    return res;
}

export async function tryInitDBIfNeed() {
    if (!db) {
        console.log('try to get db');
        await autoSortingInit();
        console.log('has get db');
    }
    return db;
}

const validateChuteExist = async (chuteNo: string, condition?: any) => {
    const chute = await db.getOne(
        TABLE.CHUTE,
        Object.assign(
            {
                chuteNo: chuteNo,
                platForm: global.platform.name,
            },
            condition,
        ),
    );
    if (chute) {
        throw new Error(`chuteNo: ${chuteNo} already exist`);
    }
    return chute;
};

export async function tryGetPlatformIfNeed() {
    if (!global.platform) {
        console.log(' try toGetPlatformIfNeed ');
        global.platform = await getPlatform();
        console.log(' get Platform ', global.platform);
    }
    if (!global.platform) {
        console.log('platform is not set');
    }
}

export const getConfig = async (key: string, defaultValue?: string) => {
    const config = await db.getOne(TABLE.CONFIG, { key: key });
    return _.isEmpty(config) ? defaultValue : config.value;
};

export const getPlatform = async () => {
    // 本地文件查找时先找本地
    const userHome = await getUserHome();
    if (fs.existsSync(userHome + `/${platformJsonName}`)) {
        const data = fs.readFileSync(userHome + `/${platformJsonName}`, 'utf-8');
        console.log('getPlatform:platform file exist', data);
        global.platform = JSON.parse(data);
    } else {
        global.platform = {};
    }
    // global.platform = await getConfig(CONFIG_KEY.PLATFORM);
    return global.platform;
};

export const setPlatform = async (value: string) => {
    if (!global.platform) global.platform = {};
    let platforms: any;
    if (process.env.NODE_ENV === 'production' && process.env.VUE_APP_LSO) {
        platforms = AUTO_SORTING_PLATFORM_PROD;
    } else {
        platforms = AUTO_SORTING_PLATFORM;
    }
    global.platform = _.find(platforms, (item: any) => {
        return item.name === value;
    });
    const userHome = await getUserHome();
    fs.writeFileSync(userHome + `/${platformJsonName}`, JSON.stringify(global.platform));
    //return await setConfig(CONFIG_KEY.PLATFORM, value);
};

export const setConfig = async (key: string, value: string) => {
    return await db.updateOrInsert(TABLE.CONFIG, { key: key, value: value }, { key: key });
};

export const getChuteList = async () => {
    await tryGetPlatformIfNeed();
    if (!global.platform) {
        console.log('getChuteList:no platform');
        return;
    }
    console.log('current platform:', global.platform.name);
    const chute = await db.queryBySQL(`select * from ${TABLE.CHUTE} where platform=? order by chuteNoInt`, [global.platform.name]);
    console.log('chute', chute);
    return chute;
};

export const getChuteListByChuteNoLike = async (search: any) => {
    await tryGetPlatformIfNeed();
    if (!global.platform) {
        console.log('getChuteList:no platform');
        return;
    }
    console.log('current platform:', global.platform.name);
    let sql = `select * from ${TABLE.CHUTE} where platform=?`;
    const params: any[] = [global.platform.name];
    if (!_.isEmpty(search.chuteNo)) {
        sql += ` and chuteNo like ?`;
        params.push(`%${search.chuteNo}%`);
    }
    if (!_.isEmpty(search.chuteType)) {
        sql += ` and chuteType = ?`;
        params.push(search.chuteType);
    }
    if (!_.isEmpty(search.chuteTypeIn)) {
        sql += ` and chuteType in ("${_.join(search.chuteTypeIn, '","')}")`;
    }
    if (!_.isEmpty(search.chuteTypeNotIn)) {
        sql += ` and chuteType not in ("${_.join(search.chuteTypeNotIn, '","')}")`;
    }
    if (!_.isEmpty(search.chuteNoNotIn)) {
        sql += ` and chuteNo not in ("${_.join(search.chuteNoNotIn, '","')}")`;
    }
    if (!_.isEmpty(search.chuteNoIn)) {
        sql += ` and chuteNo in ("${_.join(search.chuteNoIn, '","')}")`;
    }
    if (!_.isNil(search.isEnabled)) {
        sql += ` and isEnabled = ?`;
        params.push(search.isEnabled);
    }
    sql += ` order by chuteNoInt`;
    if (!_.isNil(search.limit)) {
        sql += ` limit ?`;
        params.push(search.limit);
    }
    const chute = await db.queryBySQL(sql, params);
    console.log('chute', chute);
    return chute;
};

export const searchChuteInfoList = async (search: any) => {
    let sql = `select a.*,b.workStatus,b.routeName,b.chuteKey,b.jobId from ${TABLE.CHUTE} a left join ${TABLE.CHUTE_BINDING} b
                on a.id=b.chuteId
                where a.platform=?`;
    const params: any[] = [global.platform.name];
    if (!_.isEmpty(search.chuteNo)) {
        sql += ` and a.chuteNo like ?`;
        params.push(`%${search.chuteNo}%`);
    }
    if (!_.isEmpty(search.workStatusIn)) {
        sql += ` and b.workStatus in ("${_.join(search.workStatusIn, '","')}")`;
    }
    if (!_.isNil(search.isEnabled)) {
        sql += ` and a.isEnabled = ${search.isEnabled}`;
    }
    const chutes = await db.queryBySQL(sql, params);
    console.log('searchChuteInfoList', chutes);
    return chutes;
};

export const getChuteGroupList = async () => {
    return await db.queryBySQL(`select a.*,b.groupName from ${TABLE.CHUTE} a left join ${TABLE.GROUP} b on a.groupId = b.id where a.platform=? order by a.chuteNoInt asc`, [global.platform.name]);
};

export const getChuteGroupListByPaging = async (params: any) => {
    const offset = params.page ? (params.page - 1) * params.pageSize : 0;
    const limit = params.pageSize || 20;
    let sql = `select a.*,b.groupName from ${TABLE.CHUTE} a left join ${TABLE.GROUP} b on a.groupId = b.id where a.platform=?`;
    let sqlCount = `select COUNT(*) as totalCount from ${TABLE.CHUTE} a left join ${TABLE.GROUP} b on a.groupId = b.id where a.platform=?`
    const paramsArr = [global.platform.name];
    const paramsArrCount = [global.platform.name];
    if (params) {
        if (params.chuteNo) {
            sql += ` and a.chuteNo like ?`;
            sqlCount += ` and a.chuteNo like ?`;
            paramsArr.push(`%${params.chuteNo}%`);
            paramsArrCount.push(`%${params.chuteNo}%`);
        }
        if (!_.isNil(params.isEnabled)) {
            sql += ` and a.isEnabled = ${params.isEnabled}`;
            sqlCount += ` and a.isEnabled = ${params.isEnabled}`;
        }
        if (params.chuteType) {
            sql += ` and a.chuteType = ?`;
            sqlCount += ` and a.chuteType = ?`;
            paramsArr.push(params.chuteType);
            paramsArrCount.push(params.chuteType);
        }
        if (params.groupId) {
            sql += ` and a.groupId = ?`;
            sqlCount += ` and a.groupId = ?`;
            paramsArr.push(params.groupId);
            paramsArrCount.push(params.groupId);
        }
    }
    sql += ` order by a.chuteNoInt asc LIMIT ? OFFSET ?`;
    paramsArr.push(limit, offset);
    const list = await db.queryBySQL(sql, paramsArr);
    const totalCount = await db.queryBySQL(sqlCount, paramsArrCount);
    return { data: list, total: totalCount[0] ? totalCount[0].totalCount : 0 };
};

export const getChuteInfoByChuteNo = async (chuteNo: string) => {
    await tryGetPlatformIfNeed();
    if (!global.platform) {
        console.log('getChuteList:no platform');
        return;
    }
    console.log('current platform:', global.platform.name);
    const sql = `select a.*,b.workStatus,b.routeName,b.chuteKey,b.jobId from ${TABLE.CHUTE} a left join ${TABLE.CHUTE_BINDING} b
                on a.id=b.chuteId
                where a.platform=? and a.chuteNo=?`;
    const chuteInfo = await db.getOneBySQL(sql, [global.platform.name, chuteNo]);
    console.log('chuteInfo', chuteInfo);
    return chuteInfo;
};

export const deleteChute = async (id: number) => {
    await tryInitDBIfNeed();
    console.log('deleteChute', id);
    const chute = await db.getOne(TABLE.CHUTE, { id: id });
    if (await db.getCount(TABLE.JOB, { chuteNo: chute.chuteNo }) > 0) {
        throw new Error('Chute has job history,cannot be deleted');
    }
    if (await db.getCount(TABLE.CHUTE_DETAIL, { chuteNo: chute.chuteNo }) > 0) {
        throw new Error('Chute has worked history,cannot be deleted');
    }
    if (await db.getCount(TABLE.CHUTE_DETAIL_HISTORY, { chuteNo: chute.chuteNo }) > 0) {
        throw new Error('Chute has worked history,cannot be deleted.');
    }
    if (global.chuteList) {
        global.chuteList = global.chuteList.filter((item: any) => item.id !== id);
    }
    return await db.delete(TABLE.CHUTE, { id: id });
};

export const tryAddDefaultGroupIfNeed = async () => {
    if (!global.platform.name) return;
    if (await db.getCount(TABLE.GROUP, { platform: global.platform.name }) === 0) {
        await db.insert(TABLE.GROUP, { platform: global.platform.name, groupName: 'Default Group' });
    }
};

export const saveChute = async (chute: any, id?: number) => {
    await tryInitDBIfNeed();
    console.log('saveChute', chute, id);
    tryGetPlatformIfNeed();
    try {
        chute.chuteNoInt = Number(chute.chuteNo);
        if (isNaN(chute.chuteNoInt)) {
            throw new Error('chuteNo must be number');
        }
    } catch (e) {
        if (id) {
            chute.chuteNoInt = id;
        } else {
            chute.chuteNoInt = await db.getCountBySQL(`select ifnull(max(id),0) + 1 as num from ${TABLE.CHUTE} where platform=?`, [global.platform.name]);
        }
    }
    try {
        if (id) {
            await validateChuteExist(chute.chuteNo, { id_NE: id });
            return await db.update(TABLE.CHUTE, chute, { id: id });
        }
        await validateChuteExist(chute.chuteNo);
        return await db.insert(TABLE.CHUTE, chute);
    } finally {
        await syncChuteBindingIfNeed();
        global.chuteList = await getChuteInfoList();
    }

    // if (id) {
    //     return await autoSortingIpcRenderer({
    //         method: 'update',
    //         tableName: 'auto_sorting_chute',
    //         data: chute,
    //         params: { id: id },
    //     });
    // }
    // return await autoSortingIpcRenderer({
    //     method: 'insert',
    //     tableName: 'auto_sorting_chute',
    //     data: chute,
    // });
};

export const getChuteWorkList = async (checkChuteTypeMap: any, checkWorkStatusMap: any, chuteNo: string, groupId: string, limit: number, chuteTypeNotIn: string[]) => {
    await tryGetPlatformIfNeed();
    if (!global.platform) {
        console.log('getChuteWorkList:no platform');
        return;
    }
    console.log('current platform:', global.platform.name);
    const sql = `select a.*,b.jobId,b.workStatus,b.routeName from ${TABLE.CHUTE} a left join ${TABLE.CHUTE_BINDING} b
                on a.id=b.chuteId `;
    let whereSQL = `where a.platform=?`;
    const parameters = [global.platform.name];
    if (!_.isEmpty(checkChuteTypeMap)) {
        // 获取checkChuteTypeMap value为true的key
        const checkChuteTypeKeys = Object.keys(checkChuteTypeMap).filter((key) => checkChuteTypeMap[key]);
        if (!_.isEmpty(checkChuteTypeKeys)) {
            whereSQL += ` and a.chuteType in (${checkChuteTypeKeys.map((key) => `'${key}'`).join(',')})`;
        }
    }
    if (!_.isEmpty(checkWorkStatusMap)) {
        // 获取checkWorkStatusMap value为true的key
        const checkWorkStatusKeys = Object.keys(checkWorkStatusMap).filter((key) => checkWorkStatusMap[key]);
        if (!_.isEmpty(checkWorkStatusKeys)) {
            whereSQL += ` and b.workStatus in (${checkWorkStatusKeys.map((key) => `'${key}'`).join(',')})`;
        }
    }
    if (chuteNo) {
        whereSQL += `and a.chuteNo=?`;
        parameters.push(chuteNo);
    }
    if (groupId) {
        whereSQL += `and a.groupId=?`;
        parameters.push(groupId);
    }
    if (chuteTypeNotIn) {
        whereSQL += `and a.chuteType not in ("${_.join(chuteTypeNotIn, '","')}")`;
    }
    whereSQL = whereSQL + ` order by a.chuteNoInt`;
    if (!_.isNil(limit)) {
        whereSQL += ` limit ${limit}`;
    }
    const chuteWorkList = await db.queryBySQL(sql + whereSQL, parameters);
    return chuteWorkList;
};

export const getChuteMonitorDetails = async (chute: any) => {
    const detailQueryResult = await db.queryBySQL(`SELECT * FROM ${TABLE.CHUTE_DETAIL} WHERE chuteId = ?`, [chute.id]);
    console.log('getChuteMonitorDetails', detailQueryResult);
    return detailQueryResult;
}

export const queryChuteDetailMap = async () => {
    const detailQueryResult = await db.queryBySQL(`SELECT chuteNo, COUNT(*) as qty FROM ${TABLE.packages_monitor}
WHERE status='${PackageMonitorStatusEnum.SORTED}' and platform='${global.platform.name}' GROUP BY chuteNo`);
    return detailQueryResult;
};

export const getChuteMonitorDetailsByChuteKey = async (routeName: string) => {
    return await db.queryBySQL(`SELECT * FROM ${TABLE.CHUTE_DETAIL} WHERE routeName = ?,status <> ?`, [routeName, ChuteDetailStatusEnum.DONE]);
};

export const getIdleChutesByType = async (chuteType: string) => {
    const idleSql = `select a.*,b.workStatus,b.jobId,b.routeName,c.groupName from ${TABLE.CHUTE} a
                left join ${TABLE.CHUTE_BINDING} b on a.id=b.chuteId
                left join ${TABLE.GROUP} c on a.groupId=c.id and c.isEnabled=1
                where a.platform=? and a.chuteType=? and a.isEnabled=1 and (b.workStatus is null or b.workStatus='${ChuteWorkStatusEnum.IDLE}')`;
    return await db.queryBySQL(idleSql, [global.platform.name, chuteType]);
};

export const getIdleChutesByTypeAndNotInChuteNos = async (chuteType: string, notInChuteNos: string[]) => {
    let idleSql = `select a.*,b.workStatus,b.jobId,b.routeName,c.groupName from ${TABLE.CHUTE} a
                left join ${TABLE.CHUTE_BINDING} b on a.id=b.chuteId
                left join ${TABLE.GROUP} c on a.groupId=c.id and c.isEnabled=1
                where a.platform=? and a.chuteType=? and a.isEnabled=1 and (b.workStatus is null or b.workStatus='${ChuteWorkStatusEnum.IDLE}')`;
    const params = [global.platform.name, chuteType];
    if (!_.isEmpty(notInChuteNos)) {
        idleSql += ` and a.chuteNo not in ('${_.join(notInChuteNos, `','`)}')`;
    }
    return await db.queryBySQL(idleSql, params);
};

export const getIdleChutesByTypeAndInChuteNos = async (chuteType: string, inChuteNos: string[], routeName: string) => {
    let idleSql = `select a.*,b.workStatus,b.jobId,b.routeName,c.groupName from ${TABLE.CHUTE} a
                left join ${TABLE.CHUTE_BINDING} b on a.id=b.chuteId
                left join ${TABLE.GROUP} c on a.groupId=c.id
                where a.platform=? and a.chuteType=? and a.isEnabled=1
                and (b.workStatus is null or b.workStatus='${ChuteWorkStatusEnum.IDLE}'
                or b.routeName=?)`;
    const params = [global.platform.name, chuteType, routeName];
    if (!_.isEmpty(inChuteNos)) {
        idleSql += ` and a.chuteNo in ('${_.join(inChuteNos, `','`)}')`;
    }
    return await db.queryBySQL(idleSql, params);
};

export const getAssignedChutes = async (routeName: string, chuteType: string) => {
    const assignedSql = `select a.*,b.workStatus,b.jobId,b.routeName,c.groupName from ${TABLE.CHUTE} a
                left join ${TABLE.CHUTE_BINDING} b on a.id=b.chuteId
                left join ${TABLE.GROUP} c on a.groupId=c.id and c.isEnabled=1
                where a.platform=? and a.chuteType=? and a.isEnabled=1 and b.routeName is not null and b.routeName=?`;
    return await db.queryBySQL(assignedSql, [global.platform.name, chuteType, routeName]);
};

export const getChuteUnassignedItemsPage = async (chute: any) => {
    const unassignedItemList = await db.queryBySQLPage(`SELECT a.barcode,sum(qty) as qty,sum(assignedQty) as assignedQty,min(itemName) as itemName FROM ${TABLE.JOB_ITEM} a,${TABLE.JOB} b
    WHERE a.jobId=b.id and a.status<>? and b.id=${chute.jobId}
    group by a.barcode`, [JobItemStatusEnum.COMPLETED], chute);
    console.log('getChuteUnassignedItemsPage', unassignedItemList);
    return unassignedItemList;
};
export const getChuteMonitorUnassignedItems = async (chute: any) => {
    const unassignedItemList = await db.queryBySQL(`SELECT a.*,b.chuteId,b.chuteNos FROM ${TABLE.JOB_ITEM} a,${TABLE.JOB} b
    WHERE a.jobId=b.id and a.status<>? and b.chuteId=${chute.id}`, [JobItemStatusEnum.COMPLETED]);
    const groupedItems = _.groupBy(unassignedItemList, (item: any) => item.chuteId + '-' + item.barcode);
    const unassignedGroupList = _.map(groupedItems, (items: any, key: any) => {
        const [chuteId, barcode] = key.split('-');
        return {
            barcode: barcode,
            chuteId: Number(chuteId),
            chuteNos: items[0].chuteNos,
            itemName: items[0].itemName,
            qty: _.sumBy(items, 'qty'),
            assignedQty: _.sumBy(items, 'assignedQty'),
        };
    });
    console.log('unassignedGroupList', unassignedGroupList);
    return unassignedGroupList.filter((item: any) => item.chuteNos.split(',').includes(chute.chuteNo));
};

export const getChuteWorkStats = async () => {
    await tryGetPlatformIfNeed();
    if (!global.platform) {
        console.log('getChuteWorkStats:no platform');
        return;
    }
    console.log('current platform:', global.platform.name);
    // 正常空闲格口
    const normalIdleSql = `select count(id) as num from ${TABLE.CHUTE} a left join ${TABLE.CHUTE_BINDING} b
                on a.id=b.chuteId
                where a.platform=? and a.chuteType<>'${ChuteTypeEnum.EXCEPTION}' and isEnabled=1 and (b.workStatus is null or b.workStatus='${ChuteWorkStatusEnum.IDLE}')`;

    // 工作中格口
    const normalWorkingSql = `select count(id) as num from ${TABLE.CHUTE} a left join ${TABLE.CHUTE_BINDING} b
                on a.id=b.chuteId
                where a.platform=? and a.chuteType<>'${ChuteTypeEnum.EXCEPTION}' and isEnabled=1 and b.workStatus is not null and b.workStatus<>'${ChuteWorkStatusEnum.IDLE}'`;

    // 今日已处理订单
    const dailyProcessedOrderSql = `select count(a.id) as num from ${TABLE.JOB} a,${TABLE.WAVE} b where a.waveId=b.id and b.platform=? and a.completeDate = date('now')`;

    //未完成订单数量
    const unfinishedCountSql = `select count(a.id) as num from ${TABLE.JOB} a,${TABLE.WAVE} b where  a.waveId=b.id and b.platform=? and a.status <> '${JobStatusEnum.COMPLETED}' and a.status <> '${JobStatusEnum.EXCEPTION}'`;

    const stats = {
        normalIdleChute: undefined,
        normalWorkingChute: undefined,
        dailyProcessedCount: undefined,
        unfinishedCount: undefined,
    };
    try {
        stats.normalIdleChute = await db.getCountBySQL(normalIdleSql, global.platform.name);
    } catch (e) {
        console.log('getChuteWorkStats normalIdleSql error', e);
    }
    try {
        stats.normalWorkingChute = await db.getCountBySQL(normalWorkingSql, global.platform.name);
    } catch (e) {
        console.log('getChuteWorkStats normalWorkingSql error', e);
    }
    try {
        stats.dailyProcessedCount = await db.getCountBySQL(
            dailyProcessedOrderSql,
            global.platform.name,
        );
    } catch (e) {
        console.log('getChuteWorkStats dailyProccessedCount error', e);
    }
    try {
        stats.unfinishedCount = await db.getCountBySQL(unfinishedCountSql, global.platform.name);
    } catch (e) {
        console.log('getChuteWorkStats unfinishedCount error', e);
    }

    console.log('getChuteWorkStats', stats);
    return stats;
};

export const recordLog = async (data: any) => {
    await tryGetPlatformIfNeed();
    data.platform = global.platform.name;
    data.isException = 0;
    try {
        await db.insert(TABLE.LOG, data);
    } catch (e) {
        logger.error('recordLog error', LogNameEnum.EXCEPTION);
    }
};

export const recordExceptionLog = async (data: any) => {
    await tryGetPlatformIfNeed();
    data.platform = global.platform.name;
    data.isException = 1;
    try {
        await db.insert(TABLE.LOG, data);
    } catch (e) {
        logger.error('recordExceptionLog error', LogNameEnum.EXCEPTION);
    }
};

export const getWaveByJobId = async (jobId: number) => {
    return await db.getOneBySQL(`select a.* from ${TABLE.WAVE} a,${TABLE.JOB} b where a.id=b.waveId and b.id=?`, [jobId]);
};

export const getWaveList = async (params?: any) => {
    await tryGetPlatformIfNeed();
    // const currentDate = `WAVE-${dayjs().format('YYYYMMDD')}-001`;
    let sql = `select a.*,(select count(*) from auto_sorting_job b where b.waveId=a.id and b.status<>'${JobStatusEnum.COMPLETED}') as unfinishedCount
,(select count(*) from auto_sorting_job b where b.waveId=a.id and b.status='${JobStatusEnum.COMPLETED}') as completedCount
 from ${TABLE.WAVE} a where a.platform=? `;
    const paramsArr = [global.platform.name];
    if (params && params.status) {
        sql += ` and a.status = ?`;
        paramsArr.push(params.status);
    }
    if (params && params.waveNo) {
        sql += ` and a.waveNo like ?`;
        paramsArr.push(`%${params.waveNo}%`);
    }
    sql += ` order by a.id asc`;
    let waveList = await db.queryBySQL(sql, paramsArr);
    if (!_.isEmpty(waveList)) {
        waveList = [waveList[waveList.length - 1]]
        const idList = _.map(waveList, 'id');
        let jobSql = `select * from ${TABLE.JOB} where waveId in (${idList.join(',')})`
        const paramsArr = [];
        if (params && !_.isEmpty(params.jobStatuses)) {
            jobSql += ` and status in (${params.jobStatuses.map((key:any) => `'${key}'`).join(",")})`;
        }
        if (params && params.routeNo) {
            jobSql += ` and chuteKey like ?`;
            paramsArr.push(`%${params.routeNo}%`);
        }
        const jobList = await db.queryBySQL(jobSql, paramsArr);
        waveList.forEach((wave: any) => {
            wave.jobList = jobList.filter((job: any) => job.waveId === wave.id);
        });
    }
    console.log('waveList', waveList);
    return waveList;
};

export const getWaveByWaveNo = async (waveNo: string) => {
    await tryGetPlatformIfNeed();
    const wave = await db.getOne(TABLE.WAVE, { platform: global.platform.name, waveNo: waveNo });
    console.log('WaveByWaveNo', wave);
    return wave;
};

export const getWave = async (waveNo: string, status: WaveStatusEnum) => {
    return await db.getOne(TABLE.WAVE, { platform: global.platform.name, waveNo: waveNo, status: status });
};

export const getWaveById = async (waveId: number) => {
    await tryGetPlatformIfNeed();
    const wave = await db.getOne(TABLE.WAVE, { id: waveId });
    console.log('getWaveById', wave);
    return wave;
};

export const getJobByWaveIdAndChuteKey = async (waveId: number, chuteKey: string, terminal: string) => {
    const job = await db.getOne(TABLE.JOB, { waveId: waveId, chuteKey: chuteKey, terminal: terminal });
    console.log('getJobByWaveIdAndChuteKey', job);
    return job;
};

export const getJobById = async (id: number) => {
    const job = await db.getOne(TABLE.JOB, { id: id });
    return job;
};

export const searchJobItemList = async (waveNo: number, chuteKey: string) => {
    const items: any = await db.queryBySQL(`select a.*,b.waveNo,c.chuteNo,c.chuteNos,c.chuteId,c.jobQty,c.terminal from ${TABLE.JOB_ITEM} a
            left join ${TABLE.WAVE} b on a.waveId=b.id
            left join ${TABLE.JOB} c on a.jobId=c.id
            where b.waveNo=? and b.platform=? and a.chuteKey=?`,
        [waveNo, global.platform.name, chuteKey]);
    return items;
};

export const searchJobItemByBarcode = async (barcode: string) => {
    if (_.isEmpty(barcode)) return;
    const items: any = await db.queryBySQL(`select a.*,b.waveNo,c.chuteNo,c.chuteNos,c.chuteId,c.jobQty,c.terminal from ${TABLE.JOB_ITEM} a
            left join ${TABLE.WAVE} b on a.waveId=b.id
            left join ${TABLE.JOB} c on a.jobId=c.id
            where b.platform=? and a.barcode=?`,
        [global.platform.name, barcode]);
    return items;
};

export const getTerminalMapByJobIds = async (jobIds: string[]) => {
    let sql = `select a.*,b.platform from ${TABLE.JOB} a
               left join ${TABLE.WAVE} b on a.waveId=b.id
               where b.platform=?`;
    if (!_.isEmpty(jobIds)) {
        sql += ` and a.id in (${_.join(jobIds, ',')})`;
    }
    const items = await db.queryBySQL(sql, [global.platform.name]);
    const map: any = {};
    for (const item of items) {
        map[item.id] = item.terminal;
    }
    return map;
};

const saveJob = async (data: any) => {
    return await db.insert(TABLE.JOB, data);
};

const saveItem = async (data: any) => {
    return await db.insert(TABLE.JOB_ITEM, data);
};

const updateJobItem = async (id: number, data: any) => {
    await db.update(TABLE.JOB_ITEM, data, { id });
};

// 检查是否其它波次里有相同的chuteKey
const validateWaveChuteKey = async (data: any) => {
    const chuteKeys = _.uniq(_.map(data.jobList, 'chuteKey'));
    const existWave = await db.getOneBySQL(`select a.*,b.chuteKey
            from auto_sorting_wave a,auto_sorting_job b
            where a.platform=?
            and a.id = b.waveId
            and a.waveNo<>?
            and b.chuteKey in (${chuteKeys.map((key: any) => `'${key}'`).join(', ')})
            limit 1
            `, [global.platform.name, data.waveNo]);
    if (existWave) {
        throw new Error(`chuteKey:${existWave.chuteKey} has been used by wave:${existWave.waveNo}`);
    }
};

const validateAppendIfJobIsCompleted = async (waveId: any, data: any) => {
    for (const job of data.jobList) {
        const existsJob = await getJobByWaveIdAndChuteKey(waveId, job.chuteKey, job.terminal);
        let jobId = 0;
        console.log('existsJob', existsJob);
        if (existsJob) {
            jobId = existsJob['id'];
            console.log('existsJob.status', existsJob.status);
            if (existsJob.status == JobStatusEnum.COMPLETED) {
                throw new Error(`chuteKey:${job.chuteKey} has completed,can't append`);
            }
        }
    }
};

const updateJobQty = async (jobId: any) => {
    const qty = await getJobItemsCountByJobId(jobId);
    await db.update(TABLE.JOB, { jobQty: qty }, { id: jobId });
};

export const postSaveWave = async (res: any, params: any) => {
    const waveId = await saveWave(params);
    return httpSuccess(res, {waveId});
};

export const saveWave = async (data: any) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    if (data.platform != global.platform.name) {
        throw new Error(`platform not match ${data.platform} | ${global.platform.name}`);
    }
    let wave = await getWaveByWaveNo(data.waveNo);
    if (data.type == 'update') {
        if (wave && wave.status != WaveStatusEnum.STOP) {
            throw new Error(`Wave:${data.waveNo} has start,can't update`);
        }
        if (wave) {
            const assignedCount = await db.getCountBySQL(
                `select count(id) as num from ${TABLE.JOB_ITEM} where waveId=${wave.id} and status<>'${JobItemStatusEnum.UNASSIGNED}'`,
                global.platform.name,
            );
            if (assignedCount > 0) {
                throw new Error(`Wave:${data.waveNo} has worked,can't update`);
            }
            await db.delete(TABLE.WAVE, { id: wave.id });
            await db.delete(TABLE.JOB, { waveId: wave.id });
            await db.delete(TABLE.JOB_ITEM, { waveId: wave.id });
            wave = null;
        }
    }
    if (data.type == 'append') {
        if (wave && wave.status == WaveStatusEnum.COMPLETED) {
            throw new Error(`Wave:${data.waveNo} has completed,can't append`);
        }
    }
    let waveId: any;

    if (!wave) {
        wave = {
            platform: data.platform,
            waveNo: data.waveNo,
            status: WaveStatusEnum.RUNNING,
        };
        waveId = await db.insert(TABLE.WAVE, wave);
    } else {
        waveId = wave.id;
    }
    for (const job of data.jobList) {
        const existsJob = await getJobByWaveIdAndChuteKey(waveId, job.chuteKey, job.terminal);
        let jobId = 0;
        console.log('existsJob', existsJob);
        if (existsJob) {
            jobId = existsJob['id'];
            console.log('existsJob.status', existsJob.status);
            if (existsJob.status == JobStatusEnum.COMPLETED) {
                await updateJobStatus(jobId, JobStatusEnum.ASSIGNED);
            }
        } else {
            jobId = await saveJob({
                waveId: waveId,
                waveNo: data.waveNo,
                chuteKey: job.chuteKey,
                status: JobStatusEnum.UNASSIGNED,
                terminal: job.terminal,
            });
        }
        for (const item of job.itemList) {
            const existsItems = await searchJobItemByBarcode(item.barcode || item.barCode);
            if (_.isEmpty(existsItems)) {
                const itemEntity = {
                    waveId: waveId,
                    waveNo: data.waveNo,
                    chuteKey: job.chuteKey,
                    jobId: jobId,
                    itemId: item.itemId,
                    itemName: item.itemName,
                    barcode: item.barcode || item.barCode,
                    shipToAddress: item.shipToAddress,
                    weight: item.weight,
                    volume: item.volume,
                    length: item.length,
                    height: item.height,
                    width: item.width,
                    cubicFeet: item.cubicFeet,
                    packageType: item.packageType,
                    zipcode: item.zipcode,
                    qty: item.qty,
                    assignedQty: 0,
                    status: JobItemStatusEnum.UNASSIGNED,
                };
                await saveItem(itemEntity);
            } else {
                const itemEntity = {
                    waveId: waveId,
                    waveNo: data.waveNo,
                    chuteKey: job.chuteKey,
                    jobId: jobId,
                    itemId: item.itemId,
                    itemName: item.itemName,
                    barcode: item.barcode || item.barCode,
                    shipToAddress: item.shipToAddress,
                    weight: item.weight,
                    volume: item.volume,
                    length: item.length,
                    height: item.height,
                    width: item.width,
                    cubicFeet: item.cubicFeet,
                    packageType: item.packageType,
                    zipcode: item.zipcode,
                };
                await updateJobItem(existsItems[0].id, itemEntity);
            }
        }
        await updateJobQty(jobId);
    }
    return waveId;
};

export const testTransaction = async (data: any) => {
    //await tryInitDBIfNeed();
    const _db: any = await getDBForTransaction();
    try {
        logger.info('testTransaction1');
        await _db.beginTransaction();
        logger.info('beginTransaction1');
        await _db.run('create table test1(a int)');
        logger.info('beginTransaction1 begin wait 10 s');
        await Util.waitBySeconds(10);
        logger.info('beginTransaction1 wait over');
        await _db.rollback();
        logger.info('beginTransaction1 rollback');
        logger.info('testTransaction1 end');
    } finally {
        await _db.close();
    }
};

export const testTransaction2 = async (data: any) => {
    //await tryInitDBIfNeed();
    const _db: any = await getDBForTransaction();
    try {
        logger.info('testTransaction2');
        await _db.beginTransaction();
        logger.info('beginTransaction2');
        await _db.run('create table test2(a int)');
        // console.log('begin wait 15 s');
        // await Util.waitBySeconds(15);
        // console.log('wait over');
        await _db.commit();
        logger.info('testTransaction2 commit');
        logger.info('testTransaction2 end');
    } finally {
        await _db.close();
    }
};

export const testTransaction3 = async (data: any) => {
    //await tryInitDBIfNeed();
    const _db: any = await getDBForTransaction();
    try {
        logger.info('testTransaction3');
        await _db.run('create table test3(a int)');
        // console.log('begin wait 15 s');
        // await Util.waitBySeconds(15);
        // console.log('wait over');
        logger.info('testTransaction3 end');
    } finally {
        await _db.close();
    }
};

const clearJobChuteInfoIfNeed = async (chuteInfo: any) => {
    const job = await getJobById(chuteInfo.jobId);
    const clearJobData: any = { chuteNo: null, chuteId: null, chuteNos: null };
    if (job.chuteNo != job.chuteNos) {
        const chuteNos = job.chuteNos.split(',');
        const index = chuteNos.indexOf(chuteInfo.chuteNo);
        if (index >= 0) {
            const nextIndex = (index + 1) % chuteNos.length;
            clearJobData.chuteNo = chuteNos[nextIndex];
            clearJobData.chuteId = (await getChuteInfoByChuteNo(clearJobData.chuteNo)).id;
            chuteNos.splice(index, 1);
            clearJobData.chuteNos = chuteNos.join(',');
        }
    }
    await db.update(TABLE.JOB, clearJobData, { id: job.id });
};

const updateChuteBindingIdleStatus = async (chuteInfo: any) => {
    if (chuteInfo.workStatus != ChuteWorkStatusEnum.IDLE) {
        if (!await validateChuteIsCompleted(chuteInfo.jobId, chuteInfo.chuteNo)) {
            throw new Error(`job:${chuteInfo.chuteKey} chuteNo:${chuteInfo.chuteNo} is not completed,can't release chute,please check!`);
        }
        await deleteChuteDetailByJobAndChuteNoIfAssigned(chuteInfo.jobId, chuteInfo.chuteNo);
        await db.update(TABLE.CHUTE_BINDING, {
            workStatus: ChuteWorkStatusEnum.IDLE,
            chuteKey: null,
            jobId: null,
            routeName: null,
        }, { chuteId: chuteInfo.id });

        if (global.chuteList) {
            const chuteCache = global.chuteList.find((e: any) => e.id == chuteInfo.id);
            if (chuteCache) {
                chuteCache.workStatus = ChuteWorkStatusEnum.IDLE;
                chuteCache.chuteKey = null;
                chuteCache.jobId = null;
                chuteCache.routeName = null;
            }
        }
        // 格口置为空闲状态时,job里的格口信息也要清空，避免有追加情况
        await clearJobChuteInfoIfNeed(chuteInfo);
    }
};

const releaseChuteByFullPackage = async (chuteInfo: any) => {
    if (await validateChuteIsCompleted(chuteInfo.jobId, chuteInfo.chuteNo)) {
        await updateChuteBindingIdleStatus(chuteInfo);
    } else {
        await deleteChuteDetailByJobAndChuteNoIfAssigned(chuteInfo.jobId, chuteInfo.chuteNo);
        await updateChuteBindingStatus(chuteInfo, ChuteWorkStatusEnum.ASSIGNED);
    }
};

export const releaseChute = async (data: any, libiao: boolean) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    if (data.platform != global.platform.name) {
        throw new Error(`platform not match ${data.platform} | ${global.platform.name}`);
    }
    const chuteInfo = await getChuteInfoByChuteNo(data.chuteNo);
    if (!chuteInfo) {
        throw new Error(`chuteNo:${data.chuteNo} not exist`);
    }
    if (!_.includes([ChuteWorkStatusEnum.FULL_PACKAGE, ChuteWorkStatusEnum.COLLECT_PACKAGE], chuteInfo.workStatus)) {
        throw new Error(`chuteNo:${data.chuteNo} status is ${chuteInfo.workStatus},can't release`);
    }
    // 通知libiao释放格口
    await libiaoReleaseChute(libiao, chuteInfo.chuteNo);
    // 释放格口
    await deleteChuteDetailByJobAndChuteNoIfAssigned(chuteInfo.jobId, chuteInfo.chuteNo);
    // 绑定label
    await _bondedLabel(chuteInfo.chuteNo, data.labelCode);
    // 当前格口如果有排队的包裹，需仍然绑定该路线
    await _updateChuteBinding(chuteInfo.id, chuteInfo.chuteNo);
};

const _bondedLabel = async (chuteNo: string, labelCode: string) => {
    await db.update(
        TABLE.packages_monitor,
        {
            status: PackageMonitorStatusEnum.BONDED,
            label_Code: labelCode,
            updateTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        },
        {
            chuteNo: chuteNo,
            platform: global.platform.name,
            status: PackageMonitorStatusEnum.SORTED,
        }
    );
};

const _updateChuteBinding = async (chuteId: number, chuteNo: string) => {
    // 当前格口如果有排队的包裹，需仍然绑定该路线
    const packages = await getPackagesMonitor({
        chuteNo: chuteNo,
        status: PackageMonitorStatusEnum.SORTING,
    });
    if (_.isEmpty(packages)) {
        await db.update(
            TABLE.CHUTE_BINDING,
            {
                workStatus: ChuteWorkStatusEnum.IDLE,
                chuteKey: '',
                jobId: '',
                routeName: '',
            },
            {
                chuteId: chuteId,
            }
        );
    } else {
        await db.update(
            TABLE.CHUTE_BINDING,
            {
                workStatus: ChuteWorkStatusEnum.ASSIGNED,
            },
            {
                chuteId: chuteId,
            }
        );
    }
};

export const startWave = async (waveId: number) => {
    const wave = await getWaveById(waveId);
    if (wave.status != WaveStatusEnum.STOP) {
        throw new Error(
            `Wave:${wave.waveNo} has start,can't restart,current status:${wave.status}`,
        );
    }
    await updateWaveStatus(waveId, WaveStatusEnum.RUNNING);
};

export const stopWave = async (waveId: number) => {
    const wave = await getWaveById(waveId);
    if (wave.status != WaveStatusEnum.RUNNING) {
        throw new Error(`Wave:${wave.waveNo} not running,can't stop,current status:${wave.status}`);
    }
    await updateWaveStatus(waveId, WaveStatusEnum.STOP);
};

const httpResponse = (status: number, res: any, data: any) => {
    res.writeHead(status, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(data));
    return true;
};

const httpSuccess = (res: any, data: any) => {
    const responseData = {
        code: 200,
        msg: 'ok',
        data: data,
    };
    return httpResponse(200, res, responseData);
};

const httpError = (res: any, msg: any) => {
    const responseData = {
        code: 10000,
        msg: msg,
    };
    logger.error(`httpError:${stringify(responseData)}`, LogNameEnum.ROBOT);
    return httpResponse(200, res, responseData);
};

const syncChuteBindingIfNeed = async () => {
    await db.run(`insert into ${TABLE.CHUTE_BINDING} (chuteId, workStatus)
select id, '${ChuteWorkStatusEnum.IDLE}' from ${TABLE.CHUTE} a where not exists(select 1 from ${TABLE.CHUTE_BINDING} b where b.chuteId=a.id)`);
};

export const updateChuteBindingAssignedStatus = async (chute: any, chuteKey: string, jobId: number) => {
    if (chute.workStatus == ChuteWorkStatusEnum.IDLE) {
        await db.update(TABLE.CHUTE_BINDING, {
            workStatus: ChuteWorkStatusEnum.ASSIGNED,
            chuteKey: chuteKey,
            jobId: jobId,
        }, { chuteId: chute.id });
    }
};

export const updateChuteBindingAssignedStatusV3 = async (chute: any, routeName: string, jobId: number) => {
    if (_.get(chute, 'workStatus') == ChuteWorkStatusEnum.IDLE) {
        await db.update(TABLE.CHUTE_BINDING, {
            workStatus: ChuteWorkStatusEnum.ASSIGNED,
            routeName: routeName,
            jobId: jobId,
        }, { chuteId: chute.id });
    } else if (_.get(chute, 'workStatus') == ChuteWorkStatusEnum.ASSIGNED) {
        await db.update(TABLE.CHUTE_BINDING, {
            jobId: jobId,
        }, { chuteId: chute.id });
    }
};

export const updateChuteBindingAssignedStatusCache = async (chute: any, chuteKey: string, jobId: number) => {
    if (chute.workStatus == ChuteWorkStatusEnum.IDLE) {
        await db.update(TABLE.CHUTE_BINDING, {
            workStatus: ChuteWorkStatusEnum.ASSIGNED,
            chuteKey: chuteKey,
            jobId: jobId,
        }, { chuteId: chute.id });
    }
    const chuteCache = global.chuteList.find((e: any) => e.id == chute.id);
    if (chuteCache) {
        chuteCache.workStatus = ChuteWorkStatusEnum.ASSIGNED;
        chuteCache.chuteKey = chuteKey;
        chuteCache.jobId = jobId;
    } else {
        logger.error(`updateChuteBindingAssignedStatusCache:chuteId:${chute.id} not found`, LogNameEnum.EXCEPTION);
    }
};

const updateChuteBindingStatus = async (chute: any, status: string) => {
    await db.update(TABLE.CHUTE_BINDING, { workStatus: status }, { chuteId: chute.id });

    if (global.chuteList) {
        const chuteCache = global.chuteList.find((e: any) => e.id == chute.id);
        if (chuteCache) {
            chuteCache.workStatus = status;
        }
    }
};

const updateItemAssigned = async (item: any) => {
    if (item.assignedQty + 1 >= item.qty) {
        await db.update(TABLE.JOB_ITEM, {
            status: JobItemStatusEnum.COMPLETED,
            assignedQty_INC: 1,
        }, { id: item.id });
    } else {
        await db.update(TABLE.JOB_ITEM, {
            status: JobItemStatusEnum.ASSIGNED,
            assignedQty_INC: 1,
        }, { id: item.id });
    }
};

const updateJob = async (jobId: any, chuteInfo: any) => {
    const chuteId = chuteInfo.id;
    const chuteNo = chuteInfo.chuteNo;

    const job = await getJobById(jobId);
    const chuteNosHistory = job.chuteNosHistory ? job.chuteNosHistory.split(',') : [];
    if (!chuteNosHistory.includes(chuteNo)) {
        chuteNosHistory.push(chuteNo);
    }
    // 如果是父级格口，直接更新
    if (chuteInfo.assignableCondition && chuteInfo.assignableCondition == ChuteAssignableConditionEnum.KEY_PARENT_EQUAL) {
        await db.update(TABLE.JOB, {
            status: JobStatusEnum.ASSIGNED,
            parentChuteNo: chuteNo,
            chuteNosHistory: chuteNosHistory.join(','),
        }, { id: jobId });
        return;
    }
    const chuteNos = job.chuteNos ? job.chuteNos.split(',') : [];
    if (!chuteNos.includes(chuteNo)) {
        chuteNos.push(chuteNo);
    }
    await db.update(TABLE.JOB, {
        status: JobStatusEnum.ASSIGNED,
        chuteId: chuteId,
        chuteNo: chuteNo,
        chuteNos: chuteNos.join(','),
        chuteNosHistory: chuteNosHistory.join(','),
    }, { id: jobId });
};

export const getExecuteBusinessStrategies = async () => {
    const userStrategies = await getEnabledBusinessStrategyList(await getCurrentBusinessByCache());
    // if (!_.find(userStrategies, { 'strategyType': USER_DEFAULT_STRATEGY.strategyType })) {
    //     logger.infoLog('getExecuteBusinessStrategies:default strategy not found,add default strategy', LogNameEnum.EXCEPTION);
    //     userStrategies.push({ ..._.cloneDeep(USER_DEFAULT_STRATEGY), strategyType: 'default' });
    // }
    return userStrategies;
};

export const getUserStrategyList = async () => {
    const userStrategies = await db.queryBySQL(`select * from ${TABLE.USER_STRATEGY} `);
    _.forEach(userStrategies, (userStrategy: any) => {
        userStrategy.parameters = JSON.parse(userStrategy.parameters || '{}');
    });
    return userStrategies;
};

export const getBusinessStrategyList = async (business: string) => {
    const businessStrategies = await db.queryBySQL(`select a.*,b.strategyType,b.strategyName,b.parameters from ${TABLE.BUSINESS_STRATEGY} a,${TABLE.USER_STRATEGY} b where a.business=? and a.userStrategyId = b.id order by a.priority asc`, business);
    _.forEach(businessStrategies, (businessStrategy: any) => {
        businessStrategy.parameters = JSON.parse(businessStrategy.parameters || '{}');
    });
    return businessStrategies;
};

export const getEnabledBusinessStrategyList = async (business: string) => {
    const businessStrategies = await db.queryBySQL(`select a.*,b.strategyType,b.strategyName,b.parameters from ${TABLE.BUSINESS_STRATEGY} a,${TABLE.USER_STRATEGY} b where a.business=? and a.userStrategyId = b.id and isEnabled=1 order by a.priority asc`, business);
    _.forEach(businessStrategies, (businessStrategy: any) => {
        businessStrategy.parameters = JSON.parse(businessStrategy.parameters || '{}');
    });
    return businessStrategies;
};

const getUserStrategyDefaultNameForBusiness = (business: string) => {
    return Constants.USER_STRATEGY_DEFAULT_FOR_BUSINESS_PREFIX + business;
};
export const tryInsertUserStrategyForBusinessIfNeed = async () => {
    const business = await getCurrentBusiness();
    if (!business) return;
    const userStrategy = await getDefaultUserStrategyByBusiness(business);
    if (!userStrategy) {
        const userStrategyId = await db.insert(TABLE.USER_STRATEGY, {
            strategyName: getUserStrategyDefaultNameForBusiness(business),
            strategyType: USER_DEFAULT_STRATEGY.strategyType,
            description: USER_DEFAULT_STRATEGY.description,
            parameters: JSON.stringify({
                chuteNeededForResortedPkgs: false,
                allocateGroupBy: 'Group ID',
                groupSortBy: 'asc',
                allocateChuteBy: 'Chute ID',
                chuteSortBy: 'asc'
            }),
        });
    }
    await tryInsertBusinessStrategyForBusinessIfNeed();
};

export const tryInsertBusinessStrategyForBusinessIfNeed = async () => {
    const business = await getCurrentBusiness();
    if (!business) return;
    const userStrategy = await getDefaultUserStrategyByBusiness(business);
    if (!userStrategy) return;
    const businessStrategy = await db.getOne(TABLE.BUSINESS_STRATEGY, {
        business: business,
        userStrategyId: userStrategy.id,
    });
    if (!businessStrategy) {
        await addBusinessStrategy(business, userStrategy.id, 1);
    }
};

const getDefaultUserStrategyByBusiness = async (business: string) => {
    return await db.getOne(TABLE.USER_STRATEGY, {
        strategyName: getUserStrategyDefaultNameForBusiness(business),
        strategyType: USER_DEFAULT_STRATEGY.strategyType,
    });
};
export const getUnusedStrategyListExcludeDefaultByBusiness = async (business: string) => {
    const unusedList = await db.queryBySQL(`select * from ${TABLE.USER_STRATEGY} a where not exists(select 1 from ${TABLE.BUSINESS_STRATEGY} b where b.business=? and b.userStrategyId=a.id)`, business);
    return _.filter(unusedList, (strategy: any) => strategy.strategyType != USER_DEFAULT_STRATEGY.strategyType);
};

export const getJobItemsCountByJobId = async (jobId: number) => {
    return await db.getCountBySQL(`select ifnull(sum(qty),0) as num from ${TABLE.JOB_ITEM} where jobId=?`, [jobId]);
};

const getPriorityNewByBusiness = async (business: string) => {
    return await getPriorityCountByBusiness(business) + 1;
};

const getPriorityCountByBusiness = async (business: string) => {
    const maxPriority = await db.getCountBySQL(`select count(id) as num from ${TABLE.BUSINESS_STRATEGY} where business=?`, [business]);
    return maxPriority;
};

export const deleteUserStrategy = async (row: any) => {
    await db.delete(TABLE.USER_STRATEGY, { id: row.id });
    await db.delete(TABLE.BUSINESS_STRATEGY, { userStrategyId: row.id });
    await priorityRebuildBusinessStrategy();
};

const validateSaveUserStrategy = async (row: any) => {
    if (!row.strategyType || !row.strategyName) {
        throw new Error('Type and Name is required');
    }
    const userStrategy = await db.getOne(TABLE.USER_STRATEGY, { strategyName: row.strategyName });
    if (!userStrategy) return;
    if (!row.id || row.id != userStrategy.id) {
        throw new Error(`Name:${row.strategyName} already exists`);
    }
};

export const deleteBusinessStrategy = async (row: any) => {
    await db.delete(TABLE.BUSINESS_STRATEGY, { id: row.id });
    await priorityRebuildBusinessStrategy();
};

export const enabledBusinessStrategy = async (row: any) => {
    await db.update(TABLE.BUSINESS_STRATEGY, { isEnabled: 1 }, { id: row.id })
};

export const disabledBusinessStrategy = async (row: any) => {
    await db.update(TABLE.BUSINESS_STRATEGY, { isEnabled: 0 }, { id: row.id })
};


export const getCurrentBusiness = async () => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();

    if (!global.config) global.config = {};
    global.config.currentBusiness = await getConfig(CONFIG_KEY.CURRENT_BUSINESS, 'LSO');
    return global.config.currentBusiness;
};

export const getCurrentBusinessByCache = async () => {
    if (!global.config) global.config = {};
    if (!global.config.currentBusiness) {
        await getCurrentBusiness();
    }
    console.log('getCurrentBusinessByCache', global.config);
    return global.config.currentBusiness;
};

export const saveCurrentBusiness = async (currentBusiness: string) => {
    const oldCurrentBusiness = await getCurrentBusiness();
    global.config.currentBusiness = currentBusiness;
    await setConfig(CONFIG_KEY.CURRENT_BUSINESS, currentBusiness);
    if (!(await getBusinessList()).includes(oldCurrentBusiness)) {
        await tryCleanDefaultUserStrategyForBusinessIfNeed([oldCurrentBusiness]);
    }
};

export const getBusinessList = async () => {
    return JSON.parse(await getConfig(CONFIG_KEY.BUSINESS_LIST, '["LSO"]'));
};
export const saveBusinessList = async (businessList: any) => {
    const oldBusinessList = await getBusinessList();
    await setConfig(CONFIG_KEY.BUSINESS_LIST, JSON.stringify(businessList));
    const deleteBusinessList = _.difference(oldBusinessList, businessList);
    await tryCleanDefaultUserStrategyForBusinessIfNeed(deleteBusinessList);
};

const tryCleanDefaultUserStrategyForBusinessIfNeed = async (deleteBusinessList: any) => {
    if (_.isEmpty(deleteBusinessList)) return;
    console.log('tryCleanDefaultUserStrategyForBusinessIfNeed', deleteBusinessList);
    const currentBusiness = await getCurrentBusiness();
    for (const business of deleteBusinessList) {
        if (business == currentBusiness) continue;
        await db.delete(TABLE.USER_STRATEGY, {
            strategyName: getUserStrategyDefaultNameForBusiness(business),
            strategyType: USER_DEFAULT_STRATEGY.strategyType,
        });
        await db.delete(TABLE.BUSINESS_STRATEGY, { business: business });
    }
};

export const addBusinessStrategy = async (business: string, strategyId: number, isEnabled?: number) => {
    await db.insert(TABLE.BUSINESS_STRATEGY, {
        business: business,
        userStrategyId: strategyId,
        // priority: await getPriorityNewByBusiness(business),
        isEnabled: isEnabled || 0,
    });
    // await priorityRebuildBusinessStrategy();
};


export const saveUserStrategy = async (row: any) => {
    await validateSaveUserStrategy(row);
    if (!row.id) {
        return await db.insert(TABLE.USER_STRATEGY, {
            strategyType: row.strategyType,
            strategyName: row.strategyName,
            description: row.description,
            parameters: JSON.stringify(row.parameters),
        });
    } else {
        return await db.update(TABLE.USER_STRATEGY, {
            strategyName: row.strategyName,
            description: row.description,
            parameters: JSON.stringify(row.parameters),
        }, { id: row.id });
    }
};

export const priorityUpBusinessStrategy = async (row: any) => {
    const priority = row.priority;
    const prevRow = await db.getOneBySQL(`select * from ${TABLE.BUSINESS_STRATEGY} where business=? and priority<? order by priority desc limit 1`, [row.business, priority]);
    if (prevRow) {
        await db.update(TABLE.BUSINESS_STRATEGY, { priority: priority }, { id: prevRow.id });
        await db.update(TABLE.BUSINESS_STRATEGY, { priority: prevRow.priority }, { id: row.id });
    }
};

export const priorityDownBusinessStrategy = async (row: any) => {
    const priority = row.priority;
    const nextRow = await db.getOneBySQL(`select * from ${TABLE.BUSINESS_STRATEGY} where business=? and priority>? order by priority asc limit 1`, [row.business, priority]);
    if (nextRow) {
        await db.update(TABLE.BUSINESS_STRATEGY, { priority: priority }, { id: nextRow.id });
        await db.update(TABLE.BUSINESS_STRATEGY, { priority: nextRow.priority }, { id: row.id });
    }
};

export const priorityRebuildBusinessStrategy = async () => {
    const currentBusiness = await getCurrentBusiness();
    if (!currentBusiness) return;
    const businessStrategies = await getBusinessStrategyList(currentBusiness);
    const businessStrategiesExcludeDefault = _.filter(businessStrategies, (strategy: any) => strategy.strategyType != USER_DEFAULT_STRATEGY.strategyType);
    const businessStrategiesDefault = _.find(businessStrategies, (strategy: any) => strategy.strategyType == USER_DEFAULT_STRATEGY.strategyType);
    console.log('businessStrategiesExcludeDefault', businessStrategiesExcludeDefault);
    for (let i = 0; i < businessStrategiesExcludeDefault.length; i++) {
        await db.update(TABLE.BUSINESS_STRATEGY, { priority: i + 1 }, { id: businessStrategiesExcludeDefault[i].id });
    }
    console.log('businessStrategiesDefault', businessStrategiesDefault);
    if (businessStrategiesDefault) {
        console.log('getPriorityMaxByBusiness', await getPriorityCountByBusiness(currentBusiness));
        await db.update(TABLE.BUSINESS_STRATEGY, { priority: await getPriorityCountByBusiness(currentBusiness) }, { id: businessStrategiesDefault.id });
    }
};

const updateJobStatus = async (jobId: any, status: string) => {
    const updateData: { [s: string]: any } = {};
    updateData.status = status;
    if (status == JobStatusEnum.COMPLETED) {
        updateData.completeDate = dayjs().format('YYYY-MM-DD');
    } else {
        updateData.completeDate = '';
    }
    await db.update(TABLE.JOB, updateData, { id: jobId });
};

const insertChuteDetailV3 = async (item: any, chuteId: number, chuteNo: string, routeName: string, assignedChute?: any) => {
    const detail: any = {
        platform: global.platform.name,
        waveId: item.waveId,
        waveNo: item.waveNo,
        chuteId: chuteId,
        chuteNo: chuteNo,
        jobId: item.jobId,
        jobItemId: item.id,
        routeName: routeName,
        itemId: item.itemId,
        itemName: item.itemName,
        barcode: item.barcode,
        qty: 1,
        status: ChuteDetailStatusEnum.IN_TRANSIT,
        event_date: dayjs().format('YYYY-MM-DD'),
    };
    if (assignedChute) {
        detail.businessStrategyId = assignedChute.businessStrategyId;
        detail.strategyName = assignedChute.strategyName;
        detail.strategyType = assignedChute.strategyType;
    }
    const id = await db.insert(TABLE.CHUTE_DETAIL, detail);
    await insertChuteDetailHistoryByDetailId(id, OperationTypeEnum.INSERT);
};

const insertChuteDetail = async (item: any, chuteId: number, chuteNo: string, assignedChute?: any) => {
    const detail: any = {
        platform: global.platform.name,
        waveId: item.waveId,
        waveNo: item.waveNo,
        chuteId: chuteId,
        chuteNo: chuteNo,
        jobId: item.jobId,
        jobItemId: item.id,
        chuteKey: item.chuteKey,
        itemId: item.itemId,
        itemName: item.itemName,
        barcode: item.barcode,
        qty: 1,
        status: ChuteDetailStatusEnum.IN_TRANSIT,
        event_date: dayjs().format('YYYY-MM-DD'),
    };
    if (assignedChute) {
        detail.businessStrategyId = assignedChute.businessStrategyId;
        detail.strategyName = assignedChute.strategyName;
        detail.strategyType = assignedChute.strategyType;
    }
    const id = await db.insert(TABLE.CHUTE_DETAIL, detail);
    await insertChuteDetailHistoryByDetailId(id, OperationTypeEnum.INSERT);
};

const insertChuteDetailHistoryByDetailId = async (detailId: number, operationType: string) => {
    await db.run(`insert into ${TABLE.CHUTE_DETAIL_HISTORY}(
                 chuteDetailId,waveId,chuteId, jobId,jobItemId,waveNo,platform,chuteNo,chuteKey,routeName,itemId, itemName,barcode,businessStrategyId,strategyName,strategyType,status,taskId,scanNo, departTime, agvNo,  agvUnloadTime,  qty, weight, createdAt , updatedAt, event_date,operationType,operationTime
                )
    select id,waveId,chuteId, jobId,jobItemId,waveNo,platform,chuteNo,chuteKey,routeName,itemId, itemName,barcode,businessStrategyId,strategyName,strategyType,status,taskId,scanNo, departTime, agvNo,  agvUnloadTime,  qty, weight, createdAt , updatedAt, event_date,'${operationType}'
    ,'${dayjs().format('YYYY-MM-DD HH:mm:ss')}' from ${TABLE.CHUTE_DETAIL} where id=?`, [detailId]);
};

const validateAssignedItemChuteNo = async (chuteNo: string, item: any) => {
    const chuteInfo = await getChuteInfoByChuteNo(chuteNo);
    // if (!chuteInfo) {
    //     throw new Error(`chuteNo:${chuteNo} not exists`);
    // }
    // if (chuteInfo.isEnabled != 1) {
    //     throw new Error(`chuteNo:${chuteNo} is disable`);
    // }
    // if (chuteInfo.isException == 1) {
    //     throw new Error(`chuteNo:${chuteNo} is exception chute`);
    // }
    // if (chuteInfo.isDeleted == 1) {
    //     throw new Error(`chuteNo:${chuteNo} is deleted`);
    // }
    return chuteInfo;
};

const tryPutExceptionChuteIfError = async (barcode: any, exceptionMessage: string) => {
    const chuteException = await db.getOneBySQL(`select a.*,b.workStatus,b.chuteKey from ${TABLE.CHUTE} a
                left join ${TABLE.CHUTE_BINDING} b
                on a.id=b.chuteId
                where b.workStatus<>? and a.platform=? and a.chuteType='${ChuteTypeEnum.EXCEPTION}' and a.isEnabled=1 order by chuteNo asc`
        , [ChuteWorkStatusEnum.FULL_PACKAGE, global.platform.name]);
    if (!chuteException) {
        throw new Error(`barcode:${barcode} ${exceptionMessage},and not find exception chute`);
    }
    return chuteException.chuteNo;
};

function stringify(msg: any) {
    if (typeof msg === 'object') {
        try {
            return JSON.stringify(msg);
        } catch (e) {
            return msg;
        }
    }
    return msg;
}

export const getIdleChutes = async (chuteNoSql = '') => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    return await db.queryBySQL(`select a.*,b.workStatus,b.chuteKey from ${TABLE.CHUTE} a
                    left join ${TABLE.CHUTE_BINDING} b
                    on a.id=b.chuteId
                    where b.workStatus=? and a.platform=? and a.chuteType<>'${ChuteTypeEnum.EXCEPTION}' and a.isEnabled=1 ${chuteNoSql}`, [ChuteWorkStatusEnum.IDLE, global.platform.name]);
};

export const getIdleChutesByCache = async (params: any) => {
    const chutes = await getChuteInfoListByCache();
    return _.filter(chutes, (chute: any) => {
        if (params.chuteNoBegin) {
            if (chute.chuteNoInt < params.chuteNoBegin) return false;
        }
        if (params.chuteNoEnd) {
            if (chute.chuteNoInt > params.chuteNoEnd) return false;
        }
        if (!_.isEmpty(params.chuteNoIn)) {
            if (!params.chuteNoIn.includes(chute.chuteNoInt)) return false;
        }
        if (!_.isEmpty(params.chuteNoNotIn)) {
            if (params.chuteNoNotIn.includes(chute.chuteNoInt)) return false;
        }
        if (chute.workStatus == ChuteWorkStatusEnum.IDLE && chute.chuteType != ChuteTypeEnum.EXCEPTION && chute.isEnabled == 1) {
            return true;
        }
        return false;
    });
};

export const getAllChutesByCache = async (params: any) => {
    const chutes = await getChuteInfoListByCache();
    return _.filter(chutes, (chute: any) => {
        if (params.chuteNoBegin) {
            if (chute.chuteNoInt < params.chuteNoBegin) return false;
        }
        if (params.chuteNoEnd) {
            if (chute.chuteNoInt > params.chuteNoEnd) return false;
        }
        if (!_.isEmpty(params.chuteNoIn)) {
            if (!params.chuteNoIn.includes(chute.chuteNoInt)) return false;
        }
        if (!_.isEmpty(params.chuteNoNotIn)) {
            if (params.chuteNoNotIn.includes(chute.chuteNoInt)) return false;
        }
        if (chute.chuteType != ChuteTypeEnum.EXCEPTION && chute.isEnabled == 1) {
            return true;
        }
        return false;
    });
};

export const getChuteInfoListByCache = async () => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    if (!global.chuteList) {
        global.chuteList = await getChuteInfoList();
    }
    return global.chuteList;
};

export const getChuteInfoList = async () => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    return await db.queryBySQL(`select a.*,b.workStatus,b.chuteKey,b.routeName from ${TABLE.CHUTE} a
                left join ${TABLE.CHUTE_BINDING} b
                on a.id=b.chuteId
                where a.platform=?`, [global.platform.name]);
};

// v5:整个getDestination方法加锁
const getDestinationV5 = async (res: any, params: any) => {
    logger.info('getDestination_items begin');
    const response = await LockService.acquire('getDestination_items', async () => {
        return await getDestinationV2(res, params);
    },
    );
    logger.info('getDestination_items end ' + JSON.stringify(response));
    return response;
};

const debugChuteList = async (res: any, params: any) => {
    if (!global.chuteList) {
        global.chuteList = await getChuteInfoList();
    }
    console.log('chutes cache', global.chuteList);
    const chutes = await getChuteInfoList();
    console.log('chutes no cache', chutes);

    // 自定义比较函数，用来判断两个对象是否相等
    const isEqual = (obj1: any, obj2: any) => _.isEqual(_.sortBy(_.values(obj1)), _.sortBy(_.values(obj2)));

    // 使用 _.differenceWith 进行比较
    const diff1 = _.differenceWith(global.chuteList, chutes, isEqual); // 在 array1 中但不在 array2 中的元素
    const diff2 = _.differenceWith(chutes, global.chuteList, isEqual); // 在 array2 中但不在 array1 中的元素

    console.log('global.chuteList 中但不在 chutes no cache 中的元素:', diff1);
    console.log('chutes no cache 中但不在 global.chuteList 中的元素:', diff2);
    return httpSuccess(res, { diff1, diff2 });
};

const getDestination = async (res: any, params: any) => {
    logger.info('getDestination_items begin');
    const response = await LockService.acquire(
        'getDestination_items',
        async () => {
            return await getDestinationV3(res, params);
        }
    );
    logger.info('getDestination_items end ' + JSON.stringify(response));
    return response;
};

const getDestinationV2 = async (res: any, params: any) => {
    logger.infoLog(`getDestination ${stringify(params)}`, LogNameEnum.ROBOT);
    if (!params || !params['barcode']) {
        return httpError(res, 'invalid post data');
    }
    const startTime = Date.now();
    try {
        const barcode = params['barcode'];
        await tryInitDBIfNeed();
        await tryGetPlatformIfNeed();
        try {
            // 根据barcode查找可分配的item，满包和集包状态都可继续分配
            const items = await db.queryBySQL(`select a.*,b.waveNo,c.chuteNo,c.chuteNos,c.chuteId,c.jobQty from ${TABLE.JOB_ITEM} a
            left join ${TABLE.WAVE} b on a.waveId=b.id
            left join ${TABLE.JOB} c on a.jobId=c.id
            where a.barcode=? and b.status=? and b.platform=? and a.assignedQty<a.qty`,
                [barcode, WaveStatusEnum.RUNNING, global.platform.name]);

            let chuteNo = '';
            if (_.isEmpty(items)) {
                chuteNo = await tryPutExceptionChuteIfError(barcode, 'not found item');
                const errorMessage = `getExceptionChute NO_JOB_FOUND, to ChuteNo:${chuteNo}`;
                logger.error(errorMessage, LogNameEnum.ROBOT);
                await recordExceptionLog({
                    logType: LogTypeEnum.GET_DESTINATION,
                    logName: LogNameEnum.ROBOT,
                    message: errorMessage,
                    data: stringify(params),
                });
                const data = {
                    chuteNo: chuteNo,
                    barcode: barcode,
                    chuteType: ChuteTypeEnum.EXCEPTION,
                    opTime: new Date().getTime(),
                };
                await pushGetDestinationCallback(data);
                return httpSuccess(res, data);
            }

            const userStrategies = await getExecuteBusinessStrategies();
            const assignedChute = await strategyService.executeStrategy(userStrategies, items);
            // 未找到格口,放到异常格口
            if (!assignedChute) {
                chuteNo = await tryPutExceptionChuteIfError(barcode, 'not found idle chute');
                const errorMessage = `getExceptionChute NO_IDLE_CHUTE_AVAILABLE, to ChuteNo:${chuteNo}`;
                logger.error(errorMessage, LogNameEnum.ROBOT);
                await recordExceptionLog({
                    logType: LogTypeEnum.GET_DESTINATION,
                    logName: LogNameEnum.ROBOT,
                    message: errorMessage,
                    data: stringify(params),
                });
                const data = {
                    chuteNo: chuteNo,
                    barcode: barcode,
                    chuteType: ChuteTypeEnum.EXCEPTION,
                    opTime: new Date().getTime(),
                };
                await pushGetDestinationCallback(data);
                return httpSuccess(res, data);
            }
            // 允许 collect package及 full package状态的格口使用
            const item = assignedChute.item;
            chuteNo = assignedChute.chuteNo;
            const logMessage = `get chuteNo:${chuteNo} for barcode:${barcode} by strategy:${assignedChute.strategyName} strategyType:${assignedChute.strategyType}`;
            logger.infoLog(logMessage, LogNameEnum.ROBOT);
            const chuteInfo = await validateAssignedItemChuteNo(chuteNo, item);
            await updateChuteBindingAssignedStatus(chuteInfo, item.chuteKey, item.jobId);
            await updateJob(item.jobId, chuteInfo);
            await updateItemAssigned(item);
            await insertChuteDetail(item, chuteInfo.id, chuteNo, assignedChute);
            const data = {
                chuteNo: chuteNo,
                barcode: barcode,
                opTime: new Date().getTime(),
            };
            await recordLog({
                logType: LogTypeEnum.GET_DESTINATION,
                logName: LogNameEnum.ROBOT,
                message: logMessage,
                data: stringify(params),
            });
            await pushGetDestinationCallback(data);
            return httpSuccess(res, data);
        } catch (e: any) {
            const errorMessage = `getDestination error ${e.message}`;
            logger.error(errorMessage + `${e.stack}`, LogNameEnum.ROBOT);
            await recordExceptionLog({
                logType: LogTypeEnum.GET_DESTINATION,
                logName: LogNameEnum.ROBOT,
                message: errorMessage,
                data: stringify(params),
            });
            return httpError(res, e.message);
        }
    } finally {
        const endTime = Date.now();
        const elapsedMs = endTime - startTime;
        console.info(` getDestination elapsed ${elapsedMs} ms`);
        if (elapsedMs >= 2000) {
            logger.infoLog(`getDestination slow elapsed ${elapsedMs} ms`, LogNameEnum.SLOW_SQL);
        }

    }
};

const terminalDestination = async (pendingItem: any) => {
    // terminal是否配置固定格口
    const chuteAllocation = await getChuteAllocationByRoutName(pendingItem.terminal, ChuteAllocationTypeEnum.TERMINAL);
    if (!_.isEmpty(chuteAllocation.fixedChuteNos)) {
        const fixedChuteNos = chuteAllocation.fixedChuteNos;
        const enableChutes = await getChuteListByChuteNoLike({ chuteNoIn: fixedChuteNos, isEnabled: 1 });
        if (!_.isEmpty(enableChutes)) {
            const idleChutes = await getIdleChutesByTypeAndInChuteNos(ChuteTypeEnum.TERMINAL, fixedChuteNos, pendingItem.terminal);
            if (_.isEmpty(idleChutes)) return null;
            const idleChuteNos = _.map(idleChutes, 'chuteNo');
            const chuteNo = distributionChuteNo(pendingItem.chuteNo, idleChuteNos);
            return { chuteNo: chuteNo, item: pendingItem, type: ChuteTypeEnum.TERMINAL };
        }
    }
};

// v3：更改单独的db
const getDestinationV3 = async (res: any, params: any) => {
    const traceId = Util.generateTraceId();
    logger.infoLog(`${traceId}-getDestination ${stringify(params)}`, LogNameEnum.ROBOT);
    if (!params || !params['barcode']) {
        return httpError(res, 'invalid post data');
    }
    const startTime = Date.now();
    const barcode = params['barcode'];
    const dropOffNo = params['dropOffNo']; //投料口
    const weight = params['weight']; //重量
    try {
        await tryInitDBIfNeed();
        await tryGetPlatformIfNeed();
        // 根据barcode查找package和items
        const pkg = await _getPackage(barcode);
        let items = await _getItems(barcode);
        // 校验包裹重量
        const config = await getSortingSetupConfig();
        const configWeight = config.maximumCarryingCapacity;
        if (weight && weight > configWeight) {
            pkg.barcode = barcode;
            pkg.status = PackageMonitorStatusEnum.OVERWEIGHT;
            pkg.weight = weight;
            await saveScanPackage(pkg);
            return _robotError(
                `${traceId}-getDestination error current weight ${weight} exceeds the max weight ${configWeight}`,
                params,
                res
            );
        }
        if (_.isEmpty(items)) {
            await getAmazonawsPackage(barcode);
            items = await _getItems(barcode);
        }
        if (_.isEmpty(items)) {
            const exceptionChuteNo = await getDropOffExceptionChuteNo(traceId, dropOffNo);
            if (_.isEmpty(exceptionChuteNo)) {
                return _robotError(
                    `${traceId}-getExceptionChute exception chute not found`,
                    params,
                    res
                );
            }
            pkg.barcode = barcode;
            pkg.status = PackageMonitorStatusEnum.NOT_FOUND;
            pkg.weight = weight;
            pkg.chuteNo = exceptionChuteNo;
            await saveScanPackage(pkg);
            const data = await errMessage(
                `${traceId}-getExceptionChute not found item`,
                params,
                exceptionChuteNo,
                barcode
            );
            return httpSuccess(res, data);
        }
        // A Scan结果处理
        aScanByWMS(barcode);
        // 执行格口分配策略
        const pendingItem = _.head(items);
        let assignedChute;
        if (!_.eq(pendingItem.chuteKey, '000.LSO') && !_.isEmpty(pendingItem.terminal)) {
            const userStrategies = await getExecuteBusinessStrategies();
            assignedChute = await strategyService.executeStrategy(userStrategies, [
                pendingItem,
            ]);
        }
        // terminal存在, route为000.LSO
        if (_.eq(pendingItem.chuteKey, '000.LSO') && !_.isEmpty(pendingItem.terminal)) {
            assignedChute = await terminalDestination(pendingItem);
        }
        // 未找到格口,放到异常格口
        if (_.isEmpty(assignedChute)) {
            const exceptionChuteNo = await getDropOffExceptionChuteNo(traceId, dropOffNo);
            if (_.isEmpty(exceptionChuteNo)) {
                return _robotError(
                    `${traceId}-getExceptionChute exception chute not found`,
                    params,
                    res
                );
            }
            pkg.barcode = barcode;
            pkg.status = PackageMonitorStatusEnum.EXCEPTION;
            pkg.weight = weight;
            pkg.chuteNo = exceptionChuteNo;
            pkg.terminal = pendingItem.terminal;
            pkg.waveNo = pendingItem.waveNo;
            pkg.routeNo = pendingItem.chuteKey;
            if (_.eq(pendingItem.chuteKey, '000.LSO')) {
                pkg.exceptionReason = 'route is null';
            } else if (_.isEmpty(pendingItem.terminal)) {
                pkg.exceptionReason = 'terminal is null';
            } else {
                pkg.exceptionReason = 'No idle chute available';
            }
            await saveScanPackage(pkg);
            const data = await errMessage(
                `${traceId}-getExceptionChute ${pkg.exceptionReason}, to ChuteNo:${exceptionChuteNo}`,
                params,
                exceptionChuteNo,
                barcode
            );
            return httpSuccess(res, data);
        }
        // 允许 collect package及 full package状态的格口使用
        const item = assignedChute.item;
        const chuteNo = assignedChute.chuteNo;
        const routeName = assignedChute.type == ChuteTypeEnum.ROUTE ? item.chuteKey : item.terminal;
        const logMessage = `${traceId}-get chuteNo:${chuteNo} for barcode:${barcode} by strategy:${assignedChute.strategyName} strategyType:${assignedChute.strategyType}`;
        logger.infoLog(logMessage, LogNameEnum.ROBOT);
        const chuteInfo = await validateAssignedItemChuteNo(chuteNo, item);
        await updateChuteBindingAssignedStatusV3(chuteInfo, routeName, item.jobId);
        await updateJob(item.jobId, chuteInfo);
        await updateItemAssigned(item);
        await insertChuteDetailV3(item, chuteInfo.id, chuteNo, routeName, assignedChute);
        pkg.barcode = barcode;
        pkg.status = PackageMonitorStatusEnum.SORTING;
        pkg.weight = weight;
        pkg.chuteNo = chuteNo;
        pkg.terminal = pendingItem.terminal;
        pkg.waveNo = pendingItem.waveNo;
        pkg.routeNo = pendingItem.chuteKey;
        await saveScanPackage(pkg);
        const data = {
            chuteNo: chuteNo,
            barcode: barcode,
            opTime: new Date().getTime(),
        };
        await recordLog({
            logType: LogTypeEnum.GET_DESTINATION,
            logName: LogNameEnum.ROBOT,
            message: logMessage,
            data: stringify(params),
        });
        await pushGetDestinationCallback(data);
        return httpSuccess(res, data);
    } catch (e: any) {
        const packageMonitors = await getPackagesMonitor({ trackingNo: barcode });
        const pkg = _.isEmpty(packageMonitors) ? {} : _.head(packageMonitors);
        const exceptionChuteNo = await getDropOffExceptionChuteNo(traceId, dropOffNo);
        if (_.isEmpty(exceptionChuteNo)) {
            return _robotError(
                `${traceId}-getExceptionChute exception chute not found`,
                params,
                res
            );
        }
        pkg.barcode = barcode;
        pkg.status = PackageMonitorStatusEnum.EXCEPTION;
        pkg.weight = weight;
        pkg.chuteNo = exceptionChuteNo;
        pkg.exceptionReason = JSON.stringify(e);
        await saveScanPackage(pkg);
        const data = await errMessage(
            `${traceId}-getExceptionChute ${JSON.stringify(e)}, to ChuteNo:${exceptionChuteNo}`,
            params,
            exceptionChuteNo,
            barcode
        );
        return httpSuccess(res, data);
    } finally {
        const endTime = Date.now();
        const elapsedMs = endTime - startTime;
        console.info(`${traceId}-getDestination elapsed ${elapsedMs} ms`);
        if (elapsedMs >= 2000) {
            logger.infoLog(`${traceId}-getDestination slow elapsed ${elapsedMs} ms`, LogNameEnum.SLOW_SQL);
        }
    }
};

const getAmazonawsPackage = async (barcode: string) => {
    const url = 'https://rr25p2li17.execute-api.us-east-2.amazonaws.com/prod/package';
    const config = {
        headers: {
            'X-Api-Key': 'x9zRX8a7S88QBOGW2Gamq30Xz4Rzw9WE4QeAKy4o',
            'Content-Type': 'application/json',
        },
    };
    if (global.socketConnected && !global.getAmazonawsPackageQueue) {
        try {
            global.getAmazonawsPackageQueue = true;
            const packageRes = await axios.post(url, {barcode}, config);
            console.log('getAmazonawsPackage packageRes:', packageRes);
            const packagedetails = _.get(packageRes, 'data.Package.packagedetails') || {};
            if (_.isEmpty(packagedetails)) {
                await db.insert(TABLE.LOG, {
                    platform: global.platform.name,
                    logType: LogTypeEnum.WISE_REQUEST,
                    logName: LogNameEnum.EXCEPTION,
                    message: 'packagedetails is null',
                    isException: 1,
                    data: JSON.stringify({
                        url: url,
                        body: {barcode},
                        config: config,
                        method: 'post',
                    }),
                });
                global.getAmazonawsPackageQueue = false;
                return;
            }
            const wave = await db.getOne(TABLE.WAVE, { platform: global.platform.name, status: WaveStatusEnum.RUNNING });
            if (_.isEmpty(wave)) {
                console.log('getAmazonawsPackage wave is not running');
                await db.insert(TABLE.QUEUE, {
                    url,
                    data: JSON.stringify({barcode}),
                    config: JSON.stringify(config),
                    platform: platform.name,
                    type: QueueTypeEnum.GET_AMAZONAWS_PACKAGE,
                    createdWhen: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                });
                global.getAmazonawsPackageQueue = false;
                return;
            }
            const route = packagedetails.route ? packagedetails.route : '000.LSO';
            const terminal = packagedetails.terminalCode ? packagedetails.terminalCode : '000';
            const existsJob = await getJobByWaveIdAndChuteKey(wave.id, route, terminal);
            let jobId = 0;
            console.log('existsJob', existsJob);
            if (existsJob) {
                jobId = existsJob['id'];
                console.log('existsJob.status', existsJob.status);
                if (existsJob.status == JobStatusEnum.COMPLETED) {
                    await updateJobStatus(jobId, JobStatusEnum.ASSIGNED);
                }
            } else {
                jobId = await saveJob({
                    waveId: wave.id,
                    waveNo: wave.waveNo,
                    chuteKey: route,
                    status: JobStatusEnum.UNASSIGNED,
                    terminal: terminal,
                });
            }
            const existsItems = await searchJobItemByBarcode(barcode);
            const itemEntity = {
                waveId: wave.id,
                waveNo: wave.waveNo,
                chuteKey: route,
                jobId: jobId,
                itemId: packagedetails.itemId,
                itemName: packagedetails.itemName,
                barcode: barcode,
                shipToAddress: JSON.stringify({
                    address: `${packagedetails.toaddressline1} ${packagedetails.toaddressline2}, ${packagedetails.tocity}, ${packagedetails.tostate}, ${packagedetails.tozipcode}`,
                    toAddress1: packagedetails.toaddressline1,
                    toAddress2: packagedetails.toaddressline2,
                    toCity: packagedetails.tocity,
                    toState: packagedetails.tostate,
                    toCountry: 'USA',
                }),
                weight: packagedetails.weight,
                volume: packagedetails.volume,
                length: packagedetails.length,
                height: packagedetails.height,
                width: packagedetails.width,
                cubicFeet: packagedetails.cubicFeet,
                packageType: !_.isNil(packagedetails.height) && packagedetails.height > 0 ? 'Box' : 'Poly Bag',
                zipcode: packagedetails.tozipcode,
                qty: 1,
                assignedQty: 0,
                status: JobItemStatusEnum.UNASSIGNED,
            };
            if (_.isEmpty(existsItems)) {
                await saveItem(itemEntity);
            } else {
                await updateJobItem(existsItems[0].id, itemEntity);
            }
            await updateJobQty(jobId);
        } catch (e: any) {
            await db.insert(TABLE.LOG, {
                platform: global.platform.name,
                logType: LogTypeEnum.WISE_REQUEST,
                logName: LogNameEnum.EXCEPTION,
                message: e.message,
                isException: 1,
                data: JSON.stringify({
                    url: url,
                    body: {barcode},
                    config: config,
                    method: 'post',
                }),
            });
        } finally {
            global.getAmazonawsPackageQueue = false;
        }
    } else {
        await db.insert(TABLE.QUEUE, {
            url,
            data: JSON.stringify({barcode}),
            config: JSON.stringify(config),
            platform: platform.name,
            type: QueueTypeEnum.GET_AMAZONAWS_PACKAGE,
            createdWhen: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        });
    }
};

const _robotError = async (errorMessage: string, params: any, res: any): Promise<boolean> => {
    logger.error(errorMessage, LogNameEnum.ROBOT);
    await recordExceptionLog({
        logType: LogTypeEnum.GET_DESTINATION,
        logName: LogNameEnum.ROBOT,
        message: errorMessage,
        data: stringify(params),
    });
    return httpError(res, errorMessage);
};

export const searchItemsByBarcodes = async (barcodes: string[]) => {
    if (_.isEmpty(barcodes)) throw new Error('barcodes is not empty');
    const sql = `select a.*,b.waveNo,c.chuteNo,c.chuteNos,c.chuteId,c.jobQty,c.terminal,c.chuteKey from ${TABLE.JOB_ITEM} a
            left join ${TABLE.WAVE} b on a.waveId=b.id
            left join ${TABLE.JOB} c on a.jobId=c.id
            where a.barcode in ("${_.join(barcodes, '","')}") and b.status=? and b.platform=?`;
    const items: any = await db.queryBySQL(sql, [
        WaveStatusEnum.RUNNING,
        global.platform.name,
    ]);
    console.log('searchItemsByBarcodes', items);
    return items;
};

export const searchItemsByKey = async (key: string) => {
    // 根据barcode查找package
    const sql = `select a.*,b.waveNo,c.chuteNo,c.chuteNos,c.chuteId,c.jobQty,c.terminal,c.chuteKey from ${TABLE.JOB_ITEM} a
            left join ${TABLE.WAVE} b on a.waveId=b.id
            left join ${TABLE.JOB} c on a.jobId=c.id
            where a.barcode like '%${key}%' and b.status=? and b.platform=? limit 10`;
    // 根据barcode查找可分配的item
    const items: any = await db.queryBySQL(sql, [
        WaveStatusEnum.RUNNING,
        global.platform.name,
    ]);
    return items;
};

const _getItems = async (barcode: string) => {
    // 根据barcode查找package
    const sql = `select a.*,b.waveNo,c.chuteNo,c.chuteNos,c.chuteId,c.jobQty,c.terminal,c.chuteKey from ${TABLE.JOB_ITEM} a
            left join ${TABLE.WAVE} b on a.waveId=b.id
            left join ${TABLE.JOB} c on a.jobId=c.id
            where a.barcode=? and b.status=? and b.platform=?`;
    // 根据barcode查找可分配的item
    const items: any = await db.queryBySQL(sql, [
        barcode,
        WaveStatusEnum.RUNNING,
        global.platform.name,
    ]);
    return items;
};

// 获取包裹数据
const _getPackage = async (barcode: string) => {
    const packageMonitors = await getPackagesMonitor({ trackingNo: barcode });
    const pkg = _.isEmpty(packageMonitors) ? {} : _.head(packageMonitors);
    // if (!_.isEmpty(pkg) && _.eq(pkg.chuteType, ChuteTypeEnum.ROUTE) && _.eq(pkg.status, PackageMonitorStatusEnum.BONDED)) {
    //     throw new Error(`${traceId}-getExceptionChute current ${barcode} is Bounded!`);
    // }
    // 判断是否是二次scan
    if (!_.isEmpty(pkg)) {
        pkg.barcode = pkg.trackingNo;
        pkg.status = PackageMonitorStatusEnum.UNSORTED;
        pkg.chuteNo = '';
        pkg.routeNo = '';
        pkg.labelCode = '';
        pkg.exceptionReason = '';
        await updateScanPackage(pkg);
    }
    return pkg;
};

// 获取投料口的Exception格口
const getDropOffExceptionChuteNo = async (traceId: string, dropOffNo: string) => {
    const groups = await db.queryBySQL(
        `select * from ${TABLE.GROUP} where platform=? and dropOffPoints like ?`,
        [global.platform.name, `%${dropOffNo}%`]
    );
    let exceptionChuteNos = [];
    if (!_.isEmpty(groups)) {
        const groupIds = _.map(groups, 'id');
        const exceptionChutes = await db.queryBySQL(
            `select * from ${TABLE.CHUTE}
             where platform=?
             and chuteType='${ChuteTypeEnum.EXCEPTION}'
             and isEnabled=1
             and groupId in (${groupIds.join(',')})
             order by chuteNo asc`,
            [global.platform.name]
        );
        exceptionChuteNos = _.map(exceptionChutes, 'chuteNo');
    }
    if (_.isEmpty(exceptionChuteNos)) {
        const exceptionChutes = await db.queryBySQL(
            `select * from ${TABLE.CHUTE}
             where platform=?
             and chuteType='${ChuteTypeEnum.EXCEPTION}'
             and isEnabled=1
             order by chuteNo asc`,
            [global.platform.name]
        );
        exceptionChuteNos = _.map(exceptionChutes, 'chuteNo');
    }
    if (_.isEmpty(exceptionChuteNos)) return;
    const cuteNo = await distributionChuteNo(
        cache.getCache('lastExceptionChuteNo') || '',
        exceptionChuteNos
    );
    cache.setCache('lastExceptionChuteNo', cuteNo);
    return cuteNo;
};

const distributionChuteNo = (lastChuteNo: string, assignableChutes: string[]) => {
    if (lastChuteNo) {
        const curId = _.findIndex(assignableChutes, (no: string) => no == lastChuteNo) + 2;
        const nextId = curId > _.size(assignableChutes) ? (curId - _.size(assignableChutes)) : curId;
        return assignableChutes[nextId - 1];
    } else {
        return _.head(assignableChutes);
    }
}

const errMessage = async (errorMessage: string, params: any, chuteNo: string, barcode: string) => {
    logger.error(errorMessage, LogNameEnum.ROBOT);
    await recordExceptionLog({
        logType: LogTypeEnum.GET_DESTINATION,
        logName: LogNameEnum.ROBOT,
        message: errorMessage,
        data: stringify(params),
    });
    const data = {
        chuteNo: chuteNo,
        barcode: barcode,
        chuteType: ChuteTypeEnum.EXCEPTION,
        opTime: new Date().getTime(),
    };
    await pushGetDestinationCallback(data);
    return data;
};

// v4:get items时加锁
const getDestinationV4 = async (res: any, params: any) => {
    logger.infoLog(`getDestination ${stringify(params)}`, LogNameEnum.ROBOT);
    if (!params || !params['barcode']) {
        return httpError(res, 'invalid post data');
    }
    const startTime = Date.now();
    const _db = await getDBForTransaction();
    try {
        const barcode = params['barcode'];
        await tryInitDBIfNeed();
        await tryGetPlatformIfNeed();
        try {
            // 根据barcode查找可分配的item，满包和集包状态都可继续分配
            logger.info('getDestination_items begin');
            const items = await LockService.acquire('getDestination_items', async () => {
                return await _db.queryBySQL(`
            SELECT a.*, b.waveNo, c.chuteNo, c.chuteNos, c.chuteId, c.jobQty
            FROM ${TABLE.JOB_ITEM} a
            LEFT JOIN ${TABLE.WAVE} b ON a.waveId = b.id
            LEFT JOIN ${TABLE.JOB} c ON a.jobId = c.id
            WHERE a.barcode = ? AND b.status = ? AND b.platform = ? AND a.assignedQty < a.qty`,
                    [barcode, WaveStatusEnum.RUNNING, global.platform.name],
                );
            });
            logger.info('getDestination_items end ' + JSON.stringify(items));

            let chuteNo = '';
            if (_.isEmpty(items)) {
                chuteNo = await tryPutExceptionChuteIfError(barcode, 'not found item');
                const errorMessage = `getExceptionChute NO_JOB_FOUND, to ChuteNo:${chuteNo}`;
                logger.error(errorMessage, LogNameEnum.ROBOT);
                await recordExceptionLog({
                    logType: LogTypeEnum.GET_DESTINATION,
                    logName: LogNameEnum.ROBOT,
                    message: errorMessage,
                    data: stringify(params),
                });
                const data = {
                    chuteNo: chuteNo,
                    barcode: barcode,
                    chuteType: ChuteTypeEnum.EXCEPTION,
                    opTime: new Date().getTime(),
                };
                await pushGetDestinationCallback(data);
                return httpSuccess(res, data);
            }

            const userStrategies = await getExecuteBusinessStrategies();
            const assignedChute = await strategyService.executeStrategy(userStrategies, items);
            // 未找到格口,放到异常格口
            if (!assignedChute) {
                chuteNo = await tryPutExceptionChuteIfError(barcode, 'not found idle chute');
                const errorMessage = `getExceptionChute NO_IDLE_CHUTE_AVAILABLE, to ChuteNo:${chuteNo}`;
                logger.error(errorMessage, LogNameEnum.ROBOT);
                await recordExceptionLog({
                    logType: LogTypeEnum.GET_DESTINATION,
                    logName: LogNameEnum.ROBOT,
                    message: errorMessage,
                    data: stringify(params),
                });
                const data = {
                    chuteNo: chuteNo,
                    barcode: barcode,
                    chuteType: ChuteTypeEnum.EXCEPTION,
                    opTime: new Date().getTime(),
                };
                await pushGetDestinationCallback(data);
                return httpSuccess(res, data);
            }
            // 允许 collect package及 full package状态的格口使用
            const item = assignedChute.item;
            chuteNo = assignedChute.chuteNo;
            const logMessage = `get chuteNo:${chuteNo} for barcode:${barcode} by strategy:${assignedChute.strategyName} strategyType:${assignedChute.strategyType}`;
            logger.infoLog(logMessage, LogNameEnum.ROBOT);
            const chuteInfo = await validateAssignedItemChuteNo(chuteNo, item);
            await updateChuteBindingAssignedStatus(chuteInfo, item.chuteKey, item.jobId);
            await updateJob(item.jobId, chuteInfo);
            await updateItemAssigned(item);
            await insertChuteDetail(item, chuteInfo.id, chuteNo, assignedChute);
            const data = {
                chuteNo: chuteNo,
                barcode: barcode,
                opTime: new Date().getTime(),
            };
            await recordLog({
                logType: LogTypeEnum.GET_DESTINATION,
                logName: LogNameEnum.ROBOT,
                message: logMessage,
                data: stringify(params),
            });
            await pushGetDestinationCallback(data);
            return httpSuccess(res, data);
        } catch (e: any) {
            const errorMessage = `getDestination error ${e.message}`;
            logger.error(errorMessage + `${e.stack}`, LogNameEnum.ROBOT);
            await recordExceptionLog({
                logType: LogTypeEnum.GET_DESTINATION,
                logName: LogNameEnum.ROBOT,
                message: errorMessage,
                data: stringify(params),
            });
            return httpError(res, e.message);
        }
    } finally {
        await _db.close();
        const endTime = Date.now();
        const elapsedMs = endTime - startTime;
        console.info(` getDestination elapsed ${elapsedMs} ms`);
        if (elapsedMs >= 2000) {
            logger.infoLog(`getDestination slow elapsed ${elapsedMs} ms`, LogNameEnum.SLOW_SQL);
        }

    }
};

const getDestinationV1 = async (res: any, params: any) => {
    logger.infoLog(`getDestination ${stringify(params)}`, LogNameEnum.ROBOT);
    if (!params || !params['barcode']) {
        return httpError(res, 'invalid post data');
    }
    const barcode = params['barcode'];
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    try {
        // 根据barcode查找可分配的item，满包和集包状态都可继续分配
        const item = await db.getOneBySQL(`select a.*,c.chuteNo,c.chuteId,b.waveNo from ${TABLE.JOB_ITEM} a
            left join ${TABLE.WAVE} b on a.waveId=b.id
            left join ${TABLE.JOB} c on a.jobId=c.id
            where a.barcode=? and b.status=? and b.platform=? and a.assignedQty<qty
            order by a.id asc limit 1`,
            [barcode, WaveStatusEnum.RUNNING, global.platform.name]);
        let chuteNo;
        if (!item) {
            chuteNo = await tryPutExceptionChuteIfError(barcode, 'not found item');
            const errorMessage = `getExceptionChute NO_JOB_FOUND, to ChuteNo:${chuteNo}`;
            logger.error(errorMessage, LogNameEnum.ROBOT);
            await recordExceptionLog({
                logType: LogTypeEnum.GET_DESTINATION,
                logName: LogNameEnum.ROBOT,
                message: errorMessage,
                data: stringify(params),
            });
            const data = {
                chuteNo: chuteNo,
                barcode: barcode,
                chuteType: ChuteTypeEnum.EXCEPTION,
                opTime: new Date().getTime(),
            };
            await pushGetDestinationCallback(data);
            return httpSuccess(res, data);
            //throw new Error(`barcode:${barcode} not found item or wave not running`);
        }
        // 原来已分配过格口,继续使用原格口
        if (item.chuteNo) {
            // 允许 collect package及 full package状态的格口使用
            await validateAssignedItemChuteNo(item.chuteNo, item);
            await updateItemAssigned(item);
            await insertChuteDetail(item, item.chuteId, item.chuteNo);
            chuteNo = item.chuteNo;
        } else {
            // 未分配格口，分配全新格口
            const chuteInfo = await db.getOneBySQL(`select a.*,b.workStatus,b.chuteKey from ${TABLE.CHUTE} a
                left join ${TABLE.CHUTE_BINDING} b
                on a.id=b.chuteId
                where b.workStatus=? and a.platform=? and a.chuteType<>'${ChuteTypeEnum.EXCEPTION}' and a.isEnabled=1 order by chuteNoInt asc`, [ChuteWorkStatusEnum.IDLE, global.platform.name]);
            if (chuteInfo) {
                await updateItemAssigned(item);
                await updateChuteBindingAssignedStatus(chuteInfo, item.chuteKey, item.jobId);
                await updateJob(item.jobId, chuteInfo);
                await insertChuteDetail(item, chuteInfo.id, chuteInfo.chuteNo);
                chuteNo = chuteInfo.chuteNo;
            } else {
                chuteNo = await tryPutExceptionChuteIfError(barcode, 'not found idle chute');
                const errorMessage = `getExceptionChute NO_IDLE_CHUTE_AVAILABLE, to ChuteNo:${chuteNo}`;
                logger.error(errorMessage, LogNameEnum.ROBOT);
                await recordExceptionLog({
                    logType: LogTypeEnum.GET_DESTINATION,
                    logName: LogNameEnum.ROBOT,
                    message: errorMessage,
                    data: stringify(params),
                });
                const data = {
                    chuteNo: chuteNo,
                    barcode: barcode,
                    chuteType: ChuteTypeEnum.EXCEPTION,
                    opTime: new Date().getTime(),
                };
                await pushGetDestinationCallback(data);
                return httpSuccess(res, data);
            }
        }
        const data = {
            chuteNo: chuteNo,
            barcode: barcode,
            opTime: new Date().getTime(),
        };
        await recordLog({
            logType: LogTypeEnum.GET_DESTINATION,
            logName: LogNameEnum.ROBOT,
            message: `get chuteNo:${chuteNo}`,
            data: stringify(params),
        });
        await pushGetDestinationCallback(data);
        return httpSuccess(res, data);
    } catch (e: any) {
        const errorMessage = `getDestination error ${e.message}`;
        logger.error(errorMessage, LogNameEnum.ROBOT);
        await recordExceptionLog({
            logType: LogTypeEnum.GET_DESTINATION,
            logName: LogNameEnum.ROBOT,
            message: errorMessage,
            data: stringify(params),
        });
        return httpError(res, e.message);
    }
};

const dealCallbackMessage = async (params: any, logType: string) => {
    logger.infoLog(`dealCallbackMessage ${stringify(params)}`, LogNameEnum.CALLBACK);
    if (_.isEmpty(params)) return;
    if (!params.url) return;

    // 相同的合并
    if (!_.isEmpty(params.data.details)) {
        // 对相同 barcode 的 qty 合并
        const groupedData = _.groupBy(params.data.details, 'barcode');
        const aggregatedData = _.map(groupedData, (items: any, barcode: any) => ({
            barcode,
            qty: _.sumBy(items, 'qty'),
        }));
        params.data.details = aggregatedData;
    }

    let method = params.method || 'post';
    method = method.toLowerCase();
    const config = { timeout: 15000, headers: {} };
    if (params.header) {
        config.headers = params.header;
    }
    try {
        // @ts-ignore
        const res = await axios[method](params.url, params.data || {}, config);
        logger.infoLog(`dealCallbackMessage ${logType} success: ${stringify(res.data)}`, LogNameEnum.CALLBACK);
        await recordLog({
            logType: logType,
            logName: LogNameEnum.CALLBACK,
            message: `success`,
            data: '',
        });
        return res.data;
    } catch (e: any) {
        logger.error(`dealCallbackMessage ${logType} error: ${e.message}  params:${stringify(params)}`, LogNameEnum.CALLBACK);
        await recordExceptionLog({
            logType: logType,
            logName: LogNameEnum.CALLBACK,
            message: `error: ${e.message}`,
            data: '',
        });
        return { code: 500, message: e.message };
    }
};

const validateJobIsCompleted = async (jobId: any) => {
    // 判断订单是否完成
    const jobItemLeftNum = await db.getCount(TABLE.JOB_ITEM, {
        jobId: jobId,
        status_NE: JobItemStatusEnum.COMPLETED,
    });
    const chuteDetailLeftNum = await db.getCount(TABLE.CHUTE_DETAIL, {
        jobId: jobId,
        status_NE: ChuteDetailStatusEnum.DONE,
    });
    // job item都已做完 且 都已 fallingParts
    if (jobItemLeftNum === 0 && chuteDetailLeftNum === 0) {
        return true;
    }
    return false;
};

const validateChuteIsCompleted = async (jobId: any, chuteNo: any) => {
    // 判断订单是否完成
    const jobItemLeftNum = await db.getCount(TABLE.JOB_ITEM, {
        jobId: jobId,
        status_NE: JobItemStatusEnum.COMPLETED,
    });
    const chuteDetailLeftNum = await db.getCount(TABLE.CHUTE_DETAIL, {
        jobId: jobId,
        chuteNo: chuteNo,
        status_NE: ChuteDetailStatusEnum.DONE,
    });
    // job item都已做完 且 都已 fallingParts
    if (jobItemLeftNum === 0 && chuteDetailLeftNum === 0) {
        return true;
    }
    return false;
};

const deleteChuteDetailByJobAndChuteNoIfAssigned = async (jobId: any, chuteNo: any) => {
    const details = await db.query(TABLE.CHUTE_DETAIL, {
        jobId: jobId,
        chuteNo: chuteNo,
        status: ChuteDetailStatusEnum.DONE,
    });
    for (const detail of details) {
        await insertChuteDetailHistoryByDetailId(detail.id, OperationTypeEnum.DELETE);
        await db.delete(TABLE.CHUTE_DETAIL, { id: detail.id });
    }
};

const updateWaveIfCompleted = async (jobId: any) => {
    const job = await getJobById(jobId);
    if (job.status == JobStatusEnum.COMPLETED) {
        const waveId = job.waveId;
        const jobLeftNum = await db.getCount(TABLE.JOB, {
            waveId: waveId,
            status_NE: JobStatusEnum.COMPLETED,
        });
        if (jobLeftNum === 0) {
            await updateWaveStatus(waveId, WaveStatusEnum.COMPLETED);
        }
    }
};

const updateJobIfCompleted = async (jobId: any) => {
    if (!await validateJobIsCompleted(jobId)) return;
    await updateJobStatus(jobId, JobStatusEnum.COMPLETED);
};

const updateWaveStatus = async (waveId: any, status: any) => {
    await db.update(TABLE.WAVE, { status: status }, { id: waveId });
};

const pushGetDestinationCallback = async (data: any) => {
    if (!global.platform.getDestinationCallback) return;
    const getDestinationCallback = _.cloneDeep(global.platform.getDestinationCallback);
    getDestinationCallback.data = data;
    dealCallbackMessage(getDestinationCallback, LogTypeEnum.GET_DESTINATION_CALLBACK);
};


const fallingPartsIfJobCompleted = async (chuteDetail: any) => {
    if (!await validateChuteIsCompleted(chuteDetail.jobId, chuteDetail.chuteNo)) return;
    await updateChuteBindingStatus({ id: chuteDetail.chuteId }, ChuteWorkStatusEnum.COLLECT_PACKAGE);
    // 给wes推送Job完成信息

    if (global.platform.binCloseUrl) {
        dealCallbackMessage({
            url: global.platform.binCloseUrl,
            data: { chuteNo: chuteDetail.chuteNo },
        }, LogTypeEnum.BIN_CLOSE_CALLBACK);
    }
};

const fallingPartsAfterIfNeed = async (detail: any) => {
    //已 fallingParts
    if (!await validateJobIsCompleted(detail.jobId)) return;
    const sql = `select a.*,b.waveNo,c.terminal,c.chuteKey from ${TABLE.JOB_ITEM} a
            left join ${TABLE.WAVE} b on a.waveId=b.id
            left join ${TABLE.JOB} c on a.jobId=c.id
            where b.platform=? and a.jobId=? and a.assignedQty < a.qty`;
    const paramsArr = [global.platform.name, detail.jobId];
    const itemList = await db.queryBySQL(sql, paramsArr);
    if (!_.isEmpty(itemList)) return;
    await updateJobStatus(detail.jobId, JobStatusEnum.COMPLETED);
    // await updateWaveIfCompleted(detail.jobId);
};

const verifyChuteDetailsIsTheSame = async (fullPackageData: any, fullPackageDataDetails: any, details: any) => {
    // 相同的合并
    if (!_.isEmpty(fullPackageDataDetails)) {
        // 对相同 barcode 的 qty 合并
        const groupedData = _.groupBy(fullPackageDataDetails, 'barcode');
        const aggregatedData = _.map(groupedData, (items: any, barcode: any) => ({
            barcode,
            qty: _.sumBy(items, 'qty'),
        }));
        fullPackageDataDetails = _.orderBy(aggregatedData, ['barcode'], ['asc']);
    }

    if (!_.isEmpty(details)) {
        // 对相同 barcode 的 qty 合并
        const groupedData = _.groupBy(details, 'barcode');
        const aggregatedData = _.map(groupedData, (items: any, barcode: any) => ({
            barcode,
            qty: _.sumBy(items, 'qty'),
        }));
        details = _.orderBy(aggregatedData, ['barcode'], ['asc']);
    }
    if (!_.isEqual(fullPackageDataDetails, details)) {
        // 找出不同的 barcode 及其对应的数量
        const differentQuantities: any = {};
        _.forEach(fullPackageDataDetails, (item: any) => {
            const correspondingDetail = details.find((detail: any) => detail.barcode === item.barcode);
            if (!correspondingDetail || correspondingDetail.qty !== item.qty) {
                differentQuantities[item.barcode] = {
                    fullPackageDataQty: item.qty,
                    detailsQty: correspondingDetail ? correspondingDetail.qty : 0,
                };
            }
        });
        _.forEach(details, (item: any) => {
            const correspondingDetail = fullPackageDataDetails.find((detail: any) => detail.barcode === item.barcode);
            if (differentQuantities[item.barcode]) return;
            if (!correspondingDetail || correspondingDetail.qty !== item.qty) {
                differentQuantities[item.barcode] = {
                    fullPackageDataQty: correspondingDetail ? correspondingDetail.qty : 0,
                    detailsQty: item.qty,
                };
            }
        });
        const errorMessage = `chuteNo:${fullPackageData.chuteNo} qty is not the same! Different quantities: ${JSON.stringify(differentQuantities)}`;
        logger.error(`${errorMessage} fullPackageData:${stringify(fullPackageData)}  fullPackageDataDetails:${stringify(fullPackageDataDetails)} details:${stringify(details)}`, LogNameEnum.EXCEPTION);
        throw new Error(errorMessage);
    }
};

// 满包时也做集包操作
const collectPackageIfFullPackage = async (chuteInfo: any, fullPackageData: any, workStatus: string) => {
    console.log('collectPackageIfFullPackage', {
        chuteInfo,
        fullPackageData,
    });
    // 异常格口满包时不做其它操作
    if (chuteInfo.chuteType == ChuteTypeEnum.EXCEPTION) return;
    const job = await getJobById(chuteInfo.jobId);
    if (!job) {
        throw new Error(`chuteNo:${chuteInfo.chuteNo} not found job`);
    }
    if (!chuteInfo.jobId || chuteInfo.jobId != job.id) {
        throw new Error(`chuteNo:${chuteInfo.chuteNo} jobId is not the same! chuteInfo.jobId:${chuteInfo.jobId} job.id:${job.id}`);
    }
    // 发送集包信息
    let packageType = PackageTypeEnum.FULL_PACKAGE;
    const chuteIsCompleted = await validateChuteIsCompleted(job.id, chuteInfo.chuteNo);
    if (chuteIsCompleted) {
        packageType = PackageTypeEnum.COLLECT_PACKAGE;
    }
    const collectPackageData = {
        waveNo: job.waveNo,
        chuteNo: chuteInfo.chuteNo,
        packageNo: fullPackageData.packageNo,
        packageTime: dayjs().valueOf(),
        packageType: packageType,
        platform: global.platform.name,
        chuteKey: chuteInfo.chuteType == ChuteTypeEnum.ROUTE ? chuteInfo.routeName : '',
    };
    // 满包时只判断是否已落下的要集包
    let details;
    if (chuteInfo.chuteType == ChuteTypeEnum.ROUTE) {
        details = await db.query(TABLE.CHUTE_DETAIL, {
            jobId: job.id,
            chuteNo: chuteInfo.chuteNo,
            status: ChuteDetailStatusEnum.DONE,
        });
    } else {
        details = await db.query(TABLE.CHUTE_DETAIL, {
            chuteNo: chuteInfo.chuteNo,
            status: ChuteDetailStatusEnum.DONE,
        });
    }
    if (_.isEmpty(details)) {
        throw new Error(`chuteNo:${chuteInfo.chuteNo} not found job details`);
    }
    await updateChuteBindingStatus(chuteInfo, workStatus);
    await insertPackageAndDetail(collectPackageData, details);
    await updateJobIfCompleted(job.id);
    // await updateWaveIfCompleted(job.id);
    // 非手动释放格口时 fullPackage通知时就清空格口里的物品
    if (!global.platform.needToReleaseChute) {
        await releaseChuteByFullPackage(chuteInfo);
    }
};

const fallingParts = async (res: any, params: any) => {
    logger.infoLog(`fallingParts ${stringify(params)}`, LogNameEnum.ROBOT);
    if (!params['barcode'] && params['barCode']) {
        params['barcode'] = params['barCode'];
    }
    if (!params || !params['barcode'] || !params.chuteNo) {
        return httpError(res, 'invalid fallingParts data');
    }
    const barcode = params['barcode'];
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    try {
        // 先获取格口的routeName
        const chuteInfo = await getChuteInfoByChuteNo(params.chuteNo);
        if (!chuteInfo) {
            const message = `chuteNo:${params.chuteNo} not found`;
            const errorMessage = `fallingParts error ${message}`;
            logger.error(errorMessage, LogNameEnum.ROBOT);
            await recordExceptionLog({
                logType: LogTypeEnum.FALLING_PARTS,
                logName: LogNameEnum.ROBOT,
                message: errorMessage,
                data: stringify(params),
            });
            return httpError(res, message);
        }
        // barcode对应的job投递数目数加1
        const items = await db.query(TABLE.JOB_ITEM, { barcode: barcode });
        if (!_.isEmpty(items)) {
            const jobs = await db.query(TABLE.JOB, { id: items[0].jobId });
            if (!_.isEmpty(jobs)) {
                const qty = _.isNil(jobs[0].sortedQty) ? 1 : (jobs[0].sortedQty + 1);
                await db.update(TABLE.JOB, { sortedQty: qty }, { id: jobs[0].id });
            }
        }
        // 异常格口落下时不做操作
        if (chuteInfo.chuteType == ChuteTypeEnum.EXCEPTION) {
            return httpSuccess(res, {});
        }
        // 再根据chuteKey获取格口的详细信息
        const detail = await db.getOneBySQL(`select * from ${TABLE.CHUTE_DETAIL}
            where platform=? and chuteNo=? and status=? and routeName=? order by createdAt asc limit 1`,
            [global.platform.name, params.chuteNo, ChuteDetailStatusEnum.IN_TRANSIT, chuteInfo.routeName]);
        if (!detail) {
            const message = `chuteNo:${params.chuteNo} barcode:${barcode} not found in chute item detail`;
            const errorMessage = `fallingParts error ${message}`;
            logger.error(errorMessage, LogNameEnum.ROBOT);
            await recordExceptionLog({
                logType: LogTypeEnum.FALLING_PARTS,
                logName: LogNameEnum.ROBOT,
                message: errorMessage,
                data: stringify(params),
            });
            return httpError(res, message);
        }
        detail.status = ChuteDetailStatusEnum.DONE;
        detail.taskId = params.taskId;
        detail.scanNo = params.scanNo;
        detail.departTime = params.departTime;
        detail.agvNo = params.agvNo;
        detail.agvUnloadTime = params.agvUnloadTime;
        detail.weight = params.weight;
        detail.event_date = dayjs().format('YYYY-MM-DD');
        await fallingPartsAfterIfNeed(detail);
        await db.update(TABLE.CHUTE_DETAIL, detail, { id: detail.id });
        await insertChuteDetailHistoryByDetailId(detail.id, OperationTypeEnum.UPDATE);
        await updatePackage(barcode);
        const logMessage = `chuteNo:${params.chuteNo} ok`;
        logger.infoLog(logMessage, LogNameEnum.ROBOT);
        await recordLog({
            logType: LogTypeEnum.FALLING_PARTS,
            logName: LogNameEnum.ROBOT,
            message: logMessage,
            data: JSON.stringify(detail),
        });
        return httpSuccess(res, {});
    } catch (e: any) {
        const errorMessage = `fallingParts error ${e.message}`;
        logger.error(errorMessage, LogNameEnum.ROBOT);
        await recordExceptionLog({
            logType: LogTypeEnum.FALLING_PARTS,
            logName: LogNameEnum.ROBOT,
            message: errorMessage,
            data: stringify(params),
        });
        return httpError(res, e.message);
    }
};

export const getGroupList = async (params?: any) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    let sql = `select * from ${TABLE.GROUP} where platform=?`;
    const sqlParams = [global.platform.name];
    if (params) {
        if (params.groupName) {
            sql += ` and groupName like ?`;
            sqlParams.push(`%${params.groupName}%`);
        }
        if (!_.isNil(params.isEnabled)) {
            sql += ` and isEnabled = ${params.isEnabled}`;
        }
        if (params.groupIds) {
            sql += ` and id in (${_.join(params.groupIds, ',')})`;
        }
        if (params.dropOffNo) {
            sql += ` and dropOffPoints like ?`;
            sqlParams.push(`%${params.dropOffNo}%`);
        }
        if (params.groupNameIn) {
            sql += ` and groupName in ("${_.join(params.groupNameIn, '","')}")`;
        }
    }
    const groupList = await db.queryBySQL(sql, sqlParams);
    const groupIds = _.map(groupList, 'id');
    const detailQueryResult = await db.queryBySQL(`SELECT * FROM ${TABLE.CHUTE} WHERE groupId IN (${groupIds.join(',')})`);
    const dropOffChutes = await db.queryBySQL(`SELECT * FROM ${TABLE.CHUTE} WHERE chuteType='${ChuteTypeEnum.DROP_OFF}'`);
    console.log('detailQueryResult', detailQueryResult);
    const dropOffChuteNo = _.map(dropOffChutes, 'chuteNo');
    groupList.forEach((group: any) => {
        group.chuteList = detailQueryResult.filter((detail: any) => detail.groupId === group.id && detail.chuteType != ChuteTypeEnum.DROP_OFF);
        group.dropOffPoints = _.intersection(dropOffChuteNo, group.dropOffPoints ? group.dropOffPoints.split(",") : []);
    });
    return groupList;
};

export const searchGroupByPaging = async (params: any) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    let sql = `select * from ${TABLE.GROUP} where platform=?`;
    let sqlCount = `select COUNT(*) as totalCount from ${TABLE.GROUP} where platform=?`;
    const sqlParams =  [global.platform.name];
    if (params) {
        if (params.groupName) {
            sql += ` and groupName like ?`;
            sqlCount += ` and groupName like ?`;
            sqlParams.push(`%${params.groupName}%`);
        }
        if (!_.isNil(params.isEnabled)) {
            sql += ` and isEnabled = ${params.isEnabled}`;
            sqlCount += ` and isEnabled = ${params.isEnabled}`;
        }
        if (params.groupIds) {
            sql += ` and id in (${_.join(params.groupIds, ',')})`;
            sqlCount += ` and id in (${_.join(params.groupIds, ',')})`;
        }
        if (params.dropOffNo) {
            sql += ` and dropOffPoints like ?`;
            sqlCount += ` and dropOffPoints like ?`;
            sqlParams.push(`%${params.dropOffNo}%`);
        }
    }
    const totals = await db.queryBySQL(sqlCount, sqlParams);
    const res = {
        data: [],
        paging: {
            totalCount: totals ? totals[0].totalCount : 0,
            pageNo: 1,
            totalPage: 0,
            limit: 20,
        },
    };
    if (res.paging.totalCount === 0) return res;
    if (params.paging) {
        res.paging.limit = params.paging && params.paging.limit ? params.paging.limit : 20;
    }
    res.paging.totalPage = res.paging.totalCount > 0 ? Math.ceil(res.paging.totalCount / res.paging.limit) : 0;
    res.paging.pageNo = params.paging && params.paging.pageNo ? Math.min(params.paging.pageNo, res.paging.totalPage) : 1;
    sql += ` order by id asc LIMIT ? OFFSET ?`;
    sqlParams.push(res.paging.limit, (res.paging.pageNo - 1) * res.paging.limit);
    res.data = await db.queryBySQL(sql, sqlParams);
    const groupIds = _.map(res.data, 'id');
    const detailQueryResult = await db.queryBySQL(`SELECT * FROM ${TABLE.CHUTE} WHERE groupId IN (${groupIds.join(',')})`);
    const dropOffChutes = await db.queryBySQL(`SELECT * FROM ${TABLE.CHUTE} WHERE chuteType='${ChuteTypeEnum.DROP_OFF}'`);
    console.log('detailQueryResult', detailQueryResult);
    const dropOffChuteNo = _.map(dropOffChutes, 'chuteNo');
    res.data.forEach((group: any) => {
        group.chuteList = detailQueryResult.filter((detail: any) => detail.groupId === group.id && detail.chuteType != ChuteTypeEnum.DROP_OFF);
        group.dropOffPoints = _.intersection(dropOffChuteNo, group.dropOffPoints ? group.dropOffPoints.split(",") : []);
    });
    console.log('searchGroupByPaging', res);
    return res;
};

const validateGroupNameExist = async (groupName: string, condition?: any) => {
    const group = await db.getOne(
        TABLE.GROUP,
        Object.assign(
            {
                groupName: groupName,
                platForm: global.platform.name,
            },
            condition,
        ),
    );
    if (group) {
        throw new Error(`Group Name: ${groupName} already exist`);
    }
    return group;
};

const updateChuteGroup = async (group: any) => {
    if (!group.chuteNos) {
        return;
    }
    await db.update(TABLE.CHUTE, { groupId: null, isEnabled: 1 }, { groupId: group.id, chuteNo_NIN: group.chuteNos, platform: global.platform.name });
    await db.update(TABLE.CHUTE, { groupId: group.id, isEnabled: group.isEnabled }, { chuteNo_IN: group.chuteNos , platform: global.platform.name});
};

export const deleteGroup = async (group: any) => {
    await db.delete(TABLE.GROUP, { id: group.id });
    await db.update(TABLE.CHUTE, { groupId: null }, { groupId: group.id });
};

export const saveGroup = async (group: any) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    if (group.id) {
        await validateGroupNameExist(group.groupName, { id_NE: group.id });
        await updateChuteGroup(group);
        return await db.update(TABLE.GROUP, { groupName: group.groupName, dropOffPoints: group.dropOffPoints, isEnabled: group.isEnabled }, { id: group.id });
    }
    await validateGroupNameExist(group.groupName);
    group.id = await db.insert(TABLE.GROUP, { groupName: group.groupName, platform: global.platform.name, dropOffPoints: group.dropOffPoints, isEnabled: group.isEnabled });
    await updateChuteGroup(group);
    return group;
};

const insertPackageAndDetail = async (packageData: any, details: any) => {
    const packageId = await db.insert(TABLE.PACKAGE, packageData);
    for (const detail of details) {
        await db.insert(TABLE.PACKAGE_DETAIL, {
            packageId: packageId,
            chuteDetailId: detail.id || null,
            barcode: detail.barcode || detail.barCode,
            qty: detail.qty,
        });
    }
};

const saveScanPackage = async (item: any) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    if (item.id) {
        console.log('updateScanPackage', item);
        return await updateScanPackage(item);
    } else {
        console.log('addScanPackage', item);
        return await addScanPackage(item);
    }
};

const addScanPackage = async (item: any) => {
    const packageData = {
        trackingNo: item.barcode,
        status: item.status,
        terminal: item.terminal,
        waveNo: item.waveNo,
        routeNo: item.routeNo,
        chuteNo: item.chuteNo,
        label_Code: '',
        exceptionReason: item.exceptionReason,
        createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        platform: global.platform.name,
    };
    const config = await getSortingSetupConfig();
    const configWeight = config.maximumCarryingCapacity;
    if (item.weight && item.weight > configWeight) {
        packageData.status = PackageMonitorStatusEnum.OVERWEIGHT;
    }
    await db.insert(TABLE.packages_monitor, packageData);
};

const updateScanPackage = async (item: any) => {
    const packageData = {
        trackingNo: item.barcode,
        status: item.status,
        terminal: item.terminal,
        waveNo: item.waveNo,
        routeNo: item.routeNo,
        chuteNo: item.chuteNo,
        label_Code: item.labelCode,
        exceptionReason: item.exceptionReason,
        updateTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        platform: global.platform.name,
    };
    await db.update(TABLE.packages_monitor, packageData, { id: item.id });
};

export const removePackageData = async (data: any) => {
    await tryInitDBIfNeed();
    await db.delete(TABLE.packages_monitor, { trackingNo: data.trackingNo });
    const details = await db.query(TABLE.CHUTE_DETAIL, {
        status: ChuteDetailStatusEnum.IN_TRANSIT,
        platform: data.platform,
        barcode: data.trackingNo,
    });
    if (!_.isEmpty(details)) {
        await insertChuteDetailHistoryByDetailId(details[0].id, OperationTypeEnum.DELETE);
        await db.delete(TABLE.CHUTE_DETAIL, { id: details[0].id });
    }
    const jobItem = await db.getOne(TABLE.JOB_ITEM, { barcode: data.trackingNo });
    if (jobItem.assignedQty - 1 === 0) {
        await db.update(
            TABLE.JOB_ITEM,
            { status: JobItemStatusEnum.UNASSIGNED, assignedQty_DEC: 1 },
            { id: jobItem.id }
        );
    } else {
        await db.update(
            TABLE.JOB_ITEM,
            { status: JobItemStatusEnum.ASSIGNED, assignedQty_DEC: 1 },
            { id: jobItem.id }
        );
    }
    const packages = await db.query(TABLE.packages_monitor, {
        platform: data.platform,
        status_IN: [PackageMonitorStatusEnum.SORTING, PackageMonitorStatusEnum.SORTED],
        chuteNo: data.chuteNo,
    });
    if (_.isEmpty(packages)) {
        const chute = await db.getOne(TABLE.CHUTE, {
            chuteNo: data.chuteNo,
            platform: data.platform,
        });
        await db.update(
            TABLE.CHUTE_BINDING,
            {
                workStatus: ChuteWorkStatusEnum.IDLE,
                chuteKey: '',
                jobId: '',
                routeName: '',
            },
            { chuteId: chute.id }
        );
    }
};

const updatePackage = async (barcode: any) => {
    await db.update(TABLE.packages_monitor, { status: 'Sorted', updateTime: dayjs().format('YYYY-MM-DD HH:mm:ss') }, { trackingNo: barcode });
};

const fullPackageInformation = async (res: any, params: any) => {
    logger.infoLog(`fullPackageInformation ${stringify(params)}`, LogNameEnum.ROBOT);
    if (!params || !params.chuteNo) {
        return httpError(res, 'chuteNo is require');
    }
    const chuteNo = params.chuteNo;
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    try {
        const chuteInfo = await getChuteInfoByChuteNo(chuteNo);
        if (!chuteInfo) {
            const message = `chuteNo:${chuteNo} not found chute`;
            const errorMessage = `fullPackageInformation error ${message}`;
            logger.error(errorMessage, LogNameEnum.ROBOT);
            await recordExceptionLog({
                logType: LogTypeEnum.FULL_PACKAGE_INFORMATION,
                logName: LogNameEnum.ROBOT,
                message: errorMessage,
                data: stringify(params),
            });
            return httpError(res, message);
        }
        // 异常格口时释放格口
        if (chuteInfo.chuteType == ChuteTypeEnum.EXCEPTION) {
            const isLibiao = !params.unlibiao;
            await libiaoReleaseChute(isLibiao, chuteInfo.chuteNo);
            return httpSuccess(res, { isExceptionChute: true });
        }
        const fullPackageData = {
            chuteNo: params.chuteNo,
            packageNo: params.packageNo,
            packageTime: params.fullPackageTime,
            packageType: PackageTypeEnum.FULL_PACKAGE,
            isFromReport: 1,
            platform: global.platform.name,
            chuteKey: chuteInfo.chuteKey,
        };
        let workStatus = ChuteWorkStatusEnum.FULL_PACKAGE;
        if (_.eq(chuteInfo.workStatus, ChuteWorkStatusEnum.COLLECT_PACKAGE) || !_.eq(params.source, FullPackageInformationSourceEnum.SENSOR)) {
            workStatus = ChuteWorkStatusEnum.COLLECT_PACKAGE;
        }
        await collectPackageIfFullPackage(chuteInfo, fullPackageData, workStatus);
        const logMessage = `fullPackageInformation chuteNo:${params.chuteNo} packageNo:${params.packageNo} ok`;
        logger.infoLog(logMessage, LogNameEnum.ROBOT);
        await recordLog({
            logType: LogTypeEnum.FULL_PACKAGE_INFORMATION,
            logName: LogNameEnum.ROBOT,
            message: logMessage,
            data: '',
        });
        await collectPackageByWms(params);
        return httpSuccess(res, {});
    } catch (e: any) {
        const errorMessage = `fullPackageInformation error ${e.message}`;
        logger.error(errorMessage, LogNameEnum.ROBOT);
        await recordExceptionLog({
            logType: LogTypeEnum.FULL_PACKAGE_INFORMATION,
            logName: LogNameEnum.ROBOT,
            message: errorMessage,
            data: stringify(params),
        });
        return httpError(res, e.message);
    }
};

const libiaoReleaseChute = async (isLibiao: boolean, chuteNo: string) => {
    console.log('libiaoReleaseChute:', isLibiao, global.platform.binOpenUrl);
    global.platform = await getPlatform();
    console.log('libiaoReleaseChute:', global.platform.binOpenUrl);
    // 通知libiao释放格口
    if (isLibiao && global.platform.binOpenUrl) {
        console.log('libiaoReleaseChute');
        const res: any = await dealCallbackMessage({
                url: global.platform.binOpenUrl,
                data: { chuteNo: chuteNo },
            }, LogTypeEnum.BIN_OPEN_CALLBACK);
        if (res.code == 500) throw new Error('libiao release chute failure');
    }
};

const deletePackage = async (res: any, params: any) => {
    logger.infoLog(`deletePackage ${stringify(params)}`, LogNameEnum.ROBOT);
    if (!params || !params.barcode) {
        return httpError(res, 'invalid deletePackage data');
    }
    const barcode = params.barcode;
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    try {
        db.delete(`auto_sorting_packages_monitor`, { trackingNo: barcode })
        return httpSuccess(res, {});
    } catch (e: any) {
        const errorMessage = `deletePackage error ${e.message}`;
        logger.error(errorMessage, LogNameEnum.ROBOT);
        return httpError(res, e.message);
    }
};

const collectPackageByWms = async (params: any) => {
    const environment = cache.getCache('autoSortingEnvironment') || {};
    const obj = _.cloneDeep(params);
    const paramsArr1 = [global.platform.name];
    const sql1 = `SELECT waveNo FROM auto_sorting_wave WHERE status == 'Running' and platform=?`;
    const waveNos = await db.queryBySQL(sql1, paramsArr1);
    obj.waveNo = waveNos[0].waveNo;
    const sql2 = `select trackingNo as barcode, COUNT(*) as qty from auto_sorting_packages_monitor where platform=? and chuteNo=? and status='${PackageMonitorStatusEnum.SORTED}' GROUP BY trackingNo`;
    const paramsArr2 = [global.platform.name, obj.chuteNo];
    const localDetails = await db.queryBySQL(sql2, paramsArr2);
    if (!compareQty(params.details, localDetails)) {
        obj.localDetails = localDetails;
        // obj.status = 'Exception';
    }
    obj.platform = global.platform.name;
    const terminals = await db.queryBySQL(`SELECT j.terminal
FROM auto_sorting_package p
JOIN auto_sorting_package_detail pd ON p.id = pd.packageId
JOIN auto_sorting_chute_detail cd ON pd.chuteDetailId = cd.id
JOIN auto_sorting_job j ON cd.jobId = j.id
WHERE p.packageNo = ? and p.platform = ?`, [obj.packageNo, global.platform.name]);
    if (!_.isEmpty(terminals)) {
        obj.terminal = terminals[0].terminal;
    }
    const packageInfo = await db.getOne(TABLE.PACKAGE, { packageNo: obj.packageNo });
    if (!_.isEmpty(packageInfo)) {
        obj.routeName = packageInfo.chuteKey;
    }
    try {
        await db.insert(TABLE.QUEUE, {
            url: obj.chuteNo,
            data: JSON.stringify(obj),
            platform: platform.name,
            type: QueueTypeEnum.COLLET_PACKAGE,
            createdWhen: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        });
    } catch (error: any) {
        const errorMessage = `Collect Package By Wms error ${error.message}`;
        logger.error(errorMessage);
        console.log('Collect Package By Wms fail.')
    }
}

function compareQty(arr1: any[], arr2: any[]): boolean {
    const array1 = _.sortBy(_.map(arr1, 'barcode'));
    const array2 = _.sortBy(_.map(arr2, 'barcode'));

    if (_.size(array1) !== _.size(array2)) {
        return false;
    }

    return _.isEqual(array1, array2);
}

function createMap(arr: any[]): Record<string, number> {
    return arr.reduce((acc: Record<string, number>, cur: any) => {
        acc[cur.barcode] = (acc[cur.barcode] || 0) + cur.qty;
        return acc;
    }, {});
}

export const autoSortingHttp = async (req: any, res: any, params: any) => {
    const urls = req.url.toUpperCase().split('/');
    if (urls[1] != 'auto-sorting'.toUpperCase()) {
        return false;
    }
    if (req.method == 'POST' && urls[2] == 'getDestination'.toUpperCase()) {
        return await getDestination(res, params);
    }
    if (req.method == 'POST' && urls[2] == 'debugChuteList'.toUpperCase()) {
        return await debugChuteList(res, params);
    }
    if (req.method == 'POST' && urls[2] == 'fallingParts'.toUpperCase()) {
        return await fallingParts(res, params);
    }
    if (req.method == 'POST' && urls[2] == 'fullPackageInformation'.toUpperCase()) {
        return await fullPackageInformation(res, params);
    }
    if (req.method == 'POST' && urls[2] == 'deletePackage'.toUpperCase()) {
        return await deletePackage(res, params);
    }
    if (req.method == 'POST' && urls[2] == 'releaseChute'.toUpperCase()) {
        return await releaseChute(params, false);
    }
    if (req.method == 'POST' && urls[2] == 'labelPrint'.toUpperCase()) {
        return await labelPrint(res, params);
    }
    if (req.method == 'POST' && urls[2] == 'getPackageInfo'.toUpperCase()) {
        return await getPackageInfo(res, params);
    }
    if (req.method == 'POST' && urls[2] == 'packageBonded'.toUpperCase()) {
        return await packageBonded(res, params);
    }
    if (req.method == 'POST' && urls[2] == 'reLabelPrint'.toUpperCase()) {
        return await reLabelPrint(res, params);
    }
    if (req.method == 'POST' && urls[2] == 'searchPackageInfo'.toUpperCase()) {
        return await searchPackageInfo(res, params);
    }
    if (req.method == 'POST' && urls[2] == 'saveWave'.toUpperCase()) {
        return await postSaveWave(res, params);
    }
    if (req.method == 'OPTIONS') {
        return httpResponse(200, res, {});
    }
    console.log('autoSorting 404');
    return httpResponse(400, res, { message: 'No path' });
};

export const packagesMonitorSearch = async (params: any) => {
    await tryGetPlatformIfNeed();
    const offset = params.page ? (params.page - 1) * params.pageSize : 0;
    const limit = params.pageSize || 20;
    let sql = `SELECT * FROM ${TABLE.packages_monitor} where platform=? `;
    let sqlCount = `SELECT  COUNT(*) as totalCount FROM ${TABLE.packages_monitor}  where platform=? `;
    const paramsArr = [global.platform.name];
    const paramsArrCount = [global.platform.name];
    if (params) {
        if (params.trackingNo) {
            sql += ` and trackingNo like ?`;
            sqlCount += ` and trackingNo like ?`;
            paramsArr.push(`%${params.trackingNo}%`);
            paramsArrCount.push(`%${params.trackingNo}%`);
        }
        if (params.status) {
            sql += ` and status = ?`;
            sqlCount += ` and status = ?`;
            paramsArr.push(`${params.status}`);
            paramsArrCount.push(`${params.status}`);
        }
        if (!_.isEmpty(params.statuses)) {
            sql += ` and status in ("${_.join(params.statuses, '","')}")`;
            sqlCount += ` and status in ("${_.join(params.statuses, '","')}")`;
        }
        if (params.terminal) {
            sql += ` and terminal = ?`;
            sqlCount += ` and terminal = ?`;
            paramsArr.push(`${params.terminal}`);
            paramsArrCount.push(`${params.terminal}`);
        }
        if (params.routeNo) {
            sql += ` and routeNo like ?`;
            sqlCount += ` and routeNo like ?`;
            paramsArr.push(`%${params.routeNo}%`);
            paramsArrCount.push(`%${params.routeNo}%`);
        }
        if (params.labelCode) {
            sql += ` and label_Code like ?`;
            sqlCount += ` and label_Code like ?`;
            paramsArr.push(`%${params.labelCode}%`);
            paramsArrCount.push(`%${params.labelCode}%`);
        }
        if (params.chuteNo) {
            sql += ` and chuteNo like ?`;
            sqlCount += ` and chuteNo like ?`;
            paramsArr.push(`%${params.chuteNo}%`);
            paramsArrCount.push(`%${params.chuteNo}%`);
        }
        if (params.isOnlyToday) {
            const createTime = dayjs().format('YYYY-MM-DD 00:00:00');
            sql += ` and (createTime > ? or updateTime > ?)`;
            sqlCount += ` and (createTime > ? or updateTime > ?)`;
            paramsArr.push(createTime);
            paramsArrCount.push(createTime);
            paramsArr.push(createTime);
            paramsArrCount.push(createTime);
        }
    }
    sql += `LIMIT ? OFFSET ?`
    paramsArr.push(limit, offset);
    const list = await db.queryBySQL(sql, paramsArr);
    const totalCount = await db.queryBySQL(sqlCount, paramsArrCount);
    return { data: list, total: totalCount[0] ? totalCount[0].totalCount : 0 };
};

export const getSortingSetupConfig = async () => {
    const config = {
        waveDataFetchTime: '10:00',
        packageInfoRetentionPeriod: 2,
        maximumCarryingCapacity: 33,
        checkChuteTimerInterval: 1,
        maxIntervalSinceLastDrop: 30,
        getPkgsTimerInterval: 1,
        timelyCheckChute: true,
        dynamicSettingChute: false,
        dataScope: 180,
        settingFrequency: 1,
        packageType: ['Poly Bag'],
        settingFrequencyStartDate: dayjs().format('YYYY-MM-DD'),
    };
    const sortingSetupConfig = await getConfig(CONFIG_KEY.sortingSetup, JSON.stringify(config));
    return JSON.parse(sortingSetupConfig);
}

export const saveChuteAllocation = async (chuteAllocation: any) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    chuteAllocation.platform = global.platform.name;
    if (chuteAllocation.id) {
        console.log('updateChuteAllocation', chuteAllocation);
        chuteAllocation.updatedWhen = dayjs().format('YYYY-MM-DD HH:mm:ss');
        return await db.update(TABLE.CHUTE_ALLOCATION, chuteAllocation, { id: chuteAllocation.id });
    } else {
        console.log('addChuteAllocation', chuteAllocation);
        chuteAllocation.createdWhen = dayjs().format('YYYY-MM-DD HH:mm:ss');
        return await db.insert(TABLE.CHUTE_ALLOCATION, chuteAllocation);
    }
};

export const validateRouteNameExist = async (routeName: string, id?: number) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    let sql = `select * from ${TABLE.CHUTE_ALLOCATION} where platform=?`;
    const paramsArr = [global.platform.name];
    if (routeName) {
        sql += ` and UPPER(routeName) = ?`;
        paramsArr.push(_.toUpper(routeName));
    }
    if (id) {
        sql += ` and id <> ?`;
        paramsArr.push(id);
    }
    return await db.queryBySQL(sql, paramsArr);
};

export const getRouteNamesExist = async (routeNames: string[]) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    let sql = `select * from ${TABLE.CHUTE_ALLOCATION} where platform=?`;
    const paramsArr = [global.platform.name];
    if (!_.isEmpty(routeNames)) {
        const upperRouteNames = _.join(_.map(routeNames, (o: string) => _.toUpper(o)), '","');
        sql += ` and UPPER(routeName) in ("${upperRouteNames}")`;
    }
    const chuteAllocationList = await db.queryBySQL(sql, paramsArr);
    console.log('getRouteNamesExist', chuteAllocationList);
    return _.map(chuteAllocationList, 'routeName');
};

export const searchChuteAllocationList = async (params: any) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    let sql = `select * from ${TABLE.CHUTE_ALLOCATION} where platform=?`;
    const paramsArr = [global.platform.name];
    if (params) {
        if (params.routeName) {
            sql += ` and routeName like ?`;
            paramsArr.push(`%${params.routeName}%`);
        }
        if (params.type) {
            sql += ` and type=?`;
            paramsArr.push(params.type);
        }
        if (!_.isNil(params.isChuteNeeded)) {
            sql += ` and isChuteNeeded=?`;
            paramsArr.push(params.isChuteNeeded);
        }
        if (params.chuteNo) {
            sql += ` and fixedChuteNos like ?`;
            paramsArr.push(`%${params.chuteNo}%`);
        }
        if (!_.isEmpty(params.routeNameIn)) {
            sql += ` and routeName in ("${_.join(params.routeNameIn, '","')}")`;
        }
    }
    const chuteAllocationList = await db.queryBySQL(sql, paramsArr);
    console.log('getChuteAllocationList', chuteAllocationList);
    return chuteAllocationList;
};

export const searchChuteAllocationByPaging = async (params: any) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    let sql = `select * from ${TABLE.CHUTE_ALLOCATION} where platform=?`;
    let sqlCount = `select COUNT(*) as totalCount from ${TABLE.CHUTE_ALLOCATION} where platform=?`;
    const paramsArr = [global.platform.name];
    if (params) {
        if (params.routeName) {
            sql += ` and routeName like ?`;
            sqlCount += ` and routeName like ?`;
            paramsArr.push(`%${params.routeName}%`);
        }
        if (params.type) {
            sql += ` and type=?`;
            sqlCount += ` and type=?`;
            paramsArr.push(params.type);
        }
        if (!_.isNil(params.isChuteNeeded)) {
            sql += ` and isChuteNeeded=?`;
            sqlCount += ` and isChuteNeeded=?`;
            paramsArr.push(params.isChuteNeeded);
        }
        if (params.chuteNo) {
            sql += ` and fixedChuteNos like ?`;
            sqlCount += ` and fixedChuteNos like ?`;
            paramsArr.push(`%${params.chuteNo}%`);
        }
    }
    const totals = await db.queryBySQL(sqlCount, paramsArr);
    const res = {
        data: [],
        paging: {
            totalCount: totals ? totals[0].totalCount : 0,
            pageNo: 1,
            totalPage: 0,
            limit: 20,
        },
    };
    if (res.paging.totalCount === 0) return res;
    if (params.paging) {
        res.paging.limit = params.paging && params.paging.limit ? params.paging.limit : 20;
    }
    res.paging.totalPage = res.paging.totalCount > 0 ? Math.ceil(res.paging.totalCount / res.paging.limit) : 0;
    res.paging.pageNo = params.paging && params.paging.pageNo ? Math.min(params.paging.pageNo, res.paging.totalPage) : 1;
    sql += ` order by id asc LIMIT ? OFFSET ?`;
    paramsArr.push(res.paging.limit, (res.paging.pageNo - 1) * res.paging.limit);
    res.data = await db.queryBySQL(sql, paramsArr);
    console.log('searchChuteAllocationByPaging', res);
    return res;
};

export const getChuteAllocationByRoutName = async (routName: string, chuteAllocationType: string) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    if (_.isEmpty(routName)) throw new Error('routName is required');
    const chuteAllocationList = await db.queryBySQL(`select * from ${TABLE.CHUTE_ALLOCATION} where platform=? and routeName=? and type=?`, [global.platform.name, routName, chuteAllocationType]);
    console.log('getChuteAllocationList', chuteAllocationList);
    if (_.isEmpty(chuteAllocationList)) return {};
    const chuteAllocation = _.head(chuteAllocationList);
    chuteAllocation.fixedChuteNos = _.isEmpty(chuteAllocation.fixedChuteNos) ? [] : JSON.parse(chuteAllocation.fixedChuteNos);
    return chuteAllocation;
};

export const getChuteAllocationsByType = async (chuteAllocationType: string) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    if (_.isEmpty(chuteAllocationType)) throw new Error('chuteAllocationType is required');
    const chuteAllocationList = await db.queryBySQL(`select * from ${TABLE.CHUTE_ALLOCATION} where platform=? and type=?`, [global.platform.name, chuteAllocationType]);
    console.log('getChuteAllocationsByType', chuteAllocationList);
    if (_.isEmpty(chuteAllocationList)) return [];
    for (const chuteAllocation of chuteAllocationList) {
        chuteAllocation.fixedChuteNos = _.isEmpty(chuteAllocation.fixedChuteNos) ? [] : JSON.parse(chuteAllocation.fixedChuteNos);
    }
    return chuteAllocationList;
};

export const deleteChuteAllocation = async (id: any) => {
    await tryInitDBIfNeed();
    await db.delete(TABLE.CHUTE_ALLOCATION, { id: id });
};

export const packingTimeoutAlert = async () => {
    const config = await getSortingSetupConfig();
    const sql = `SELECT d.*
FROM auto_sorting_chute_detail d
JOIN auto_sorting_chute_binding b ON d.chuteId = b.chuteId
JOIN (
    SELECT chuteId, MAX(updatedAt) AS latestUpdatedAt
    FROM auto_sorting_chute_detail WHERE platform =?
    GROUP BY chuteId
) latest ON d.chuteId = latest.chuteId AND d.updatedAt = latest.latestUpdatedAt
WHERE d.status = 'Done'
  AND b.workStatus = 'Assigned'
	AND d.platform =?
  AND d.updatedAt <?
  AND NOT EXISTS (
    SELECT 1
    FROM auto_sorting_chute_detail d2
    WHERE d2.chuteNo = d.chuteNo
      AND d2.updatedAt > d.updatedAt
      AND d2.status = 'In transit'
			AND d2.platform =?
  );`;
    const maxIntervalSinceLastDropTime = dayjs().subtract(config.maxIntervalSinceLastDrop, 'minute').unix();
    const paramsArr = [global.platform.name, global.platform.name, maxIntervalSinceLastDropTime,  global.platform.name];
    const details = await db.queryBySQL(sql, paramsArr);
    console.log('packingTimeoutAlert', details);
    if (!_.isEmpty(details)) {
        if (global.platform.binCloseUrl) {
            console.log('packingTimeoutAlert关闭格口', _.map(details, 'chuteNo'));
            console.log('packingTimeoutAlert关闭格口调用的关闭接口为', global.platform.binCloseUrl);
            _.forEach(details, async (item: any) => {
                await db.update(TABLE.CHUTE_BINDING, { workStatus: ChuteWorkStatusEnum.COLLECT_PACKAGE }, { chuteId: item.chuteId });
                dealCallbackMessage({ url: global.platform.binCloseUrl, data: { chuteNo: item.chuteNo } }, LogTypeEnum.BIN_CLOSE_CALLBACK);
            });
        }
    }
};

export const clearLocalServerDataAndSaveWhenClosingWave = async () => {
    const platform = await getPlatform();
    if (_.isEmpty(platform)) {
        return false;
    }
    const zeroCurrentTime = dayjs().startOf('day').unix();
    const config = await getSortingSetupConfig();
    await db.delete(TABLE.CHUTE_DETAIL_HISTORY, { createdAt_LT: zeroCurrentTime });
    const completedJobs = await db.query(TABLE.JOB, {
        status: JobStatusEnum.COMPLETED,
        createdAt_LT: zeroCurrentTime,
    });
    const jobIds = _.compact(_.map(completedJobs, 'id'));
    // 删除当天0点之前已完成的数据
    if (!_.isEmpty(jobIds)) {
        const jobIdGroup = _.chunk(jobIds, 100);
        for (const ids of jobIdGroup) {
            await db.delete(TABLE.JOB, { id_IN: ids });
            await db.delete(TABLE.JOB_ITEM, { jobId_IN: ids });
        }
    }
    const deletePackageIds = await db.query(TABLE.PACKAGE, {
        createdAt_LT: zeroCurrentTime
    });
    await db.delete(TABLE.PACKAGE, { createdAt_LT: zeroCurrentTime });
    await db.delete(TABLE.PACKAGE_DETAIL, { packageId_IN: deletePackageIds });
    const searchSql = `SELECT * FROM ${TABLE.packages_monitor}
WHERE status = '${PackageMonitorStatusEnum.BONDED}'
AND chuteNo IN ( SELECT chuteNo FROM ${TABLE.CHUTE} WHERE chuteType = '${ChuteTypeEnum.ROUTE}' )
AND createTime < '${dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss')}'`;
    const delPackages = await db.queryBySQL(searchSql);
    console.log('delPackages', delPackages);
    const delPackageIds = _.compact(_.map(delPackages, 'id'));
    const delTrackingNos = _.map(delPackages, 'trackingNo');
    if (!_.isEmpty(delPackageIds)) {
        const delPackageIdGroup = _.chunk(delPackageIds, 100);
        for (const ids of delPackageIdGroup) {
            await db.delete(TABLE.packages_monitor, { id_IN: ids });
        }
    }
    if (!_.isEmpty(delTrackingNos)) {
        const delTrackingNoGroup = _.chunk(delTrackingNos, 100);
        for (const trackingNos of delTrackingNoGroup) {
            await db.delete(TABLE.JOB_ITEM, { barcode_IN: trackingNos });
        }
    }
    // 删除超过最大保留天数的所有数据
    await db.delete(TABLE.LOG, {
        createdAt_LT: dayjs().subtract(config.packageInfoRetentionPeriod, 'day').startOf('day').unix()
    });
    const jobItems = await db.query(TABLE.JOB_ITEM, {
        createdAt_LT: dayjs().subtract(config.packageInfoRetentionPeriod, 'day').startOf('day').unix()
    });
    const packages = await db.query(TABLE.packages_monitor, {
        createTime_LT: dayjs().subtract(config.packageInfoRetentionPeriod, 'day').startOf('day').format('YYYY-MM-DD 00:00:00')
    });
    const trackingNos = _.map(packages, 'trackingNo');
    const jobItemIds = _.compact(_.map(jobItems, 'id'));
    const packageIds = _.compact(_.map(packages, 'id'));
    // 删除之前先备份到异常包裹表// 没做完
    try {
        if (!_.isEmpty(packages)) {
            const environment = cache.getCache('autoSortingEnvironment') || {};
            const strList = _.split(platform.name, '_');
            const headers: any = wiseHeaders;
            if (_.size(strList) == 3) {
                headers['WISE-Company-Id'] = strList[1];
            }
            const res = await axios.post(
                environment.requestUrl + '/shared/fd-app/lso/package-monitor/history/batch-create',
                packages,
                { headers: headers }
            );
        }
    } catch (error: any) {
        const errorMessage = `保存到异常表 By Wms error ${error.message}`;
        logger.error(errorMessage);
        console.log('保存到异常表 By Wms fail.');
    }
    if (!_.isEmpty(jobItemIds)) {
        const jobItemIdGroup = _.chunk(jobItemIds, 100);
        for (const ids of jobItemIdGroup) {
            await db.delete(TABLE.JOB_ITEM, { jobId_IN: ids });
        }
    }
    if (!_.isEmpty(trackingNos)) {
        const trackingNoGroup = _.chunk(trackingNos, 100);
        for (const tns of trackingNoGroup) {
            await db.delete(TABLE.JOB_ITEM, { barcode_IN: tns });
        }
    }
    if (!_.isEmpty(packageIds)) {
        const packageIdGroup = _.chunk(packageIds, 100);
        for (const ids of packageIdGroup) {
            await db.delete(TABLE.packages_monitor, { id_IN: ids });
        }
    }
    const allJobItems = await db.query(TABLE.JOB_ITEM);
    const activeJobIds = _.uniq(_.compact(_.map(allJobItems, 'jobId')));
    const allJobs = await db.query(TABLE.JOB);
    const allJobIds = _.uniq(_.compact(_.map(allJobs, 'id')));
    const inactiveJobIds = _.difference(allJobIds, activeJobIds);
    if (!_.isEmpty(inactiveJobIds)) {
        const inactiveJobIdGroup = _.chunk(inactiveJobIds, 100);
        for (const ids of inactiveJobIdGroup) {
            await db.delete(TABLE.JOB, { id_IN: ids });
        }
    }
    // WAVE-YYYYMMDD-001  更新表中的waveNo和 waveId
    const waveNo = `WAVE-${dayjs().format('YYYYMMDD')}-001`;
    let wave = await getWaveByWaveNo(waveNo);
    let waveId = '';
    if (!wave) {
        wave = {
            platform: global.platform.name,
            waveNo: waveNo,
            status: WaveStatusEnum.RUNNING,
        };
        waveId = await db.insert(TABLE.WAVE, wave);
        //更新以前数据的waveNo waveId;
        db.update(TABLE.CHUTE_DETAIL, { waveNo: waveNo, waveId: waveId });
        db.update(TABLE.JOB, { waveNo: waveNo, waveId: waveId });
        db.update(TABLE.JOB_ITEM, { waveNo: waveNo, waveId: waveId });
        db.update(TABLE.PACKAGE, { waveNo: waveNo });
        db.update(TABLE.packages_monitor, { waveNo: waveNo });
        db.update(TABLE.JOB, { sortedQty: 0 });
    } else {
        waveId = wave.id;
        db.update(TABLE.CHUTE_DETAIL, { waveNo: waveNo, waveId: waveId });
        db.update(TABLE.JOB, { waveNo: waveNo, waveId: waveId });
        db.update(TABLE.JOB_ITEM, { waveNo: waveNo, waveId: waveId });
        db.update(TABLE.PACKAGE, { waveNo: waveNo });
        db.update(TABLE.packages_monitor, { waveNo: waveNo });
    }
    await db.update(TABLE.WAVE, { status: WaveStatusEnum.RUNNING }, { id: waveId });
    await db.update(TABLE.WAVE, { status: WaveStatusEnum.STOP }, { id_NIN: waveId });
    await jobRemovalDuplication();

    // 拉取增量数据
    // await pullWave();
    const isSuccess = await ipcRenderer.invoke('pullWave');

    const incrementalFoundSql = `UPDATE ${TABLE.packages_monitor}
SET status = '${PackageMonitorStatusEnum.INCREMENTAL_FOUND}'
WHERE status = '${PackageMonitorStatusEnum.NOT_FOUND}'
AND platform = '${global.platform.name}'
AND trackingNo IN ( SELECT barcode FROM ${TABLE.JOB_ITEM} WHERE assignedQty<qty )`;
    await db.run(incrementalFoundSql).catch((err: any) => {
        console.error(err);
    });

    //迭代包裹数据池
    await buildPackageDataPool();
    //根据包裹数据池分析Route是否是必须分配的
    await rebuildChuteAllocationRoute(config);
    return isSuccess;
};

export const rebuildChuteAllocationRoute = async (config: any) => {
    if (config.dynamicSettingChute) {
        console.log('dynamicSettingChute start...');
        const date1 = dayjs(config.settingFrequencyStartDate || dayjs().format('YYYY-MM-DD'));
        const date2 = dayjs();
        const differenceInDays = date2.diff(date1, 'day');
        const settingFrequency = config.settingFrequency || 1;
        const isAction = differenceInDays % settingFrequency === 0;
        if (isAction) {
            if (typeof config.packageType === 'string') {
                config.packageType = [config.packageType];
            }
            const fileGroups: any[] = [];
            for (const packageType of config.packageType) {
                const path = `${userHome}/packageDataPool/${platform.name}/${packageType}`;
                try {
                    const files = await fs.promises.readdir(path);
                    const sortedFiles = _.slice(
                        _.reverse(_.sortBy(files, (o: string) => o)),
                        0,
                        config.dataScope
                    );
                    const activeFiles = _.filter(sortedFiles, (o: string) => {
                        const date1 = dayjs(_.replace(o, '.xlsx', ''));
                        const date2 = dayjs();
                        const diffInDays = date2.diff(date1, 'day');
                        return diffInDays % 7 === 0;
                    });
                    fileGroups.push({path: path, files: activeFiles});
                } catch (error) {
                    console.error('Error reading folder:', error);
                }
            }
            let fileData: any[] = [];
            for (const fileGroup of fileGroups) {
                for (const file of fileGroup.files) {
                    const workbook = XLSX.readFile(`${fileGroup.path}/${file}`);
                    const worksheet = workbook.Sheets['Sheet1'];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    fileData = _.concat(fileData, jsonData);
                }
            }
            const fileDataGroupValues = _.values(_.groupBy(fileData, 'Route'));
            const routeAverageValues: any[] = _.map(fileDataGroupValues, (fileData: any[]) => {
                const totalCount = _.sumBy(fileData, (data: any) => _.toNumber(data.Count));
                return { Route: fileData[0].Route, Count: totalCount / _.size(fileData) };
            });
            const routeSortedByCount = _.reverse(
                _.sortBy(routeAverageValues, (route: any) => route.Count)
            );
            const chutes = await getChuteListByChuteNoLike({
                chuteType: ChuteTypeEnum.ROUTE,
                isEnabled: 1,
            });
            const endIndex = _.floor(_.size(chutes) * 0.85);
            const dealWithData = _.slice(routeSortedByCount, 0, endIndex);
            await db.delete(TABLE.CHUTE_ALLOCATION, { type: ChuteAllocationTypeEnum.ROUTE });
            for (const data of dealWithData) {
                await saveChuteAllocation({
                    routeName: data.Route,
                    type: ChuteAllocationTypeEnum.ROUTE,
                    isChuteNeeded: 1,
                });
            }
            console.log('dynamicSettingChute end...');
        }
    }
};

export const jobRemovalDuplication = async () => {
    const curJobs = await db.queryBySQL(`select a.*,b.platform from ${TABLE.JOB} a left join ${TABLE.WAVE} b on a.waveId=b.id where b.platform=?`, [global.platform.name]);
    const groups = _.values(_.groupBy(curJobs, (job: any) => job.terminal + '_' + job.chuteKey));
    for (const group of groups) {
        if (_.size(group) > 1) {
            const ids = _.map(group, 'id');
            const maxJobId = _.max(ids);
            const orJobIds = _.without(ids, maxJobId);
            const jobQty = _.sumBy(group, 'jobQty');
            const sortedQty = _.sumBy(group, 'sortedQty');
            await db.update(TABLE.JOB_ITEM, { jobId: maxJobId }, { jobId_IN: orJobIds });
            await db.update(TABLE.CHUTE_BINDING, { jobId: maxJobId }, { jobId_IN: orJobIds });
            await db.update(TABLE.CHUTE_DETAIL, { jobId: maxJobId }, { jobId_IN: orJobIds });
            await db.delete(TABLE.JOB, { id_IN: orJobIds });
            await db.update(TABLE.JOB, { jobQty: jobQty, sortedQty: sortedQty }, { id: maxJobId });
        }
    }
    console.log('jobRemovalDuplication success');
};

export const getPackagesMonitor = async (search: any) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    let sql = `select a.*,b.chuteType from ${TABLE.packages_monitor} a
               left join ${TABLE.CHUTE} b on a.chuteNo=b.chuteNo
               where a.platform=?`;
    const params = [global.platform.name];
    if (search.trackingNo) {
        sql += ` and a.trackingNo=?`;
        params.push(search.trackingNo);
    }
    if (search.status) {
        sql += ` and a.status=?`;
        params.push(search.status);
    }
    if (!_.isEmpty(search.statuses)) {
        sql += ` and a.status in ("${_.join(search.statuses, '","')}")`;
    }
    if (!_.isEmpty(search.excludeStatuses)) {
        sql += ` and a.status not in ("${_.join(search.excludeStatuses, '","')}")`;
    }
    if (search.terminal) {
        sql += ` and a.terminal=?`;
        params.push(search.terminal);
    }
    if (search.waveNo) {
        sql += ` and a.waveNo=?`;
        params.push(search.waveNo);
    }
    if (search.routeNo) {
        sql += ` and a.routeNo=?`;
        params.push(search.routeNo);
    }
    if (search.chuteNo) {
        sql += ` and a.chuteNo=?`;
        params.push(search.chuteNo);
    }
    if (search.chuteType) {
        sql += ` and b.chuteType=?`;
        params.push(search.chuteType);
    }
    const packagesMonitorList = await db.queryBySQL(sql, params);
    console.log('getPackagesMonitor', packagesMonitorList);
    return packagesMonitorList;
};

const pullWave = async () => {
    try {
        await tryInitDBIfNeed();
        await tryGetPlatformIfNeed();
        const environment = cache.getCache('autoSortingEnvironment') || {};
        const platform = global.platform || await getPlatform();
        console.log('platform', platform);
        const waves = await db.queryBySQL(
            `SELECT * FROM ${TABLE.WAVE} WHERE status = ? AND platform = ?`,
            [ WaveStatusEnum.RUNNING, platform.name ]
        );
        let currentTime;
        if (!_.isEmpty(waves)) {
            const list = _.split(waves[0].waveNo, '-');
            currentTime = _.size(list) > 1 ? list[1] : dayjs().format('YYYYMMDD');
        } else {
            currentTime = dayjs().format('YYYYMMDD');
        }
        const obj = {
            platform: platform.name,
            currentTime: currentTime,
        };
        const strList = _.split(platform.name, '_');
        const headers: any = wiseHeaders;
        if (_.size(strList) == 3) {
            headers['WISE-Company-Id'] = strList[1];
        }
        const res: any = await axios.post(environment.requestUrl + '/shared/bam/lso/package-assemble/pull-wave', obj || {}, { headers });
        try {
            logger.infoLog(`pullWave: ${JSON.stringify(res.data)}`, LogNameEnum.SOCKET);
        } catch (e: any) {
            logger.error(`pullWave info log error ${e.message}`, LogNameEnum.SOCKET);
        }
        await saveWave(res.data);
        if (!_.isEmpty(res.data.deleteIds)) {
            await axios.post(environment.requestUrl + '/shared/fd-app/lso/package-assemble/batch-delete', res.data.deleteIds, { headers });
        }
        return true;
    } catch (error: any) {
        const errorMessage = `拉取增量表 By Wms error ${error.message}`;
        logger.error(errorMessage);
        console.log('拉取增量表 By Wms fail.');
        return false;
    }
};

const aScanByWMS = async (barcode: string) => {
    const environment = cache.getCache('autoSortingEnvironment') || {};
    const platform = global.platform || await getPlatform();
    const strList = _.split(platform.name, '_');
    const headers: any = wiseHeaders;
    if (_.size(strList) == 3) {
        headers['WISE-Company-Id'] = strList[1];
        headers['WISE-Facility-Id'] = `${strList[1]}_${strList[2]}`;
    } else if (_.size(strList) == 2) {
        headers['WISE-Facility-Id'] = strList[1];
    }
    const url = `${environment.requestUrl}/shared/bam/transload/receive-carton/trackingNo/${barcode}`;
    const config = { headers: headers };
    if (global.socketConnected && !global.aScanQueue) {
        try {
            global.aScanQueue = true;
            const ascanRes = await axios.post(url, {}, config);
            if (ascanRes.data.code !== 200) {
                await db.insert(TABLE.LOG, {
                    platform: global.platform.name,
                    logType: LogTypeEnum.WISE_REQUEST,
                    logName: LogNameEnum.EXCEPTION,
                    message: ascanRes.data.message,
                    isException: 1,
                    data: JSON.stringify({
                        url: url,
                        body: {},
                        config: config,
                        method: 'post',
                    }),
                });
            } else await savePickupPackage(barcode);
        } catch (e: any) {
            await db.insert(TABLE.LOG, {
                platform: global.platform.name,
                logType: LogTypeEnum.WISE_REQUEST,
                logName: LogNameEnum.EXCEPTION,
                message: e.message,
                isException: 1,
                data: JSON.stringify({
                    url: url,
                    body: {},
                    config: config,
                    method: 'post',
                }),
            });
        }
        global.aScanQueue = false;
    } else {
        await db.insert(TABLE.QUEUE, {
            url,
            data: JSON.stringify({}),
            config: JSON.stringify(config),
            platform: platform.name,
            type: QueueTypeEnum.A_SCAN,
            createdWhen: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        });
    }
};

export const getDropOffCountByRouteNo = async () => {
    const sql = `select routeNo , COUNT(*) as qty from auto_sorting_packages_monitor where status in ('${PackageMonitorStatusEnum.SORTED}','${PackageMonitorStatusEnum.BONDED}') GROUP BY routeNo`;
    return await db.queryBySQL(sql);
};

export const getDropOffCountByRouteNoV3 = async () => {
    const sql = `select a.*,b.waveNo from ${TABLE.JOB} a
            left join ${TABLE.WAVE} b on a.waveId=b.id
            where b.platform=?`;
    const paramsArr = [global.platform.name];
    const itemList = await db.queryBySQL(sql, paramsArr);
    const groups = _.values(_.groupBy(itemList, 'waveNo'));
    const waveQtyMap: any = {};
    const waveAssignedQtyMap: any = {};
    for (const waves of groups) {
        const groups2 = _.values(_.groupBy(waves, 'chuteKey'));
        const routeQtyMap: any = {};
        let totalAssignedQty = 0;
        for (const jobs of groups2) {
            const qty = _.sumBy(jobs, 'jobQty') || 0;
            const assignedQty = _.sumBy(jobs, 'sortedQty') || 0;
            routeQtyMap[jobs[0].chuteKey] = {
                qty,
                assignedQty,
            };
            totalAssignedQty += assignedQty;
        }
        waveQtyMap[waves[0].waveNo] = routeQtyMap;
        waveAssignedQtyMap[waves[0].waveNo] = totalAssignedQty;
    }
    return { waveQtyMap, waveAssignedQtyMap };
};

export const s2ab = (s: string) => {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) {
        view[i] = s.charCodeAt(i) & 0xff;
    }
    return buf;
};

export const aScanQueue = async () => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    if (global.aScanQueue) return;
    global.aScanQueue = true;
    const queues = await db.queryBySQL(`select * from ${TABLE.QUEUE} where platform=? and type=?`, [global.platform.name, QueueTypeEnum.A_SCAN]);
    for (const queue of queues) {
        if (global.socketConnected) {
            const data = JSON.parse(queue.data);
            const config = JSON.parse(queue.config);
            try{
                const ascanRes = await axios.post(queue.url, data, config);
                if (ascanRes.data.code !== 200) {
                    await db.insert(TABLE.LOG, {
                        platform: global.platform.name,
                        logType: LogTypeEnum.WISE_REQUEST,
                        logName: LogNameEnum.EXCEPTION,
                        message: ascanRes.data.message,
                        isException: 1,
                        data: JSON.stringify({
                            url: queue.url,
                            body: data,
                            config: config,
                            method: 'post',
                        }),
                    });
                } else {
                    const data = _.split(queue.url, '/');
                    await savePickupPackage(data[_.size(data) - 1]);
                }
            } catch (e: any) {
                await db.insert(TABLE.LOG, {
                    platform: global.platform.name,
                    logType: LogTypeEnum.WISE_REQUEST,
                    logName: LogNameEnum.EXCEPTION,
                    message: e.message,
                    isException: 1,
                    data: JSON.stringify({
                        url: queue.url,
                        body: data,
                        config: config,
                        method: 'post',
                    }),
                });
            }
            await db.delete(TABLE.QUEUE, { id: queue.id });
        } else {
            global.aScanQueue = false;
            return;
        }
    }
    global.aScanQueue = false;
};

export const labelPrint = async (res: any, params: any) => {
    if (_.isEmpty(params)) {
        return httpError(res, 'Request params cannot be empty');
    }
    if (_.isEmpty(params.chuteNo)) {
        return httpError(res, 'chuteNo is require');
    }
    try {
        await tryInitDBIfNeed();
        await tryGetPlatformIfNeed();
        const chuteInfo = await getCurrentChuteTerminalAndRoute(params.chuteNo);
        const str = await getCurrentFacilityName();
        const facilityName = str.substring(0, 3);
        const tag = `${facilityName}${dayjs().format('YYYYMMDD')}`;
        const barcodeTag = `>:${facilityName}>5${dayjs().format('YYYYMMDD')}`;
        const labels = await db.queryBySQL(`select * from ${TABLE.LABEL} where platform=? and tag=?`, [
            global.platform.name,
            tag,
        ]);
        let curId;
        if (_.isEmpty(labels)) {
            curId = 1;
            await db.insert(TABLE.LABEL, {
                tag,
                curId: curId,
                platform: global.platform.name,
                createdWhen: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            });
        } else {
            curId = labels[0].curId + 1;
            await db.update(
                TABLE.LABEL,
                {
                    curId: curId,
                    updatedWhen: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                },
                {
                    tag,
                }
            );
        }
        const labelCodeText = tag + _.padStart(curId.toString(), 6, '0');
        const labelCode = barcodeTag + _.padStart(curId.toString(), 6, '0');
        const template = await getCurrentTemplate();
        const handlebarsTemplate = handlebars.compile(template);
        const subRoutes = _.split(chuteInfo.route, '.');
        const data = {
            labelCode,
            labelCodeText,
            note: chuteInfo.route,
            route: _.isEmpty(subRoutes) ? '' : subRoutes[0],
            terminal: chuteInfo.terminal,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        };
        const result = { labelCode: labelCodeText, template: '' };
        result.template = _.replace(handlebarsTemplate(data), /\r\n/g, '');
        return httpSuccess(res, result);
    } catch (e: any) {
        return httpError(res, e.message);
    }
};

export const reLabelPrint = async (res: any, params: any) => {
    if (_.isEmpty(params)) {
        return httpError(res, 'Request params cannot be empty');
    }
    if (_.isEmpty(params.labelCode)) {
        return httpError(res, 'chuteNo is require');
    }
    if (_.isEmpty(params.terminal)) {
        return httpError(res, 'terminal is require');
    }
    try {
        await tryInitDBIfNeed();
        await tryGetPlatformIfNeed();
        const facilityName = params.labelCode.substring(0, 3);
        const endCode = params.labelCode.substring(3);
        const labelCode = `>:${facilityName}>5${endCode}`;
        const template = await getCurrentTemplate();
        const handlebarsTemplate = handlebars.compile(template);
        const subRoutes = _.split(params.route, '.');
        const data = {
            labelCode,
            labelCodeText: params.labelCode,
            note: params.route,
            route: _.isEmpty(subRoutes) ? '' : subRoutes[0],
            terminal: params.terminal,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        };
        const result = { labelCode: params.labelCode, template: '' };
        result.template = _.replace(handlebarsTemplate(data), /\r\n/g, '');
        return httpSuccess(res, result);
    } catch (e: any) {
        return httpError(res, e.message);
    }
};

export const getCurrentFacilityName = async () => {
    const environment = cache.getCache('autoSortingEnvironment') || {};
    const platform = global.platform || await getPlatform();
    let platforms;
    if (process.env.NODE_ENV === 'production' && process.env.VUE_APP_LSO) {
        platforms = AUTO_SORTING_PLATFORM_PROD;
    } else {
        platforms = AUTO_SORTING_PLATFORM;
    }
    const platformConfigMap = _.keyBy(platforms, 'name');
    const strList = _.split(platform.name, '_');
    const headers: any = wiseHeaders;
    let facilityId;
    let facilityName = platformConfigMap[platform.name].facilityName;
    if (_.size(strList) == 3) {
        headers['WISE-Company-Id'] = strList[1];
        facilityId = `${strList[1]}_${strList[2]}`;
    } else if (_.size(strList) == 2) {
        facilityId = strList[1];
    }
    const url = `${environment.requestUrl}/api/fd-app/facility/${facilityId}`;
    const config = { headers: headers };
    try {
        const facility = (await axios.get(url, config)) || {};
        facilityName = facility.data.name;
    } catch (e: any) {
        await db.insert(TABLE.LOG, {
            platform: global.platform.name,
            logType: LogTypeEnum.WISE_REQUEST,
            logName: LogNameEnum.EXCEPTION,
            message: e.message,
            isException: 1,
            data: JSON.stringify({
                url: url,
                body: null,
                config: config,
                method: 'get',
            }),
        });
    }
    return facilityName;
};

export const getCurrentTemplate = async () => {
    const environment = cache.getCache('autoSortingEnvironment') || {};
    const platform = global.platform || await getPlatform();
    const strList = _.split(platform.name, '_');
    const headers: any = wiseHeaders;
    if (_.size(strList) == 3) {
        headers['WISE-Company-Id'] = strList[1];
        headers['WISE-Facility-Id'] = `${strList[1]}_${strList[2]}`;
    } else if (_.size(strList) == 2) {
        headers['WISE-Facility-Id'] = strList[1];
    }
    const url = `${environment.requestUrl}/shared/print-app/template/get-content-by-name/LSO Transit Package Label`;
    const config = { headers: headers };
    let currentTemplate = await getConfig(CONFIG_KEY.LABEL_TEMPLATE);
    if (_.isEmpty(currentTemplate)) {
        await setConfig(CONFIG_KEY.LABEL_TEMPLATE, LSO_TRANSIT_PACKAGE_LABEL);
        currentTemplate = LSO_TRANSIT_PACKAGE_LABEL;
    }
    try {
        const template = (await axios.get(url, config)) || {};
        currentTemplate = template.data.content;
        await setConfig(CONFIG_KEY.LABEL_TEMPLATE, currentTemplate);
    } catch (e: any) {
        await db.insert(TABLE.LOG, {
            platform: global.platform.name,
            logType: LogTypeEnum.WISE_REQUEST,
            logName: LogNameEnum.EXCEPTION,
            message: e.message,
            isException: 1,
            data: JSON.stringify({
                url: url,
                body: null,
                config: config,
                method: 'get',
            }),
        });
    }
    return currentTemplate;
};

export const getCurrentChuteTerminalAndRoute = async (chuteNo: string) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    const queues = await db.queryBySQL(
        `select * from ${TABLE.QUEUE} where platform=? and type=? and url=?`,
        [global.platform.name, QueueTypeEnum.COLLET_PACKAGE, chuteNo]
    );
    if (_.isEmpty(queues)) {
        throw new Error('Package data does not exist');
    }
    const data = JSON.parse(queues[0].data);
    return {
        chuteNo,
        terminal: data.terminal,
        route: data.routeName,
    };
};

export const searchPackageInfo = async (res: any, params: any) => {
    if (_.isEmpty(params)) {
        return httpError(res, 'Request params cannot be empty');
    }
    if (_.isEmpty(params.code)) {
        return httpError(res, 'Code is require');
    }
    try {
        const environment = cache.getCache('autoSortingEnvironment') || {};
        const platform = global.platform || await getPlatform();
        const strList = _.split(platform.name, '_');
        const headers: any = wiseHeaders;
        if (_.size(strList) == 3) {
            headers['WISE-Company-Id'] = strList[1];
            headers['WISE-Facility-Id'] = `${strList[1]}_${strList[2]}`;
        } else if (_.size(strList) == 2) {
            headers['WISE-Facility-Id'] = strList[1];
        }
        const url = `${environment.requestUrl}/shared/fd-app/lso/collect-package/search-by-paging`;
        const config = { headers: headers };
        const postData = await axios.post(
            url,
            {
                detailsElemMatch: {
                    barcode: params.code,
                },
                paging: {
                    pageNo: 1,
                    limit: 1,
                },
                sortingFields: ['updatedWhen'],
                sortingOrder: -1,
            },
            config
        );
        let packages = postData.data.packages;
        let pkg: any;
        if (_.isEmpty(packages)) {
            const postData = await axios.post(
                url,
                {
                    labelCode: params.code,
                    paging: {
                        pageNo: 1,
                        limit: 1,
                    },
                },
                config
            );
            packages = postData.data.packages;
        }
        if (_.isEmpty(packages)) {
            await tryInitDBIfNeed();
            await tryGetPlatformIfNeed();
            let packages2 = await db.queryBySQL(
                `select * from ${TABLE.packages_monitor} where platform=? and label_Code=?`,
                [global.platform.name, params.code]
            );
            if (!_.isEmpty(packages2)) {
                pkg = {
                    labelCode: packages2[0].label_Code,
                    status: 'Bond',
                    packageAmt: _.size(packages2),
                    chuteNo: packages2[0].chuteNo,
                    terminal: packages2[0].terminal,
                    route: packages2[0].routeNo,
                    trackingNos: _.map(packages2, 'trackingNo'),
                    createTime: dayjs(packages2[0].updateTime).format('YYYY-MM-DD HH:mm:ss'),
                    bondTime: dayjs(packages2[0].updateTime).format('YYYY-MM-DD HH:mm:ss'),
                };
            } else {
                packages2 = await db.queryBySQL(
                    `SELECT a.*,d.workStatus FROM ${TABLE.packages_monitor} a
LEFT JOIN (SELECT * FROM ${TABLE.CHUTE} b LEFT JOIN ${TABLE.CHUTE_BINDING} c ON b.id=c.chuteId) d
ON a.chuteNo=d.chuteNo WHERE a.platform=? AND a.trackingNo=?`,
                    [global.platform.name, params.code]
                );
                if (!_.isEmpty(packages2)) {
                    if (_.eq(PackageMonitorStatusEnum.BONDED, packages2[0].status)) {
                        packages2 = await db.queryBySQL(
                            `select * from ${TABLE.packages_monitor} where platform=? and label_Code=?`,
                            [global.platform.name, packages2[0].label_Code]
                        );
                        pkg = {
                            labelCode: packages2[0].label_Code,
                            status: 'Bond',
                            packageAmt: _.size(packages2),
                            chuteNo: packages2[0].chuteNo,
                            terminal: packages2[0].terminal,
                            route: packages2[0].routeNo,
                            trackingNos: _.map(packages2, 'trackingNo'),
                            createTime: dayjs(packages2[0].updateTime).format('YYYY-MM-DD HH:mm:ss'),
                            bondTime: dayjs(packages2[0].updateTime).format('YYYY-MM-DD HH:mm:ss'),
                        };
                    } else if (_.includes([ChuteWorkStatusEnum.COLLECT_PACKAGE, ChuteWorkStatusEnum.FULL_PACKAGE], packages2[0].workStatus)
                        && _.eq(PackageMonitorStatusEnum.SORTED, packages2[0].status)) {
                        packages2 = await db.queryBySQL(
                            `select * from ${TABLE.packages_monitor} where platform=? and status=? and chuteNo=?`,
                            [global.platform.name, packages2[0].status, packages2[0].chuteNo]
                        );
                        pkg = {
                            status: 'Not Bound',
                            packageAmt: _.size(packages2),
                            chuteNo: packages2[0].chuteNo,
                            terminal: packages2[0].terminal,
                            route: packages2[0].routeNo,
                            trackingNos: _.map(packages2, 'trackingNo'),
                        };
                    }
                }
            }
        } else {
            pkg = {
                labelCode: packages[0].labelCode,
                status: packages[0].status,
                packageAmt: _.size(packages[0].details),
                chuteNo: packages[0].chuteNo,
                terminal: packages[0].terminal,
                route: packages[0].routeName,
                trackingNos: _.map(packages[0].details, 'barcode'),
                createTime: packages[0].createdWhen,
                bondTime: packages[0].updatedWhen,
            };
        }
        if (_.isEmpty(pkg)) {
            return httpError(res, 'Not Found');
        }
        return httpSuccess(res, pkg);
    } catch (e: any) {
        return httpError(res, e.message);
    }
};

export const getPackageInfo = async (res: any, params: any) => {
    if (_.isEmpty(params)) {
        return httpError(res, 'Request params cannot be empty');
    }
    if (_.isEmpty(params.chuteNo)) {
        return httpError(res, 'chuteNo is require');
    }
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    const queues = await db.queryBySQL(
        `select * from ${TABLE.QUEUE} where platform=? and type=? and url=?`,
        [global.platform.name, QueueTypeEnum.COLLET_PACKAGE, params.chuteNo]
    );
    if (_.isEmpty(queues)) {
        return httpError(res, 'Package data does not exist');
    }
    const data = JSON.parse(queues[0].data);
    return httpSuccess(res, data);
};

export const getQueuePackageInfoByChuteNo = async (chuteNo: string) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    const queuePackage = await db.getOne(TABLE.QUEUE, {
        platform: global.platform.name,
        type: QueueTypeEnum.COLLET_PACKAGE,
        url: chuteNo,
    });
    console.log('getQueuePackageInfo', queuePackage.data);
    if (_.isEmpty(queuePackage)) {
        throw new Error('Package data does not exist');
    }
    return JSON.parse(queuePackage.data);
};

export const packageBonded = async (res: any, params: any) => {
    if (_.isEmpty(params)) {
        return httpError(res, 'Request params cannot be empty');
    }
    if (_.isEmpty(params.chuteNo)) {
        return httpError(res, 'chuteNo is require');
    }
    if (_.isEmpty(params.labelCode)) {
        return httpError(res, 'labelCode is require');
    }
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    const platform = global.platform || await getPlatform();
    const chuteInfo = await getChuteInfoByChuteNo(params.chuteNo);
    const queues = await db.queryBySQL(
        `select * from ${TABLE.QUEUE} where platform=? and type=? and url=?`,
        [platform.name, QueueTypeEnum.COLLET_PACKAGE, params.chuteNo]
    );
    if (_.isEmpty(queues)) {
        return httpError(res, 'Package data does not exist');
    }
    const data = JSON.parse(queues[0].data);
    const reqData = {
        packageInfo: {
            waveNo: data.waveNo,
            chuteNo: data.chuteNo,
            terminal: data.terminal,
            routeName: data.routeName,
            type: chuteInfo.chuteType,
            packageNo: data.packageNo,
            details: data.details,
            collectPackageTime: data.fullPackageTime,
            localDetails: data.localDetails,
            status: 'Not Bound',
            platform: platform.name,
        },
        labelCode: params.labelCode,
    };
    try {
        const isLibiao = !params.unLibiao;
        await releaseChute(
            {
                chuteNo: params.chuteNo,
                platform: platform.name,
                labelCode: params.labelCode,
            },
            isLibiao
        );
    } catch (e: any) {
        return httpError(res, 'Release chute failure');
    }
    packageBondedByWMS(reqData);
    await db.delete(TABLE.QUEUE, {id: queues[0].id});
    return httpSuccess(res, reqData);
};

export const changeQueuePackageData = async (packageData: any, changeDetails: any) => {
    console.log('changeQueuePackageData');
    const localBarcodes = _.map(packageData.localDetails, 'barcode');
    const changeBarcodes = _.map(changeDetails, 'barcode');
    for (const barcode of localBarcodes) {
        if (!_.includes(changeBarcodes, barcode)) {
            await _getPackage(barcode);
        }
    }
    const details: any[] = [];
    for (const barcode of changeBarcodes) {
        if (!_.includes(localBarcodes, barcode)) {
            const pkgs = await db.query(TABLE.packages_monitor, { trackingNo: barcode, platform: global.platform.name });
            const pkg: any = _.isEmpty(pkgs) ? {} : pkgs[0];
            pkg.barcode = barcode;
            pkg.status = PackageMonitorStatusEnum.SORTED;
            pkg.chuteNo = packageData.chuteNo;
            pkg.terminal = packageData.terminal;
            pkg.waveNo = packageData.waveNo;
            pkg.routeNo = packageData.routeName;
            pkg.exceptionReason = '';
            pkg.labelCode = '';
            await saveScanPackage(pkg);
        }
        details.push({ barcode, qty: 1 });
    }
    const data = packageData;
    data.details = details;
    delete data.localDetails;
    await db.update(TABLE.QUEUE, {data: JSON.stringify(data)}, {url: packageData.chuteNo});
};

export const packageBondedByWMS = async (reqData: any) => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    const environment = cache.getCache('autoSortingEnvironment') || {};
    const platform = global.platform || await getPlatform();
    const strList = _.split(platform.name, '_');
    const headers: any = wiseHeaders;
    if (_.size(strList) == 3) {
        headers['WISE-Company-Id'] = strList[1];
        headers['WISE-Facility-Id'] = `${strList[1]}_${strList[2]}`;
    } else if (_.size(strList) == 2) {
        headers['WISE-Facility-Id'] = strList[1];
    }
    const url = `${environment.requestUrl}/shared/bam/package-bonding/task/bonded`;
    const config = { headers: headers };
    if (global.socketConnected) {
        try {
            await axios.post(url, reqData, config);
        } catch (e: any) {
            await db.insert(TABLE.QUEUE, {
                url,
                data: JSON.stringify(reqData),
                config: JSON.stringify(config),
                platform: platform.name,
                type: QueueTypeEnum.PACKAGE_BONDED,
                createdWhen: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            });
            await db.insert(TABLE.LOG, {
                platform: platform.name,
                logType: LogTypeEnum.WISE_REQUEST,
                logName: LogNameEnum.EXCEPTION,
                message: e.message,
                isException: 1,
                data: JSON.stringify({
                    url: url,
                    body: reqData,
                    config: config,
                    method: 'post',
                }),
            });
        }
    } else {
        await db.insert(TABLE.QUEUE, {
            url,
            data: JSON.stringify(reqData),
            config: JSON.stringify(config),
            platform: platform.name,
            type: QueueTypeEnum.PACKAGE_BONDED,
            createdWhen: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        });
    }
};

export const packageBondedQueue = async () => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    if (global.packageBondedQueue) return;
    global.packageBondedQueue = true;
    const queues = await db.queryBySQL(`select * from ${TABLE.QUEUE} where platform=? and type=?`, [
        global.platform.name,
        QueueTypeEnum.PACKAGE_BONDED,
    ]);
    for (const queue of queues) {
        if (global.socketConnected) {
            const data = JSON.parse(queue.data);
            const config = JSON.parse(queue.config);
            try {
                await axios.post(queue.url, data, config);
                await db.delete(TABLE.QUEUE, { id: queue.id });
            } catch (e: any) {
                await db.insert(TABLE.LOG, {
                    platform: platform.name,
                    logType: LogTypeEnum.WISE_REQUEST,
                    logName: LogNameEnum.EXCEPTION,
                    message: e.message,
                    isException: 1,
                    data: JSON.stringify({
                        url: queue.url,
                        body: data,
                        config: config,
                        method: 'post',
                    }),
                });
            }
        } else {
            global.packageBondedQueue = false;
            return;
        }
    }
    global.packageBondedQueue = false;
};

function removeCircularReferences() {
    const seen = new WeakSet();
    return function(key: any, value: any) {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return; // 跳过循环引用
            }
            seen.add(value);
        }
        return value;
    };
}

export const getAmazonawsPackageQueue = async () => {
    await tryInitDBIfNeed();
    await tryGetPlatformIfNeed();
    if (global.getAmazonawsPackageQueue) return;
    global.getAmazonawsPackageQueue = true;
    const queues = await db.queryBySQL(`select * from ${TABLE.QUEUE} where platform=? and type=?`, [global.platform.name, QueueTypeEnum.GET_AMAZONAWS_PACKAGE]);
    for (const queue of queues) {
        if (global.socketConnected) {
            const data = JSON.parse(queue.data);
            const config = JSON.parse(queue.config);
            try {
                const packageRes = await axios.post(queue.url, data, config);
                console.log('getAmazonawsPackage packageRes:', packageRes);
                const packagedetails = _.get(packageRes, 'data.Package.packagedetails') || {};
                if (_.isEmpty(packagedetails)) {
                    await db.insert(TABLE.LOG, {
                        platform: global.platform.name,
                        logType: LogTypeEnum.WISE_REQUEST,
                        logName: LogNameEnum.EXCEPTION,
                        message: 'packagedetails is null',
                        isException: 1,
                        data: JSON.stringify({
                            url: queue.url,
                            body: data,
                            config: config,
                            method: 'post',
                        }),
                    });
                    await db.delete(TABLE.QUEUE, { id: queue.id });
                    continue;
                }
                const wave = await db.getOne(TABLE.WAVE, { platform: global.platform.name, status: WaveStatusEnum.RUNNING });
                if (_.isEmpty(wave)) {
                    console.log('getAmazonawsPackage wave is not running');
                    global.getAmazonawsPackageQueue = false;
                    return;
                }
                const route = packagedetails.route ? packagedetails.route : '000.LSO';
                const terminal = packagedetails.terminalCode ? packagedetails.terminalCode : '000';
                const existsJob = await getJobByWaveIdAndChuteKey(wave.id, route, terminal);
                let jobId = 0;
                console.log('existsJob', existsJob);
                if (existsJob) {
                    jobId = existsJob['id'];
                    console.log('existsJob.status', existsJob.status);
                    if (existsJob.status == JobStatusEnum.COMPLETED) {
                        await updateJobStatus(jobId, JobStatusEnum.ASSIGNED);
                    }
                } else {
                    jobId = await saveJob({
                        waveId: wave.id,
                        waveNo: wave.waveNo,
                        chuteKey: route,
                        status: JobStatusEnum.UNASSIGNED,
                        terminal: terminal,
                    });
                }
                const existsItems = await searchJobItemByBarcode(data.barcode);
                const itemEntity = {
                    waveId: wave.id,
                    waveNo: wave.waveNo,
                    chuteKey: route,
                    jobId: jobId,
                    itemId: packagedetails.itemId,
                    itemName: packagedetails.itemName,
                    barcode: data.barcode,
                    shipToAddress: JSON.stringify({
                        address: `${packagedetails.toaddressline1} ${packagedetails.toaddressline2}, ${packagedetails.tocity}, ${packagedetails.tostate}, ${packagedetails.tozipcode}`,
                        toAddress1: packagedetails.toaddressline1,
                        toAddress2: packagedetails.toaddressline2,
                        toCity: packagedetails.tocity,
                        toState: packagedetails.tostate,
                        toCountry: 'USA',
                    }),
                    weight: packagedetails.weight,
                    volume: packagedetails.volume,
                    length: packagedetails.length,
                    height: packagedetails.height,
                    width: packagedetails.width,
                    cubicFeet: packagedetails.cubicFeet,
                    packageType: !_.isNil(packagedetails.height) && packagedetails.height > 0 ? 'Box' : 'Poly Bag',
                    zipcode: packagedetails.tozipcode,
                    qty: 1,
                    assignedQty: 0,
                    status: JobItemStatusEnum.UNASSIGNED,
                };
                if (_.isEmpty(existsItems)) {
                    await saveItem(itemEntity);
                } else {
                    await updateJobItem(existsItems[0].id, itemEntity);
                }
                await updateJobQty(jobId);
                const packageMonitors = await getPackagesMonitor({ trackingNo: data.barcode });
                const pkg: any = _.isEmpty(packageMonitors) ? {} : _.head(packageMonitors);
                if (!_.isEmpty(pkg)) {
                    pkg.barcode = pkg.trackingNo;
                    pkg.status = PackageMonitorStatusEnum.INCREMENTAL_FOUND;
                    pkg.chuteNo = '';
                    pkg.routeNo = '';
                    pkg.labelCode = '';
                    pkg.exceptionReason = '';
                    await updateScanPackage(pkg);
                }
                await db.delete(TABLE.QUEUE, { id: queue.id });
            } catch (e: any) {
                await db.insert(TABLE.LOG, {
                    platform: global.platform.name,
                    logType: LogTypeEnum.WISE_REQUEST,
                    logName: LogNameEnum.EXCEPTION,
                    message: e.message,
                    isException: 1,
                    data: JSON.stringify({
                        url: queue.url,
                        body: data,
                        config: config,
                        method: 'post',
                    }),
                });
            }
        }
    }
    global.getAmazonawsPackageQueue = false;
};

export const savePickupPackage = async (barcode: string) => {
    const items = await _getItems(barcode);
    if (_.isEmpty(items)) throw new Error('pickup package not found item');
    const today = dayjs().format('YYYY-MM-DD');
    const data = await db.query(TABLE.PACKAGE_DATA_POOL_TODAY, {
        routeName: items[0].chuteKey,
        packageType: items[0].packageType,
        pickupDate: today,
        platform: global.platform.name,
    });
    if (_.isEmpty(data)) {
        await db.insert(TABLE.PACKAGE_DATA_POOL_TODAY, {
            routeName: items[0].chuteKey,
            packageType: items[0].packageType,
            pickupDate: today,
            count: 1,
            platform: global.platform.name,
        });
    } else {
        await db.update(TABLE.PACKAGE_DATA_POOL_TODAY, { count_INC: 1 }, { id: data[0].id });
    }
};

export const buildPackageDataPool = async () => {
    await tryInitDBIfNeed();
    const userHome = await getUserHome();
    const folderPath = `${userHome}/packageDataPool`;
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
        console.log(`${folderPath} created successfully!`);
    }
    const platform = await getPlatform();
    const folderPath2 = `${folderPath}/${platform.name}`;
    if (!fs.existsSync(folderPath2)) {
        fs.mkdirSync(folderPath2);
        console.log(`${folderPath2} created successfully!`);
    }
    const polyBagPath = `${folderPath2}/${JobItemPackageTypeEnum.POLY_BAG}`;
    if (!fs.existsSync(polyBagPath)) {
        fs.mkdirSync(polyBagPath);
        console.log(`${polyBagPath} created successfully!`);
    }
    const boxBagPath = `${folderPath2}/${JobItemPackageTypeEnum.BOX}`;
    if (!fs.existsSync(boxBagPath)) {
        fs.mkdirSync(boxBagPath);
        console.log(`${boxBagPath} created successfully!`);
    }
    const today = dayjs().format('YYYY-MM-DD');
    const data = await db.query(TABLE.PACKAGE_DATA_POOL_TODAY, {
        pickupDate_NE: today,
        platform: global.platform.name,
    });
    if (_.isEmpty(data)) return;
    const groupByPkgType = _.groupBy(data, 'packageType');
    await addNewPackageData(groupByPkgType[JobItemPackageTypeEnum.POLY_BAG], polyBagPath);
    await addNewPackageData(groupByPkgType[JobItemPackageTypeEnum.BOX], boxBagPath);
};

export const addNewPackageData = async (data: any[], path: string) => {
    if (_.isEmpty(data)) return;
    const ids = _.map(data, 'id');
    const groups = _.values(_.groupBy(data, 'pickupDate'));
    for (const group of groups) {
        const polyBagData = _.map(group, (pkg: any) => {
            return { Route: pkg.routeName, Count: pkg.count };
        });
        const workbook = await XLSX.utils.book_new();
        const worksheet = await XLSX.utils.json_to_sheet(polyBagData, {
            header: ['Route', 'Count'],
        });
        await XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        await XLSX.writeFile(workbook, `${path}/${group[0].pickupDate}.xlsx`);
    }
    await db.delete(TABLE.PACKAGE_DATA_POOL_TODAY, {
        id_IN: ids,
    });
    deleteOldPackageData(path);
};

export const deleteOldPackageData = (path: string): void => {
    fs.readdir(path, async (err, files) => {
        if (err) {
            console.error('Error reading folder:', err);
            return;
        }
        if (_.size(files) > 180) {
            const frequency = _.size(files) - 180;
            let dates = _.map(files, (fileName: string) => {
                return _.replace(fileName, '.xlsx', '');
            });
            for (let id = 0; id <= frequency; id++) {
                const minDate = _.reduce(dates, (min: string, current: string) => {
                    return dayjs(current).isBefore(dayjs(min)) ? current : min;
                });
                fs.unlinkSync(`${path}/${minDate}.xlsx`);
                dates = _.filter(dates, (date: string) => date !== minDate);
            }
        }
    });
};

export const closeLibiaoWave = async () => {
    if (global.platform.closeWaveUrl) {
        console.log('closeLibiaoWave');
        return await dealCallbackMessage(
            { url: global.platform.closeWaveUrl, data: {} },
            LogTypeEnum.BIN_OPEN_CALLBACK
        );
    }
};
