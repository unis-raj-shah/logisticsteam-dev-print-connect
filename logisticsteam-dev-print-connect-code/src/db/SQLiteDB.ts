const sqlite3 = require('sqlite3').verbose();

import logger from '@/service/autoSortingLogService';
import { TABLE } from '@/constants/autoSortingConstants';
import dayjs from 'dayjs';

let _db: any;
const isDev: boolean = true;
const SKIP_UPDATED_AT_TABLES = [TABLE.PACKAGE_DETAIL, TABLE.LOG];

class SQLiteDB {
    constructor(databaseName: string) {
        _db = new sqlite3.Database(databaseName);
        _db.configure('busyTimeout', 5000);
        _db.on('profile', (sql: any, time: any) => {
            console.log(`SQL executed: ${sql} in ${time} milliseconds`);
        });
        _db.on('trace', (sql: any) => {
            console.log(`SQL executed: ${sql}`);
        });
    }

    async createTable(tableName: any, columns: any[]) {
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
    }

    debug(sql: any, params: any) {
        if (isDev) {
            logger.info({ sql: sql, params: params });
        }
    }

    async queryBySQL(sql: string, params?: any) {
        return new Promise((resolve, reject) => {
            this.debug(sql, params);
            _db.all(sql, params, (err: any, rows: unknown) => {
                if (err) {
                    logger.error({ name: 'queryBySQL', sql: sql, params: params, errMsg: err.message });
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    getQuerySQL(tableName: string, data?: { [s: string]: unknown }) {
        let sql = `SELECT * FROM ${tableName}`;
        let params: any = [];
        if (data) {
            sql += ` WHERE  ${this.getWhereClause(data, params)}`;
        }
        return { sql, params };
    }

    getCountQuerySQL(tableName: string, data?: { [s: string]: unknown }) {
        let sql = `SELECT COUNT(*) as num FROM ${tableName}`;
        let params: any = [];
        if (data) {
            sql += ` WHERE  ${this.getWhereClause(data, params)}`;
        }
        return { sql, params };
    }

    getWhereClause(data: { [s: string]: any }, params: any) {
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
                return `${column} = ?`;
            })
            .join(' and ');
        params.push(...Object.values(data).flat());
        this.debug(`whereClause:${whereClause}`, params);
        return whereClause;
    }

    getWhereSQL(data: { [s: string]: unknown }, params: any) {
        let sql = ``;
        if (data) {
            sql += ` WHERE  ${this.getWhereClause(data, params)}`;
        }
        return sql;
    }

    async query(tableName: any, data?: { [s: string]: unknown }) {
        return new Promise((resolve, reject) => {
            let { sql, params } = this.getQuerySQL(tableName, data);
            this.debug(sql, params);
            _db.all(sql, params, (err: any, rows: unknown) => {
                if (err) {
                    logger.error({ name: 'query', sql: sql, params: params, errMsg: err.message });
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async beginTransaction() {
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
    }

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
    }

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
    }

    async getOneBySQL(sql: any, params?: ArrayLike<unknown>) {
        return new Promise((resolve, reject) => {
            this.debug(sql, params);
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
    }

    async getOne(tableName: any, data?: { [s: string]: unknown }) {
        return new Promise((resolve, reject) => {
            let { sql, params } = this.getQuerySQL(tableName, data);
            this.debug(sql, params);
            _db.get(sql, params, (err: any, row: unknown) => {
                if (err) {
                    logger.error({ name: 'getOne', sql: sql, errMsg: err.message });
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getCountBySQL(sql: any, params?: { [s: string]: unknown }) {
        return new Promise((resolve, reject) => {
            this.debug(sql, params);
            _db.get(sql, params, (err: any, row: { [s: string]: unknown }) => {
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
    }

    async getCount(tableName: any, data?: { [s: string]: unknown }) {
        return new Promise((resolve, reject) => {
            let { sql, params } = this.getCountQuerySQL(tableName, data);
            this.debug(sql, params);
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
    }

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
            let params = Object.values(data);
            const whereSQL = this.getWhereSQL(conditionData, params);
            const sql = `UPDATE ${tableName} SET ${updateAt}${setClause} ${whereSQL}`;
            this.debug(sql, params);
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
    }

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
    }

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
    }

    async delete(tableName: any, data: { [s: string]: unknown }) {
        return new Promise((resolve, reject) => {
            let params: any = [];
            const whereSQL = this.getWhereSQL(data, params);
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
    }

    async close() {
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
    }

    async run(sql: any, params?: any) {
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
    }

    async runBySqlArray(db: any, sqlArray: any)  {
        for (const sql of sqlArray) {
            await db.run(sql).catch((err: any) => {
                console.error(err);
            });
        }
    }

    async getPagedData(tableName: any, page: number, pageSize: number, condition: any) {
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
    }
}

export default SQLiteDB;
