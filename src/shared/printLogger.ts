import { printLogDb } from '../db/printLogDb';
import path from 'path';
import fs from 'fs';

export interface PrintJobLog {
    timestamp: string;
    username: string;
    printerName: string;
    content: string;
    dnNumber?: string;
    jobId?: string;
    status: 'success' | 'error';
    error?: string;
    copies?: number;
}

export class PrintLogger {
    private readonly LOGS_FILE_PATH: string;

    constructor() {
        // Store logs in the project root directory
        this.LOGS_FILE_PATH = path.join(__dirname, '..', '..', 'print_logs.json');
        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            await printLogDb.initialize();
            // Initialize JSON file if it doesn't exist
            if (!fs.existsSync(this.LOGS_FILE_PATH)) {
                fs.writeFileSync(this.LOGS_FILE_PATH, JSON.stringify({ print_logs: [] }, null, 2));
            }
        } catch (error) {
            console.error('Error initializing print logger:', error);
        }
    }

    async logPrintJob(logEntry: PrintJobLog): Promise<void> {
        try {
            // Extract DN number from content if present
            const dnMatch = logEntry.content.match(/Order Number:\s*(DN-\d+)/i);
            const dnNumber = dnMatch ? dnMatch[1] : undefined;

            // Check if content contains multiple ZPL labels (multiple ^XA...^XZ blocks)
            const zplBlocks = typeof logEntry.content === 'string'
                ? logEntry.content.match(/\^XA[\s\S]*?\^XZ/g)
                : null;

            if (zplBlocks && zplBlocks.length > 1) {
                // Log each label as a separate entry
                for (let idx = 0; idx < zplBlocks.length; idx++) {
                    const block = zplBlocks[idx];
                    const copiesMatch = block.match(/^PQ(\d+)/m);
                    const copies = copiesMatch ? parseInt(copiesMatch[1]) : 1;
                    const entryWithCopies: PrintJobLog = {
                        ...logEntry,
                        content: block,
                        jobId: logEntry.jobId ? `${logEntry.jobId}_${idx + 1}` : undefined,
                        copies,
                        dnNumber
                    };
                    await printLogDb.logPrintJob(entryWithCopies);
                    await this.appendToJsonLog(entryWithCopies);
                }
            } else {
                // Extract number of copies from ZPL content if present
                const copiesMatch = logEntry.content.match(/^PQ(\d+)/m);
                const copies = copiesMatch ? parseInt(copiesMatch[1]) : 1;
                // Add new log entry with copies information
                const entryWithCopies: PrintJobLog = {
                    ...logEntry,
                    copies,
                    dnNumber
                };
                await printLogDb.logPrintJob(entryWithCopies);
                await this.appendToJsonLog(entryWithCopies);
            }
        } catch (error) {
            console.error('Error logging print job:', error);
        }
    }

    private async appendToJsonLog(logEntry: PrintJobLog): Promise<void> {
        try {
            const data = JSON.parse(fs.readFileSync(this.LOGS_FILE_PATH, 'utf8'));
            
            if (logEntry.dnNumber) {
                // Find existing entry with the same DN number
                const existingIndex = data.print_logs.findIndex(
                    (log: PrintJobLog) => log.dnNumber === logEntry.dnNumber
                );

                if (existingIndex !== -1) {
                    // Update existing entry
                    const existingLog = data.print_logs[existingIndex];
                    const currentCopies = existingLog.copies || 1;
                    const newCopies = currentCopies + (logEntry.copies || 1);
                    
                    data.print_logs[existingIndex] = {
                        ...existingLog,
                        timestamp: logEntry.timestamp,
                        copies: newCopies,
                        content: logEntry.content // Update content to show latest version
                    };
                } else {
                    // Add new entry with initial copies count
                    data.print_logs.push({
                        ...logEntry,
                        copies: logEntry.copies || 1
                    });
                }
            } else {
                // If no DN number, just add as new entry
                data.print_logs.push({
                    ...logEntry,
                    copies: logEntry.copies || 1
                });
            }

            // Write back to file with pretty formatting
            fs.writeFileSync(this.LOGS_FILE_PATH, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error appending to JSON log:', error);
        }
    }

    async getLogs(limit: number = 100, offset: number = 0): Promise<PrintJobLog[]> {
        try {
            return await printLogDb.getLogs(limit, offset);
        } catch (error) {
            console.error('Error getting print logs:', error);
            return [];
        }
    }

    async searchLogs(query: string): Promise<PrintJobLog[]> {
        try {
            return await printLogDb.searchLogs(query);
        } catch (error) {
            console.error('Error searching print logs:', error);
            return [];
        }
    }
} 