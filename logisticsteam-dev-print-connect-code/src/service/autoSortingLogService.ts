import dayjs from 'dayjs';
import { getUserHome } from '@/db/autoSorting';
import fs from 'fs';
import path from 'path';

let userHome: any;

function getCurrentTime() {
    return dayjs().format('YYYY-MM-DD HH:mm:ss.SSS');
}

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

function appendFile(msg: any, logType: any, logName?: string) {
    const filePath = userHome + `/autoSortingLog/${logName ? logName + '/' : ''}${logType}-${dayjs().format('YYYY-MM-DD')}.txt`;
    // 检查目录是否存在，如果不存在则创建目录
    const logDir = path.dirname(filePath);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true }); // recursive 参数表示递归创建目录
    }
    fs.appendFile(filePath, msg + '\n', (err: any) => {
            if (err) {
                console.log('appendFile error', err);
            }
        },
    );
}

class AutoSortingLogService {
    info(msg: any, logName?: string, isLogFile?: boolean) {
        msg = `[info]${logName ? logName + '-' : ''}${getCurrentTime()}: ${stringify(msg)}`;
        console.log(msg);
        if (isLogFile) {
            this.logFile(msg, 'info', logName);
        }
    }

    infoLog(msg: any, logName?: string) {
        this.info(msg, logName, true);
    }

    error(msg: any, logName?: string) {
        msg = `[error]${getCurrentTime()}: ${stringify(msg)}`;
        console.log(msg);
        this.logFile(msg, 'error', logName);
    }

    logFile(msg: any, logType: any, logName?: string) {
        if (!userHome) {
            console.log('尝试获取userHome');
            getUserHome().then(r => {
                userHome = r;
                console.log('已获得userHome', userHome);
                appendFile(msg, logType, logName);
            });
            return;
        }
        appendFile(msg, logType, logName);
    }
}

const singleton = new AutoSortingLogService();

export default singleton;
