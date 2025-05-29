import { createSqliteConnection } from './SQLiteDBConnection';
import { PrintJobLog } from '../shared/printLogger';
import path from 'path';
import os from 'os';

class PrintLogDatabase {
    private db: any;
    private readonly TABLE_NAME = 'print_logs';
    private initialized: boolean = false;

    constructor() {
        this.initialize();
    }

    async initialize() {
        if (this.initialized) return;
        
        const dbPath = path.join(__dirname, '..', '..', 'AutoSorting.db');
        this.db = await createSqliteConnection(dbPath);
        
        // Create table if it doesn't exist
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS ${this.TABLE_NAME} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                username TEXT,
                printerName TEXT,
                content TEXT,
                dnNumber TEXT,
                jobId TEXT,
                status TEXT,
                error TEXT,
                copies INTEGER DEFAULT 1,
                createdAt INTEGER DEFAULT (strftime('%s', 'now')),
                updatedAt INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);
        
        this.initialized = true;
    }

    private async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    async logPrintJob(logEntry: PrintJobLog): Promise<void> {
        try {
            await this.ensureInitialized();
            
            // Extract DN number from content - improved pattern matching
            const dnMatch = logEntry.content.match(/Order Number:\s*(DN-\d+)/i);
            const dnNumber = dnMatch ? dnMatch[1] : null;

            if (dnNumber) {
                // Check if this DN number already exists
                const existingLog = await this.db.get(
                    `SELECT * FROM ${this.TABLE_NAME} WHERE dnNumber = ? ORDER BY timestamp DESC LIMIT 1`,
                    [dnNumber]
                );

                if (existingLog) {
                    // Update existing record with incremented copies
                    const currentCopies = existingLog.copies || 1;
                    const newCopies = currentCopies + (logEntry.copies || 1);
                    
                    await this.db.run(
                        `UPDATE ${this.TABLE_NAME} 
                        SET copies = ?, 
                            timestamp = ?,
                            updatedAt = (strftime('%s', 'now'))
                        WHERE dnNumber = ?`,
                        [newCopies, logEntry.timestamp, dnNumber]
                    );
                } else {
                    // Insert new record
                    const sql = `INSERT INTO ${this.TABLE_NAME} 
                        (timestamp, username, printerName, content, dnNumber, jobId, status, error, copies) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    
                    await this.db.run(sql, [
                        logEntry.timestamp,
                        logEntry.username,
                        logEntry.printerName,
                        logEntry.content,
                        dnNumber,
                        logEntry.jobId || null,
                        logEntry.status,
                        logEntry.error || null,
                        logEntry.copies || 1
                    ]);
                }
            } else {
                // If no DN number found, insert as normal
                const sql = `INSERT INTO ${this.TABLE_NAME} 
                    (timestamp, username, printerName, content, jobId, status, error, copies) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                
                await this.db.run(sql, [
                    logEntry.timestamp,
                    logEntry.username,
                    logEntry.printerName,
                    logEntry.content,
                    logEntry.jobId || null,
                    logEntry.status,
                    logEntry.error || null,
                    logEntry.copies || 1
                ]);
            }
        } catch (error) {
            console.error('Error logging print job to database:', error);
            throw error;
        }
    }

    async getLogs(limit: number = 100, offset: number = 0): Promise<PrintJobLog[]> {
        try {
            await this.ensureInitialized();
            const sql = `SELECT * FROM ${this.TABLE_NAME} 
                ORDER BY timestamp DESC 
                LIMIT ? OFFSET ?`;
            
            return await this.db.all(sql, [limit, offset]);
        } catch (error) {
            console.error('Error retrieving print logs from database:', error);
            throw error;
        }
    }

    async searchLogs(query: string): Promise<PrintJobLog[]> {
        try {
            await this.ensureInitialized();
            const searchPattern = `%${query.toLowerCase()}%`;
            const sql = `SELECT * FROM ${this.TABLE_NAME} 
                WHERE LOWER(username) LIKE ? 
                OR LOWER(printerName) LIKE ? 
                OR LOWER(content) LIKE ? 
                OR LOWER(jobId) LIKE ?
                OR LOWER(dnNumber) LIKE ?
                ORDER BY timestamp DESC`;
            
            return await this.db.all(sql, [
                searchPattern,
                searchPattern,
                searchPattern,
                searchPattern,
                searchPattern
            ]);
        } catch (error) {
            console.error('Error searching print logs:', error);
            throw error;
        }
    }

    async clearOldLogs(daysToKeep: number = 30): Promise<void> {
        try {
            await this.ensureInitialized();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            const sql = `DELETE FROM ${this.TABLE_NAME} 
                WHERE datetime(timestamp) < datetime(?)`;
            
            await this.db.run(sql, [cutoffDate.toISOString()]);
        } catch (error) {
            console.error('Error clearing old print logs:', error);
            throw error;
        }
    }
}

export const printLogDb = new PrintLogDatabase(); 