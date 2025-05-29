import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

export async function createSqliteConnection(dbPath: string): Promise<Database> {
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    return db;
} 