import logger from '@/service/autoSortingLogService';
import { LogNameEnum, TABLE } from '@/constants/autoSortingConstants';
import dayjs from 'dayjs';
import sqlite from 'sqlite3';

const sqlite3 = sqlite.verbose();

const isDev = true;
const SKIP_UPDATED_AT_TABLES = [TABLE.PACKAGE_DETAIL, TABLE.LOG, TABLE.packages_monitor];


function debug(sql: any, params: any) {
    if (isDev) {
        logger.info({ sql: sql, params: params });
    }
}

function recordSQLIfSlow(sql: any, params: any, elapsedMs: any) {
    if (elapsedMs >= 1000) {
        logger.infoLog({ sql: sql, params: params, elapsedMs: elapsedMs }, LogNameEnum.SLOW_SQL);
    }
}

function getQuerySQL(tableName: string, data?: { [s: string]: unknown }) {
    let sql = `SELECT * FROM ${tableName}`;
    const params: any = [];
    if (data) {
        sql += ` WHERE  ${getWhereClause(data, params)}`;
    }
    return { sql, params };
}

function getCountQuerySQL(tableName: string, data?: { [s: string]: unknown }) {
    let sql = `SELECT COUNT(*) as num FROM ${tableName}`;
    const params: any = [];
    if (data) {
        sql += ` WHERE  ${getWhereClause(data, params)}`;
    }
    return { sql, params };
}

function getWhereClause(data: { [s: string]: any }, params: any) {
    const whereClause = Object.keys(data)
        .map((column) => {
            if (column.endsWith('_NE')) {
                return `${column.substring(0, column.length - 3)} != ?`;
            }
            if (column.endsWith('_NIN') || column.endsWith('_IN')) {
                let values = data[column];
                if (!Array.isArray(values)) {
                    // 如果值不是数组，则将其转换为数组
                    values = [values];
                }
                const placeholders = values.map(() => '?').join(',');
                if (column.endsWith('_NIN')) {
                    return `${column.substring(0, column.length - 4)} not in (${placeholders})`;
                }
                return `${column.substring(0, column.length - 3)} in (${placeholders})`;
            }
            if (column.endsWith('_LT')) {
                return `${column.substring(0, column.length - 3)} < ?`;
            }
            return `${column} = ?`;
        })
        .join(' and ');
    params.push(...Object.values(data).flat());
    debug(`whereClause:${whereClause}`, params);
    return whereClause;
}

function getWhereSQL(data: { [s: string]: unknown }, params: any) {
    let sql = ``;
    if (data) {
        sql += ` WHERE  ${getWhereClause(data, params)}`;
    }
    return sql;
}

export const createSqliteConnection = (databaseName: string) => {
    const _db = new sqlite3.Database(databaseName);
    _db.configure('busyTimeout', 5000);
    _db.on('profile', (sql: any, time: any) => {
        console.log(`SQL executed: ${sql} in ${time} milliseconds`);
    });
    _db.on('trace', (sql: any) => {
        console.log(`SQL executed: ${sql}`);
    });
    //_db.run('PRAGMA busy_timeout = 15000');
    return {
        db: _db,
        createTable: async (tableName: any, columns: any[]) => {
            return new Promise((resolve, reject) => {
                const columnDefinitions = columns
                    .map((column) => `${column.name} ${column.type}`)
                    .join(', ');
                const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefinitions})`;
                _db.run(sql, function(err: any) {
                    if (err) {
                        logger.error({ name: 'createTable', sql: sql, errMsg: err.message });
                        reject(err);
                    } else {
                        // @ts-ignore
                        resolve(this.changes);
                    }
                });
            });
        },
        queryBySQL: async (sql: string, params?: any) => {
            return new Promise((resolve, reject) => {
                debug(sql, params);
                const startTime = Date.now();
                _db.all(sql, params, (err: any, rows: unknown) => {
                    const endTime = Date.now();
                    const elapsedMs = endTime - startTime;
                    console.info(` queryBySQL elapsed ${elapsedMs} ms`);
                    recordSQLIfSlow(sql, params, elapsedMs);

                    if (err) {
                        logger.error({ name: 'queryBySQL', sql: sql, params: params, errMsg: err.message });
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
        },
        queryBySQLPage: async (sql: string, params?: any, queryObj?: any) => {
            return new Promise((resolve, reject) => {
                let sqlWithPaging = sql;
                if (queryObj && queryObj.paging) {
                    if (!queryObj.paging.pageNo){
                        queryObj.paging.pageNo = 1;
                    }
                    if (!queryObj.paging.limit){
                        queryObj.paging.limit = 10;
                    }
                    // 解析分页参数
                    const { pageNo, limit } = queryObj.paging;
                    const offset = (pageNo - 1) * limit;

                    // 构造分页查询参数
                    sqlWithPaging = `${sql} LIMIT ${limit} OFFSET ${offset}`;
                }
                debug(sqlWithPaging, params);
                const startTime = Date.now();
                _db.all(sqlWithPaging, params, (err: any, rows: unknown) => {
                    const endTime = Date.now();
                    const elapsedMs = endTime - startTime;
                    console.info(` queryBySQL elapsed ${elapsedMs} ms`);
                    recordSQLIfSlow(sqlWithPaging, params, elapsedMs);

                    if (err) {
                        logger.error({ name: 'queryBySQLPage', sql: sqlWithPaging, params: params, errMsg: err.message });
                        reject(err);
                    } else {
                        if (queryObj && queryObj.paging) {
                            // 查询总行数
                            const countSql = `SELECT COUNT(*) as totalCount FROM (${sql})`;
                            _db.get(countSql, params, (err: any, result: { totalCount: number }) => {
                                if (err) {
                                    logger.error({
                                        name: 'queryBySQLPageCount',
                                        sql: countSql,
                                        params: params,
                                        errMsg: err.message,
                                    });
                                    reject(err);
                                } else {
                                    resolve({
                                        data: rows, paging: {
                                            pageNo: queryObj.paging.pageNo,
                                            limit: queryObj.paging.limit,
                                            totalCount: result.totalCount,
                                            totalPage: Math.ceil(result.totalCount / queryObj.paging.limit)
                                        },
                                    });
                                }
                            });
                            return;
                        }
                        resolve(rows);
                    }
                });
            });
        },
        query: async (tableName: any, data?: { [s: string]: unknown }) => {
            return new Promise((resolve, reject) => {
                const { sql, params } = getQuerySQL(tableName, data);
                debug(sql, params);
                _db.all(sql, params, (err: any, rows: unknown) => {
                    if (err) {
                        logger.error({ name: 'query', sql: sql, params: params, errMsg: err.message });
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
        },
        beginTransaction: async () => {
            return new Promise((resolve, reject) => {
                _db.run('BEGIN TRANSACTION', function(err: any) {
                    if (err) {
                        logger.error({ name: 'beginTransaction', errMsg: err.message });
                        resolve(true);
                    } else {
                        resolve(true);
                    }
                });
            });
        },
        async commit() {
            return new Promise((resolve, reject) => {
                _db.run('COMMIT', function(err: any) {
                    if (err) {
                        logger.error({ name: 'commit', errMsg: err.message });
                        resolve(true);
                    } else {
                        resolve(true);
                    }
                });
            });
        },
        async rollback() {
            return new Promise((resolve, reject) => {
                _db.run('ROLLBACK', function(err: any) {
                    if (err) {
                        logger.error({ name: 'rollback', errMsg: err.message });
                        resolve(true);
                    } else {
                        resolve(true);
                    }
                });
            });
        },
        async getOneBySQL(sql: any, params?: ArrayLike<unknown>) {
            return new Promise((resolve, reject) => {
                debug(sql, params);
                _db.get(sql, params, (err: any, row: unknown) => {
                    if (err) {
                        logger.error({
                            name: 'getOneBySQL',
                            sql: sql,
                            params: params,
                            err: err,
                            errMsg: err.message,
                        });
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
        },
        async getOne(tableName: any, data?: { [s: string]: unknown }) {
            return new Promise((resolve, reject) => {
                const { sql, params } = getQuerySQL(tableName, data);
                debug(sql, params);
                _db.get(sql, params, (err: any, row: unknown) => {
                    if (err) {
                        logger.error({ name: 'getOne', sql: sql, errMsg: err.message });
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
        },
        async getCountBySQL(sql: any, params?: { [s: string]: unknown }) {
            return new Promise((resolve, reject) => {
                debug(sql, params);
                const startTime = Date.now();
                _db.get(sql, params, (err: any, row: { [s: string]: unknown }) => {
                    const endTime = Date.now();
                    const elapsedMs = endTime - startTime;
                    console.info(` getCountBySQL elapsed ${elapsedMs} ms`);
                    recordSQLIfSlow(sql, params, elapsedMs);

                    if (err) {
                        logger.error({
                            name: 'getCountBySQL', sql: sql, params: params, errMsg: err.message,
                        });
                        reject(err);
                    } else {
                        resolve(row.num);
                    }
                });
            });
        },
        async getCount(tableName: any, data?: { [s: string]: unknown }) {
            return new Promise((resolve, reject) => {
                const { sql, params } = getCountQuerySQL(tableName, data);
                debug(sql, params);
                _db.get(sql, params, (err: any, row: { [s: string]: unknown }) => {
                    if (err) {
                        logger.error({
                            name: 'getCount', sql: sql, params: params, errMsg: err.message,
                        });
                        reject(err);
                    } else {
                        resolve(row.num);
                    }
                });
            });
        },
        async update(
            tableName: any,
            data: { [s: string]: any },
            conditionData: { [s: string]: any },
        ) {
            return new Promise((resolve, reject) => {
                let updateAt = '';
                if (!SKIP_UPDATED_AT_TABLES.includes(tableName)) {
                    if ('updatedAt' in data) {
                        data['updatedAt'] = dayjs().unix();
                    } else {
                        updateAt = `updatedAt=${dayjs().unix()},`;
                    }
                }
                const setClause = Object.keys(data)
                    .map((column) => {
                        if (column.endsWith('_INC')) {
                            return `${column.substring(0, column.length - 4)} = ${column.substring(0, column.length - 4)} + ?`;
                        }
                        if (column.endsWith('_DEC')) {
                            return `${column.substring(0, column.length - 4)} = ${column.substring(0, column.length - 4)} - ?`;
                        }
                        return `${column} = ?`;
                    })
                    .join(', ');
                const params = Object.values(data);
                const whereSQL = getWhereSQL(conditionData, params);
                const sql = `UPDATE ${tableName} SET ${updateAt}${setClause} ${whereSQL}`;
                debug(sql, params);
                _db.run(sql, params, function(err: any) {
                    if (err) {
                        logger.error({ name: 'update', sql: sql, params: params, errMsg: err.message });
                        reject(err);
                    } else {
                        // @ts-ignore
                        resolve(this.changes);
                    }
                });
            });
        },
        async insert(tableName: any, data: ArrayLike<unknown> | { [s: string]: unknown }) {
            return new Promise((resolve, reject) => {
                const columns = Object.keys(data).join(', ');
                const placeholders = Object.keys(data)
                    .map(() => '?')
                    .join(', ');
                const params = Object.values(data);
                const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
                _db.run(sql, params, function(err: any) {
                    if (err) {
                        logger.error({ name: 'insert', sql: sql, params: params, errMsg: err.message });
                        reject(err);
                    } else {
                        // @ts-ignore
                        resolve(this.lastID);
                    }
                });
            });
        },
        async updateOrInsert(
            tableName: any,
            data: { [s: string]: unknown },
            conditionData: { [s: string]: unknown },
        ) {
            const existingData = await this.getOne(tableName, conditionData);
            if (existingData) {
                // 数据存在，执行更新操作
                return await this.update(tableName, data, conditionData);
            } else {
                // 数据不存在，执行插入操作
                return await this.insert(tableName, data);
            }
        },
        async delete(tableName: any, data: { [s: string]: unknown }) {
            return new Promise((resolve, reject) => {
                const params: any = [];
                const whereSQL = getWhereSQL(data, params);
                const sql = `DELETE FROM ${tableName} ${whereSQL}`;
                _db.run(sql, params, function(err: any) {
                    if (err) {
                        logger.error({ name: 'delete', sql: sql, params: params, errMsg: err.message });
                        reject(err);
                    } else {
                        // @ts-ignore
                        resolve(this.lastID);
                    }
                });
            });
        },
        close: async () => {
            return new Promise((resolve, reject) => {
                _db.close((err: any) => {
                    if (err) {
                        logger.error({ name: 'close', errMsg: err.message });
                        reject(err);
                    } else {
                        logger.info('close success');
                        resolve(true);
                    }
                });
            });
        },
        run: async (sql: any, params?: any) => {
            return new Promise((resolve, reject) => {
                _db.run(sql, params, function(err: any) {
                    if (err) {
                        logger.error({ name: 'run', sql: sql, params: params, errMsg: err.message });
                        reject(err);
                    } else {
                        resolve(true);
                    }
                });
            });
        },
        runBySqlArray: async (db: any, sqlArray: any) => {
            console.log('runBySqlArray', sqlArray);
            for (const sql of sqlArray) {
                await db.run(sql).catch((err: any) => {
                    logger.error(`runBySqlArray error:${err.stack}`);
                    return;
                });
            }
        },
        getPagedData: async (tableName: any, page: number, pageSize: number, condition: any) => {
            const offset = (page - 1) * pageSize;
            const countQuery = `SELECT COUNT(*) as total FROM ${tableName} WHERE ${condition}`;
            const dataQuery = `SELECT * FROM ${tableName} WHERE ${condition} LIMIT ? OFFSET ?`;

            return new Promise((resolve, reject) => {
                _db.serialize(() => {
                    _db.get(countQuery, (err: any, row: { total: any }) => {
                        if (err) {
                            reject(err);
                        } else {
                            const total = row.total;

                            _db.all(dataQuery, [pageSize, offset], (err: any, rows: any) => {
                                if (err) {
                                    logger.error({ name: 'getPagedData', sql: dataQuery, errMsg: err.message });
                                    reject(err);
                                } else {
                                    const totalPages = Math.ceil(total / pageSize);
                                    resolve({ data: rows, total, totalPages });
                                }
                            });
                        }
                    });
                });
            });
        },
    };
};
