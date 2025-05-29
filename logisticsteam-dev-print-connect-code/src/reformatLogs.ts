import fs from 'fs';
import path from 'path';
import os from 'os';

function formatZPLContent(zplContent: string): string {
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

        // Format the content as a readable string
        return Object.entries(content)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
    } catch (error) {
        console.error('Error formatting ZPL content:', error);
        return zplContent; // Return original content if formatting fails
    }
}

function reformatLogs() {
    try {
        const logPath = path.join(os.homedir(), 'print_logs.json');
        const backupPath = path.join(os.homedir(), 'print_logs.backup.json');

        // Read the current logs
        const logData = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        
        // Format each log entry
        const formattedLogs = logData.print_logs.map((log: any) => ({
            ...log,
            content: formatZPLContent(log.content)
        }));

        // Write the formatted logs back to the file
        fs.writeFileSync(logPath, JSON.stringify({ print_logs: formattedLogs }, null, 2));
        console.log('Successfully reformatted all logs');
    } catch (error) {
        console.error('Error reformatting logs:', error);
    }
}

// Run the reformatting
reformatLogs(); 