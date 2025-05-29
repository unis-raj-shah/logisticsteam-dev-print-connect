import { io } from 'socket.io-client';
import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
    saveWave,
    releaseChute,
    recordExceptionLog,
    testTransaction,
    testTransaction2,
    testTransaction3,
} from '@/db/autoSorting';
import logger from '@/service/autoSortingLogService';
import {LogNameEnum, LogTypeEnum, WISE_HEADERS, WISE_HEADERS_PROD} from '@/constants/autoSortingConstants';
import util from '@/service/utilService';
import cache from '@/shared/cache';

// 获取Electron应用的安装目录
const appPath = path.dirname(process.execPath);
const birthtime = fs.statSync(appPath).birthtime;
let time = birthtime ? new Date(birthtime).toLocaleString() : new Date().toLocaleString();
console.log('Installation date:', time);
const hostname = os.hostname();
console.log('Hostname:', hostname);
const clientId = `${hostname}-${time}`;
console.log('ClientId:', clientId);

const wiseCompanyId = 'ORG-1';
const wiseFacilityId = 'F1';
const messageType = 'auto-sorting-message';
let header: any;
if (process.env.NODE_ENV === 'production' && process.env.VUE_APP_LSO) {
    header = WISE_HEADERS_PROD.lso;
} else if (process.env.VUE_APP_LSO) {
    header = WISE_HEADERS.saas;
} else {
    header = WISE_HEADERS.wise;
}

function socketConnect(url: string, facility: string, mainWindow: any) {
    console.log(`Auto Sorting Start connected to ${url} | ${facility}...`);
    let isFirstConnect = true;
    const list = _.split(facility, '_');
    let companyId = wiseCompanyId;
    let facilityId = wiseFacilityId;
    if (_.size(list) == 2) {
        facilityId = list[1];
    } else if (_.size(list) == 3) {
        companyId = list[1];
        facilityId = list[1] + '_' + list[2];
    }
    console.log('Socket Connect company:', companyId);
    console.log('Socket Connect facility:', facilityId);
    console.log('Socket Connect Authorization:', header.Authorization);
    const socket = io(url, {
        autoConnect: true,
        //reconnection: true,
        path: '/socket.io/',
        transports: ['websocket'],
        auth: {
            token: header.Authorization,
            'wise-company-id': companyId,
            'wise-facility-id': facilityId,
        },
    });

    socket.on('connect', () => {
        global.socketConnected = true;
        console.log(`Auto Sorting Connected to ${url} | ${facility} success!`);
        socket.emit('subscribe-message', messageType, facility, clientId);
        mainWindow.webContents.send('autoSortingSocketConnectSuccess');
    });

    socket.on('disconnect', () => {
        global.socketConnected = false;
        console.log(`Auto Sorting Disconnected from the server ${url} | ${facility}. Retrying...`);
        mainWindow.webContents.send('autoSortingSocketDisConnect');
    });

    socket.on('error', (error: any) => {
        console.error(`Auto Sorting Socket ${url} | ${facility} error:`, error);
        mainWindow.webContents.send('autoSortingSocketConnectComplete');
    });

    socket.on('connect_error', (error) => {
        console.error(`Auto Sorting Socket 连接错误 ${url} | ${facility} error:`, error);
        if (!isFirstConnect) return;
        isFirstConnect = false;
        socket.disconnect();
        mainWindow.webContents.send('autoSortingSocketConnectComplete');
        mainWindow.webContents.send('autoSortingSocketDisConnect');
    });

    socket.on('reconnect', () => {
        console.log(`Auto Sorting Reconnected to the server ${url} | ${facility}!`);
    });

    socket.on('auto-sorting-message', async (message: any, callback: any) => {
            message = message || {};
            logger.infoLog(`Auto Sorting Received message from server: ${JSON.stringify(message)}`, LogNameEnum.SOCKET);
            let data = message.data || {};
            try {
                let res = {
                    status: false,
                    message: '',
                    data: {},
                };
                switch (data.action) {
                    case 'postWaveData':
                        try {
                            let waveId = await saveWave(data);
                            res.status = true;
                            res.message = 'success';
                            res.data = { waveId };
                        } catch (error: any) {
                            res.message = error.message;
                            logger.error(`postWaveData error:${error.message}`, LogNameEnum.SOCKET);
                            await recordExceptionLog({
                                logType: LogTypeEnum.POST_WAVE_DATA,
                                logName: LogNameEnum.SOCKET,
                                message: error.message,
                                data: '',
                            });
                        }
                        break;
                    case 'releaseChute':
                        try {
                            await releaseChute(data, true);
                            res.status = true;
                            res.message = 'success';
                            res.data = { data };
                        } catch (error: any) {
                            res.message = error.message;
                            logger.error(`releaseChute error:${error.message}`, LogNameEnum.SOCKET);
                            await recordExceptionLog({
                                logType: LogTypeEnum.RELEASE_CHUTE,
                                logName: LogNameEnum.SOCKET,
                                message: error.message,
                                data: data,
                            });
                        }
                        break;
                    case 'testTransaction':
                        try {
                            await testTransaction(data);
                            res.status = true;
                            res.message = 'success';
                            res.data = { data };
                        } catch (error: any) {
                            res.message = error.message;
                            logger.error(`${data.action} error:${error.message}`, LogNameEnum.SOCKET);
                        }
                        break;
                    case 'testTransaction2':
                        try {
                            await testTransaction2(data);
                            res.status = true;
                            res.message = 'success';
                            res.data = { data };
                        } catch (error: any) {
                            res.message = error.message;
                            logger.error(`${data.action} error:${error.message}`, LogNameEnum.SOCKET);
                        }
                        break;
                    case 'testTransaction3':
                        try {
                            await testTransaction3(data);
                            res.status = true;
                            res.message = 'success';
                            res.data = { data };
                        } catch (error: any) {
                            res.message = error.message;
                            logger.error(`${data.action} error:${error.message}`, LogNameEnum.SOCKET);
                        }
                        break;
                    default:
                        res.message = `Invalid action ${data.action}`;
                        logger.error(`Invalid action ${data.action}`, LogNameEnum.SOCKET);
                }
                if (callback) {
                    callback(res);
                }
                logger.infoLog(`get response: ${JSON.stringify(res)}`, LogNameEnum.SOCKET);
            } catch
                (error: any) {
                logger.error(`DealClientMessage Error: ${error}`, LogNameEnum.SOCKET);
                await recordExceptionLog({
                    logType: LogTypeEnum.AUTO_SORTING_MESSAGE,
                    logName: LogNameEnum.SOCKET,
                    message: error.message,
                    data: '',
                });
                if (callback) {
                    callback({
                        status: false,
                        message: error,
                    });
                }
            }
        },
    );
    return socket;
}

let isConnecting = false;
export const autoSortingSocketInit = (mainWindow: any, ipcMain: any) => {
    ipcMain.handle('autoSortingConnectSocket', async (e: any, facility: string) => {
        if (!facility) {
            console.log('facility can not be empty.');
            return;
        }
        console.log(facility.toString());
        // 如果正在连接，则直接返回
        if (isConnecting) {
            console.log('Already connecting...');
            return;
        }
        try {
            isConnecting = true;

            if (!_.isEmpty(global.currentSocket) && global.currentSocket.connected) {
                global.currentSocket.disconnect();
            }
            const env = cache.getCache('autoSortingEnvironment') || {};
            const socketUrl = env.socketUrl || 'wss://wise.logisticsteam.com';
            global.currentSocket = socketConnect(socketUrl, facility, mainWindow);
            // 3秒后再退出，避免频繁连接
            await util.waitBySeconds(3);
        } catch (error) {
            console.error('Error connecting:', error);
        } finally {
            // 连接完成或出错后，重置连接标志
            isConnecting = false;
        }
    });

    ipcMain.handle('autoSortingDisConnectSocket', () => {
        if (!_.isEmpty(global.currentSocket) && global.currentSocket.connected) {
            global.currentSocket.disconnect();
        }
    });

    ipcMain.handle('autoSortingKeepConnectedSocket', async (e: any, facility: string) => {
        if (!facility) {
            console.log('facility can not be empty.');
            return;
        }
        console.log(facility.toString());
        // 如果正在连接，则直接返回
        if (isConnecting) {
            console.log('Already connecting...');
            return;
        }
        try {
            if (!_.isEmpty(global.currentSocket) && global.currentSocket.connected) {
                console.log('Already connected...');
                return;
            }
            isConnecting = true;
            const env = cache.getCache('autoSortingEnvironment') || {};
            const socketUrl = env.socketUrl || 'wss://wise.logisticsteam.com';
            global.currentSocket = socketConnect(socketUrl, facility, mainWindow);
            // 3秒后再退出，避免频繁连接
            await util.waitBySeconds(3);
        } catch (error) {
            console.error('Error connecting:', error);
        } finally {
            // 连接完成或出错后，重置连接标志
            isConnecting = false;
        }
    });
};
