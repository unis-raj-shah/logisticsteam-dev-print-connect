import fs from 'fs';
import path from 'path';
import os from 'os';
import { printLogDb } from '../db/printLogDb';

export interface PrintJobLog {
    timestamp: string;
    username: string;
    printerName: string;
    content: string;
    jobId?: string;
    status: 'success' | 'error';
    error?: string;
    copies?: number;
}

export class PrintLogger {
    private logDir: string;
    private logFile: string;

    constructor() {
        this.logDir = path.join(os.homedir(), 'print_logs');
        this.logFile = path.join(this.logDir, 'print_jobs.json');
        this.initialize();
    }

    private initialize(): void {
        try {
            // Create log directory if it doesn't exist
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true });
            }

            // Create log file if it doesn't exist
            if (!fs.existsSync(this.logFile)) {
                fs.writeFileSync(this.logFile, JSON.stringify([], null, 2));
            }

            // Initialize database
            printLogDb.initialize();
            printLogDb.clearOldLogs(30);
        } catch (error) {
            console.error('Error initializing print logger:', error);
        }
    }

    logPrintJob(logEntry: PrintJobLog): void {
        try {
            // Read existing logs
            const logs = this.readLogs();

            // Check if content contains multiple ZPL labels (multiple ^XA...^XZ blocks)
            const zplBlocks = typeof logEntry.content === 'string'
                ? logEntry.content.match(/\^XA[\s\S]*?\^XZ/g)
                : null;

            if (zplBlocks && zplBlocks.length > 1) {
                // Log each label as a separate entry
                zplBlocks.forEach((block, idx) => {
                    const copiesMatch = block.match(/^PQ(\d+)/m);
                    const copies = copiesMatch ? parseInt(copiesMatch[1]) : 1;
                    const entryWithCopies = {
                        ...logEntry,
                        content: block,
                        jobId: logEntry.jobId ? `${logEntry.jobId}_${idx + 1}` : undefined,
                        copies
                    };
                    logs.push(entryWithCopies);
                    printLogDb.logPrintJob(entryWithCopies);
                });
            } else {
                // Extract number of copies from ZPL content if present
                const copiesMatch = logEntry.content.match(/^PQ(\d+)/m);
                const copies = copiesMatch ? parseInt(copiesMatch[1]) : 1;
                // Add new log entry with copies information
                const entryWithCopies = {
                    ...logEntry,
                    copies
                };
                logs.push(entryWithCopies);
                printLogDb.logPrintJob(entryWithCopies);
            }

            // Write back to file
            fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error('Error logging print job:', error);
        }
    }

    getLogs(limit: number = 100, offset: number = 0): PrintJobLog[] {
        try {
            return printLogDb.getLogs(limit, offset);
        } catch (error) {
            console.error('Error getting print logs:', error);
            return [];
        }
    }

    searchLogs(query: string): PrintJobLog[] {
        try {
            return printLogDb.searchLogs(query);
        } catch (error) {
            console.error('Error searching print logs:', error);
            return [];
        }
    }

    private readLogs(): PrintJobLog[] {
        try {
            const data = fs.readFileSync(this.logFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading print logs:', error);
            return [];
        }
    }
}

export const printLogger = new PrintLogger(); 