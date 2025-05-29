import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import path from 'path';
import os from 'os';
import { PrintJobLog } from '../shared/printLogger';

interface DatabaseSchema {
    print_logs: PrintJobLog[];
}

class PrintLogDatabase {
    private db: low.LowdbSync<DatabaseSchema>;
    private dbPath: string;

    constructor() {
        this.dbPath = path.join(os.homedir(), 'print_logs.json');
        const adapter = new FileSync<DatabaseSchema>(this.dbPath);
        this.db = low(adapter);
    }

    private formatZPLContent(zplContent: string): string {
        try {
            // Extract human-readable information from ZPL
            const content: { [key: string]: string } = {};
            
            // Extract Order Number
            const orderNoMatch = zplContent.match(/ORDER NO\.: ([^\^]+)/);
            if (orderNoMatch) content['Order Number'] = orderNoMatch[1].trim();

            // Extract From Address
            const fromMatch = zplContent.match(/FROM:[\s\S]*?FD([^\^]+)[\s\S]*?FD([^\^]+)[\s\S]*?FD([^\^]+)[\s\S]*?FD([^\^]+)/);
            if (fromMatch) {
                content['From'] = `${fromMatch[1].trim()}\n${fromMatch[2].trim()}\n${fromMatch[3].trim()}\n${fromMatch[4].trim()}`;
            }

            // Extract To Address
            const toMatch = zplContent.match(/TO:[\s\S]*?FD([^\^]+)[\s\S]*?FD([^\^]+)[\s\S]*?FD([^\^]+)/);
            if (toMatch) {
                content['To'] = `${toMatch[1].trim()}\n${toMatch[2].trim()}\n${toMatch[3].trim()}`;
            }

            // Extract PO Number
            const poMatch = zplContent.match(/PO NO\.: ([^\^]+)/);
            if (poMatch) content['PO Number'] = poMatch[1].trim();

            // Extract SCAC
            const scacMatch = zplContent.match(/SCAC: ([^\^]+)/);
            if (scacMatch) content['SCAC'] = scacMatch[1].trim();

            // Extract PRO Number
            const proMatch = zplContent.match(/PRO NO\.: ([^\^]+)/);
            if (proMatch) content['PRO Number'] = proMatch[1].trim();

            // Extract Customer Number
            const cusMatch = zplContent.match(/CUS NO\.: ([^\^]+)/);
            if (cusMatch) content['Customer Number'] = cusMatch[1].trim();

            // Extract P/L Number
            const plMatch = zplContent.match(/P\/L NO\.: ([^\^]+)/);
            if (plMatch) content['P/L Number'] = plMatch[1].trim();

            // Extract Total Cartons
            const cartonMatch = zplContent.match(/TOTAL ORDER CARTON\(S\): ([^\^]+)/);
            if (cartonMatch) content['Total Cartons'] = cartonMatch[1].trim();

            // Extract Barcode
            const barcodeMatch = zplContent.match(/BCN,.*?FD([^\^]+)/);
            if (barcodeMatch) content['Barcode'] = barcodeMatch[1].trim();

            // Extract Pallet Info
            const palletMatch = zplContent.match(/PALLET: ([^\^]+)/);
            if (palletMatch) content['Pallet'] = palletMatch[1].trim();

            // Extract number of copies
            const copiesMatch = zplContent.match(/^PQ(\d+)/);
            if (copiesMatch) content['Copies'] = copiesMatch[1].trim();

            // Format the content as a readable string
            return Object.entries(content)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
        } catch (error) {
            console.error('Error formatting ZPL content:', error);
            return zplContent; // Return original content if formatting fails
        }
    }

    public reformatAllLogs(): void {
        try {
            const logs = (this.db as any).get('print_logs').value();
            if (logs && logs.length > 0) {
                const reformattedLogs = logs.map((log: PrintJobLog) => ({
                    ...log,
                    content: this.formatZPLContent(log.content)
                }));
                
                (this.db as any).set('print_logs', reformattedLogs).write();
                console.log('Successfully reformatted all logs');
            }
        } catch (error) {
            console.error('Error reformatting logs:', error);
        }
    }

    initialize(): void {
        try {
            // Initialize with empty array if not exists
            (this.db as any).defaults({ print_logs: [] }).write();
            
            // Reformat existing logs
            this.reformatAllLogs();
        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }

    logPrintJob(logEntry: PrintJobLog): void {
        try {
            // Format the content before storing
            const formattedLogEntry = {
                ...logEntry,
                content: this.formatZPLContent(logEntry.content)
            };
            
            (this.db as any).get('print_logs')
                .push(formattedLogEntry)
                .write();
        } catch (error) {
            console.error('Error logging print job to database:', error);
            throw error;
        }
    }

    getLogs(limit: number = 100, offset: number = 0): PrintJobLog[] {
        try {
            return (this.db as any).get('print_logs')
                .orderBy(['timestamp'], ['desc'])
                .slice(offset, offset + limit)
                .value();
        } catch (error) {
            console.error('Error retrieving print logs from database:', error);
            throw error;
        }
    }

    searchLogs(query: string): PrintJobLog[] {
        try {
            const searchPattern = query.toLowerCase();
            return (this.db as any).get('print_logs')
                .filter((log: PrintJobLog) => 
                    log.username.toLowerCase().includes(searchPattern) ||
                    log.printerName.toLowerCase().includes(searchPattern) ||
                    log.content.toLowerCase().includes(searchPattern) ||
                    (log.jobId && log.jobId.toLowerCase().includes(searchPattern))
                )
                .orderBy(['timestamp'], ['desc'])
                .value();
        } catch (error) {
            console.error('Error searching print logs:', error);
            throw error;
        }
    }

    clearOldLogs(daysToKeep: number = 30): void {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            (this.db as any).get('print_logs')
                .remove((log: PrintJobLog) => new Date(log.timestamp) < cutoffDate)
                .write();
        } catch (error) {
            console.error('Error clearing old print logs:', error);
            throw error;
        }
    }
}

export const printLogDb = new PrintLogDatabase(); 