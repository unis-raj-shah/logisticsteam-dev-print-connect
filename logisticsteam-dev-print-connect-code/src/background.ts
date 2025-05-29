'use strict';

import {
    app,
    protocol,
    BrowserWindow,
    Menu,
    globalShortcut,
    ipcMain,
    Tray,
    nativeTheme,
} from 'electron';
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib';
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer';
const isDevelopment = process.env.NODE_ENV !== 'production';
import axios from './shared/axios';
import { print } from 'pdf-to-printer';
import axios1 from 'axios';

import child from 'child_process';
import path from 'path';
import fs from 'fs';
import cache from './shared/cache';
import _ from 'lodash';
import https from 'https';
import { updateHandle } from './update'; //引入
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { socketInit } from './socketClient';
import { getScaleData, initScaleConnect, changeDefaultScale } from './scaleServer';
import { autoSortingSocketInit } from './autoSortingSocketClient';
import { autoSortingMainInit, closeDB, autoSortingHttp } from '@/db/autoSorting';
import http from 'http';
import { printLogger, PrintJobLog } from './shared/printLogger';

let win: any;
let tray: any;
const USER_HOME = process.env.HOME || process.env.USERPROFILE;

let sslKeyUrl = '';
let sslCrtUrl = '';
let ssl1KeyUrl = '';
let ssl1CrtUrl = '';
let ssl2KeyUrl = '';
let ssl2CrtUrl = '';
let iconUrl = '';
let printPdfUrl = '';
let printZplUrl = '';
if (process.env.WEBPACK_DEV_SERVER_URL) {
    sslKeyUrl = './src/assets/ssl/local.item.com.key';
    sslCrtUrl = './src/assets/ssl/local.item.com.crt';
    ssl1KeyUrl = './src/assets/ssl/local.opera8.com.key';
    ssl1CrtUrl = './src/assets/ssl/local.opera8.com.crt';
    ssl2KeyUrl = './src/assets/ssl/local.logisticsteam.com.key';
    ssl2CrtUrl = './src/assets/ssl/local.logisticsteam.com.crt';
    iconUrl =
        process.env.VUE_APP_ENV == 'saas'
            ? "./src/assets/icon/Devices-Hub-Logo.png"
            : './src/assets/icon/printer.png';
    printPdfUrl = './src/assets/printTool/SumatraPDF.exe';
    printZplUrl = './src/assets/printTool/spool.exe';
} else {
    const execPath = path.dirname(path.dirname(__dirname));
    sslKeyUrl = path.resolve(execPath, 'local.item.com.key');
    sslCrtUrl = path.resolve(execPath, 'local.item.com.crt');
    ssl1KeyUrl = path.resolve(execPath, 'local.opera8.com.key');
    ssl1CrtUrl = path.resolve(execPath, 'local.opera8.com.crt');
    ssl2KeyUrl = path.resolve(execPath, 'local.logisticsteam.com.key');
    ssl2CrtUrl = path.resolve(execPath, 'local.logisticsteam.com.crt');
    iconUrl =
        process.env.VUE_APP_ENV == 'saas'
            ? path.resolve(execPath, "Devices-Hub-Logo.png")
            : path.resolve(execPath, 'printer.png');
    printPdfUrl = path.resolve(execPath, 'SumatraPDF.exe');
    printZplUrl = path.resolve(execPath, 'spool.exe');
}

const options1 = {
    key: fs.readFileSync(path.join(sslKeyUrl)),
    cert: fs.readFileSync(path.join(sslCrtUrl)),
};

const options2 = {
    key: fs.readFileSync(path.join(ssl1KeyUrl)),
    cert: fs.readFileSync(path.join(ssl1CrtUrl)),
};

const options3 = {
    key: fs.readFileSync(path.join(ssl2KeyUrl)),
    cert: fs.readFileSync(path.join(ssl2CrtUrl)),
};

// 创建http server，并传入回调函数:
const httpsServer = https.createServer(function (request: any, response: any) {
    const host = request.headers.host;
    const hostname = host.split(':')[0];
    httpConfig(request, response, hostname);
});

const httpServer = http.createServer(function (request: any, response: any) {
    const host = request.headers.host;
    const hostname = host.split(':')[0];
    httpConfig(request, response, hostname);
});

function httpConfig(request: any, response: any, serverIP: string) {
    // 回调函数接收request和response对象,
    // 获得HTTP请求的method和url:
    console.log(request.method + ': ' + request.url);
    // 将HTTP响应200写入response, 同时设置Content-Type: text/html:
    let postParams = '';
    request.on('data', (params: any) => {
        postParams += params;
    });
    request.on('end', async () => {
        let param;
        try {
            param = JSON.parse(postParams);
        } catch (error) {
            param = postParams;
        }
        const urls = request.url.split('/');
        console.log(urls);
        if (await autoSortingHttp(request, response, param)) return;
        if (
            (request.url == '/pdf/print-with-data' || request.url == '/img/print-with-data') &&
            request.method == 'POST'
        ) {
            let pdfPrinterName = '';
            if (param.printerName) {
                pdfPrinterName = param.printerName;
            }
            if (!pdfPrinterName || !param.data) {
                response.writeHead(400, {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Content-Type': 'application/json',
                });
                response.end(
                    JSON.stringify({
                        error: 'Local printer not configured or data not transmitted',
                    })
                );
            } else {
                const printFileName = uuidv4();
                const dataBuffer = Buffer.from(param.data, 'base64');
                fs.writeFile(
                    USER_HOME + '/printcontent' + printFileName + '.pdf',
                    dataBuffer,
                    function (err) {
                        if (err) {
                            console.log('web写入fail');
                            
                            // Log failed print job
                            printLogger.logPrintJob({
                                timestamp: new Date().toISOString(),
                                username: process.env.USERNAME || 'unknown',
                                printerName: pdfPrinterName,
                                content: param.data,
                                jobId: printFileName,
                                status: 'error',
                                error: err.message
                            });
                        } else {
                            print(USER_HOME + '/printcontent' + printFileName + '.pdf', {
                                sumatraPdfPath: path.join(printPdfUrl),
                                printer: pdfPrinterName,
                            }).then(
                                function (error: any) {
                                    response.writeHead(200, {
                                        'Access-Control-Allow-Origin': '*',
                                        'Access-Control-Allow-Headers': '*',
                                        'Content-Type': 'application/json',
                                    });
                                    response.end(JSON.stringify({}));
                                    
                                    // Log successful print job
                                    printLogger.logPrintJob({
                                        timestamp: new Date().toISOString(),
                                        username: process.env.USERNAME || 'unknown',
                                        printerName: pdfPrinterName,
                                        content: param.data,
                                        jobId: printFileName,
                                        status: 'success'
                                    });
                                },
                                function (error: any) {
                                    response.writeHead(400, {
                                        'Access-Control-Allow-Origin': '*',
                                        'Access-Control-Allow-Headers': '*',
                                        'Content-Type': 'application/json',
                                    });
                                    response.end(JSON.stringify({ error: error }));
                                    
                                    // Log failed print job
                                    printLogger.logPrintJob({
                                        timestamp: new Date().toISOString(),
                                        username: process.env.USERNAME || 'unknown',
                                        printerName: pdfPrinterName,
                                        content: param.data,
                                        jobId: printFileName,
                                        status: 'error',
                                        error: error.toString()
                                    });
                                }
                            );
                        }
                    }
                );
            }
        }
        // /libiao-robot/fallingParts-callback /libiao-robot/finishWave-callback
        else if (
            _.includes(
                [
                    '/libiao-robot/collectPackage-callback',
                    '/libiao-robot/fallingParts-callback',
                    '/libiao-robot/finishWave-callback',
                ],
                request.url
            ) &&
            request.method == 'POST'
        ) {
            //获取请求的header
            const headers = request.headers;
            //获取请求的Authorization
            console.log('collectPackageCallback---start', headers);
            collectPackageCallback(headers, response, request.url, 0);
            console.log('collectPackageCallback---end');
        } else if (request.url == '/zpl/print-with-data' && request.method == 'POST') {
            let zplPrinterName = '';
            if (param.printerName) {
                zplPrinterName = param.printerName;
            }
            if (!zplPrinterName || !param.data) {
                response.writeHead(400, {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Content-Type': 'application/json',
                });
                response.end(
                    JSON.stringify({
                        error: 'Local printer not configured or data not transmitted'
                    })
                );
            } else {
                win.webContents.send('message', '进去1');
                const printFileName = uuidv4();
                fs.writeFile(
                    USER_HOME + '/printcontent' + printFileName + '.txt',
                    param.data,
                    (err) => {
                        if (err) {
                            win.webContents.send('message', err);
                            console.log('web写入fail');
                            
                            // Log failed print job
                            printLogger.logPrintJob({
                                timestamp: new Date().toISOString(),
                                username: process.env.USERNAME || 'unknown',
                                printerName: zplPrinterName,
                                content: param.data,
                                jobId: printFileName,
                                status: 'error',
                                error: err.message
                            });
                        } else {
                            win.webContents.send('message', '进去2');
                            win.webContents.send(
                                'message',
                                `"${printZplUrl}" "${USER_HOME}/printcontent${printFileName}.txt" "${zplPrinterName}"`
                            );

                            child.exec(
                                `"${printZplUrl}" "${USER_HOME}/printcontent${printFileName}.txt" "${zplPrinterName}"`,
                                (err: any, stdout: any, stderr: any) => {
                                    console.log(err, stdout, stderr);
                                    if (err) {
                                        response.writeHead(400, {
                                            'Access-Control-Allow-Origin': '*',
                                            'Access-Control-Allow-Headers': '*',
                                            'Content-Type': 'application/json',
                                        });
                                        response.end(
                                            JSON.stringify({
                                                error: stdout,
                                                stdout: err,
                                                stderr: stderr,
                                            })
                                        );
                                        
                                        // Log failed print job
                                        printLogger.logPrintJob({
                                            timestamp: new Date().toISOString(),
                                            username: process.env.USERNAME || 'unknown',
                                            printerName: zplPrinterName,
                                            content: param.data,
                                            jobId: printFileName,
                                            status: 'error',
                                            error: `${stdout} ${err} ${stderr}`
                                        });
                                    } else {
                                        response.writeHead(200, {
                                            'Access-Control-Allow-Origin': '*',
                                            'Access-Control-Allow-Headers': '*',
                                            'Content-Type': 'application/json',
                                        });
                                        response.end(JSON.stringify({}));
                                        
                                        // Log successful print job
                                        printLogger.logPrintJob({
                                            timestamp: new Date().toISOString(),
                                            username: process.env.USERNAME || 'unknown',
                                            printerName: zplPrinterName,
                                            content: param.data,
                                            jobId: printFileName,
                                            status: 'success'
                                        });
                                    }
                                }
                            );
                        }
                    }
                );
            }
        } else if (urls[1] == 'getLocalDefaultPrinter' && request.method == 'POST') {
            let localDefaultPrinters: any = [];
            const printConfig = getPrintConfig();
            if (printConfig.selectedZplPrinters) {
                localDefaultPrinters = _.concat(
                    localDefaultPrinters,
                    printConfig.selectedZplPrinters
                );
            }
            if (printConfig.selectedPdfPrinters) {
                localDefaultPrinters = _.concat(
                    localDefaultPrinters,
                    printConfig.selectedPdfPrinters
                );
            }
            response.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Content-Type': 'application/json',
            });
            response.end(JSON.stringify({ localDefaultPrinters: localDefaultPrinters }));
        } else if (urls[1] == 'getLocalScaleData' && request.method == 'POST') {
            const scaleData = getScaleData();
            response.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Content-Type': 'application/json',
            });
            response.end(JSON.stringify({ data: scaleData }));
        } else if (urls[1] == 'getLocalScales' && request.method == 'POST') {
            const scales = cache.getCache('scales');
            response.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Content-Type': 'application/json',
            });
            response.end(JSON.stringify({ data: scales }));
        } else if (urls[1] == 'getPrintServer' && request.method == 'POST') {
            response.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Content-Type': 'application/json',
            });
            response.end(
                JSON.stringify({
                    isContainContextPathInUrlPrefix: true,
                    protocol: 'https',
                    serverIP: serverIP,
                    port: '7443',
                    isLocal: true,
                })
            );
        } else if (urls[1] == 'web-hook' && urls[2] == 'socket' && request.method == 'POST') {
            const messageType = urls[3];
            const id = urls[4];
            if (!messageType || !id) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ message: 'The requested url does not exist.' }));
            } else {
                response.writeHead(200, {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Content-Type': 'application/json',
                });
                const room = `${messageType}-${id}`;
                io.to(room).emit(messageType, JSON.stringify(param));
                response.end(JSON.stringify({}));
            }
        } else if (request.method == 'OPTIONS') {
            response.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Content-Type': 'application/json',
            });
            response.end(JSON.stringify({}));
        } else {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ message: 'No path' }));
        }
    });
}

async function collectPackageCallback(headers: any, response: any, url: any, index: any) {
    const env = cache.getCache('environment') || {};
    const requestUrl = env.requestUrl || 'https://wise.logisticsteam.com/v2';
    const socketConfig = cache.getCache('socketConfig') || {};
    const facilityId = socketConfig.selFacility || 'F1';
    try {
        index++;
        if (index > 10) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ message: 'fail' }));
            return;
        }
        const res = await axios1.post(
            `${requestUrl}/shared/bam${url}`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                    Authorization: headers.authorization,
                    'wise-company-id': 'ORG-1',
                    'wise-facility-id': facilityId,
                    application: headers.application,
                },
            }
        );
        if (res.data.code == 200) {
            response.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Content-Type': 'application/json',
            });
            response.end(JSON.stringify(res.data));
        } else {
            setTimeout(() => {
                console.log('collectPackageCallback1');
                collectPackageCallback(headers, response, url, index);
            }, 8000);
        }
    } catch (error) {
        setTimeout(() => {
            console.log('collectPackageCallback2');
            collectPackageCallback(headers, response, url, index);
        }, 8000);
    }
}

function getPrintConfig() {
    let printConfig = cache.getCache('printConfig');
    if (_.isEmpty(printConfig)) {
        printConfig = fs.readFileSync(USER_HOME + '/printConfig.json', 'utf8');
    }
    return printConfig;
}
const io = new Server(httpServer, {
    cors: {
        origin: '*',
    },
});
io.on('connection', (socket) => {
    socket.on('join-room-with-type', (type, _, roomId) => {
        const room = `${type}-${roomId}`;
        socket.join(room);
        console.log(`join-room-with-type: type=${type}roomId=${roomId}`);
    });
    socket.on('leave-room-with-type', (type, _, roomId) => {
        const room = `${type}-${roomId}`;
        socket.leave(room);
        console.log(`leave-room-with-type: type=${type}roomId=${roomId}`);
    });
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    httpServer.listen(7444);
    httpsServer.addContext('local.item.com', options1);
    httpsServer.addContext('local.opera8.com', options2);
    httpsServer.addContext('local.logisticsteam.com', options3);
    io.listen(4000);
    httpsServer.listen(7443, () => {
        console.log('Server listening on port 7443...');
    });
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (win) {
            win.show();
        }
    });
}

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { secure: true, standard: true } },
]);

async function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            // Use pluginOptions.nodeIntegration, leave this alone
            // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
            // nodeIntegration: process.env
            //   .ELECTRON_NODE_INTEGRATION as unknown as boolean,
            nodeIntegration: true,
            contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
            webSecurity: true,
        },
        icon: path.join(iconUrl),
    });

    win.maximize();

    globalShortcut.register('CommandOrControl+f12', () => {
        win.webContents.openDevTools();
    });

    if (process.env.WEBPACK_DEV_SERVER_URL) {
        // Load the url of the dev server if in development mode
        await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
        if (!process.env.IS_TEST) win.webContents.openDevTools();
    } else {
        createProtocol('app');
        // Load the index.html when not in development
        win.loadURL('app://./index.html');
    }

    updateHandle(win);
    socketInit(win, ipcMain);
    console.log('autoSortingInit');
    await autoSortingSocketInit(win, ipcMain);
    autoSortingMainInit(win, ipcMain);
    console.log('autoSortingInit end');
    win.webContents.send('message', process.env.VUE_APP_ENV);

    win.on('close', (event: any) => {
        // 截获 close 默认行为
        event.preventDefault();
        // 点击关闭时触发close事件，我们按照之前的思路在关闭时，隐藏窗口，隐藏任务栏窗口
        win.hide();
        win.setSkipTaskbar(true);

    });

    // 新建托盘
    tray = new Tray(path.join(iconUrl));
    // 托盘名称
    const toolTip = process.env.VUE_APP_LSO ? 'Local Connect' : (process.env.VUE_APP_ENV == 'saas' ? "Item Devices Hub" : 'Local Print Connect');
    tray.setToolTip(toolTip);
    // 托盘菜单
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'show',
            click: () => {
                win.show();
            },
        },
        {
            label: 'check update',
            click: () => {
                //检测更新
                win.show();
                win.webContents.send('message', { checkUpdateVersion: true });
            },
        },
        {
            label: 'exit',
            click: async () => {
                await closeDB();
                win.destroy();
            },
        },
        {
            type: 'checkbox',
            label: 'autorun',
            checked: app.getLoginItemSettings().openAtLogin,
            click: function () {
                if (!app.isPackaged) {
                    app.setLoginItemSettings({
                        openAtLogin: !app.getLoginItemSettings().openAtLogin,
                        path: process.execPath,
                    });
                } else {
                    app.setLoginItemSettings({
                        openAtLogin: !app.getLoginItemSettings().openAtLogin,
                    });
                }
                console.log(app.getLoginItemSettings().openAtLogin);
                console.log(!app.isPackaged);
            },
        },
    ]);
    // 载入托盘菜单
    tray.setContextMenu(contextMenu);
    // 双击触发
    tray.on('double-click', () => {
        // 双击通知区图标实现应用的显示或隐藏
        win.isVisible() ? win.hide() : win.show();
        win.isVisible() ? win.setSkipTaskbar(false) : win.setSkipTaskbar(true);
    });
}

ipcMain.handle('request', async (_, axios_request) => {
    const result = await axios(axios_request);
    return { data: result.data, status: result.status };
});

ipcMain.handle('getUserHome', async (_) => {
    cache.setCache('userHome', USER_HOME);
    return USER_HOME;
});

ipcMain.handle('dark-mode', async (_) => {
    console.log(nativeTheme.shouldUseDarkColors);
    if (nativeTheme.shouldUseDarkColors) {
        nativeTheme.themeSource = 'light';
    } else {
        nativeTheme.themeSource = 'dark';
    }
});

ipcMain.handle('getPrinters', async (_) => {
    cache.setCache('printers', win.webContents.getPrinters());
    return win.webContents.getPrinters();
});

ipcMain.on('refershHomePage', (e, arg) => {
    win.webContents.send('message', process.env.VUE_APP_ENV);
});

ipcMain.handle('setDefaultScale', (path: any) => {
    changeDefaultScale(path);
});

app.on('window-all-closed', () => {
    app.quit();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
    if (isDevelopment && !process.env.IS_TEST) {
        // Install Vue Devtools
        try {
            await installExtension(VUEJS3_DEVTOOLS);
        } catch (e: any) {
            console.error('Vue Devtools failed to install:', e.toString());
        }
    }
    Menu.setApplicationMenu(null);
    createWindow();
    initScaleConnect();
});

app.setLoginItemSettings({
    openAtLogin: true, // Boolean 在登录时启动应用
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
    if (process.platform === 'win32') {
        process.on('message', (data) => {
            if (data === 'graceful-exit') {
                app.quit();
            }
        });
    } else {
        process.on('SIGTERM', () => {
            app.quit();
        });
    }
}
