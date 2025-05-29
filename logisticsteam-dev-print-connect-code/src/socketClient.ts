import { io } from "socket.io-client";
import _ from "lodash";
import axios from "axios";
import path from "path";
import fs from "fs";
import os from "os";
import moment from "moment";
import cache from "./shared/cache";

const net = require('net');

// 获取Electron应用的安装目录
const appPath = path.dirname(process.execPath);
const birthtime = fs.statSync(appPath).birthtime;
let time = birthtime ? new Date(birthtime).toLocaleString() : new Date().toLocaleString();
console.log('Installation date:', time);
const hostname = os.hostname();
console.log('Hostname:', hostname);
const clientId = `${hostname}-${time}`;
console.log('ClientId:', clientId);
const USER_HOME = process.env.HOME || process.env.USERPROFILE;

const authorization = "Basic d2lzZWJvdDp1aW9wNzg5MA==";
const wiseCompanyId = "ORG-1";
const wiseFacilityId = "F1";

function socketConnect(url: string, facility: string, mainWindow: any) {
    console.log(`Start connected to ${url} | ${facility}...`);
    mainWindow.webContents.send('installationDate', time);
    const socket = io(url, {
        autoConnect: true,
        //reconnection: true,
        path: "/socket.io/",
        transports: ["websocket"],
        auth: {
            "token": authorization,
            "wise-company-id": wiseCompanyId,
            "wise-facility-id": wiseFacilityId,
        }
    });

    socket.on('connect', () => {
        console.log(`Connected to ${url} | ${facility} success!`);
        socket.emit("subscribe-message", "client-message", facility, clientId);
        mainWindow.webContents.send('SocketConnectSuccess', url, facility);
    });

    socket.on('disconnect', () => {
        console.log(`Disconnected from the server ${url} | ${facility}. Retrying...`);
        mainWindow.webContents.send('SocketDisConnect', url, facility);
    });

    socket.on('error', (error: any) => {
        console.error(`Socket ${url} | ${facility} error:`, error);
        mainWindow.webContents.send('SocketConnectComplete');
    });

    socket.on('reconnect', () => {
        console.log(`Reconnected to the server ${url} | ${facility}!`);
    });

    socket.on('client-message', async (message: any, callback: any) => {
        message = message || {};
        console.log(`Received message from server: ${JSON.stringify(message)}`);
        printSocketLog(message);
        try {
            const res = await dealClientMessage(socket, message);
            if (callback) {
                callback(res);
            }
            console.log(`get response: ${JSON.stringify(res)}`);
        } catch (error) {
            console.log(`DealClientMessage Error: ${error}`);
            if (callback) {
                callback({
                    status: false,
                    message: error
                });
            }
        }
    });

    socket.on('client-telnet', async (message: any, callback: any) => {
        message = message || {};
        console.log(`Received telnet message from server: ${JSON.stringify(message)}`);
        let url = message.url; // http://192.168.199.06:2000/api/postwavedata
        let ip = url.split(":")[1].replace("//", "");
        let port = url.split(":")[2] ? url.split(":")[2].split("/")[0] : 80;
        const client = net.createConnection({ port: port, host: ip }, () => {
            console.log('connected to server!');
            callback({
                status: true,
                clientId: clientId
            });
        });
        client.on('data', (data: any) => {
            console.log(data.toString());
            client.end();
        });
        client.on('end', () => {
            console.log('disconnected from server');
        });
        client.on('error', (err: any) => {
            callback({
                status: false,
                message: err
            });
            console.error('Connection error:', err);
        });
    });
    return socket;
}

async function dealClientMessage(socket: any, param: any) {
    if (_.isEmpty(param)) return;
    if (!param.url) return;

    let method = param.method || "post";
    method = method.toLowerCase();
    const config = { timeout: 20000, headers: {} };
    if (param.header) {
        config.headers = param.header;
    }
    // @ts-ignore
    const res = await axios[method](param.url, param.data || {}, config);
    printSocketLog(res.data);
    return res.data;
}

function printSocketLog(message: string) {
    const folderPath = USER_HOME + `/printSocketLog`;
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
        console.log('文件夹创建成功！');
    } else {
        console.log('文件夹已存在，无需创建。');
    }
    let fileName = folderPath + `/printSocketLog_${moment().format('YYYY-MM-DD')}.txt`;
    fs.appendFile(fileName, new Date().toLocaleString() + ": " + `Response message to server: ${JSON.stringify(message)}` + "\n", (err) => {
        if (err) {
            console.log(err);
        }
    });
}

async function getFacilities() {
    let env = cache.getCache('environment') || {};
    let requestUrl = env.requestUrl || 'https://wise.logisticsteam.com/v2';
    const res = await axios.post(`${requestUrl}/shared/fd-app/facility/search`, {}, {
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Authorization': authorization,
            'wise-company-id': wiseCompanyId,
            'wise-facility-id': wiseFacilityId
        }
    });

    return _.orderBy(res.data, ["accessUrl"], ["asc"]);
}

let currentSocket: any;
export const socketInit = (mainWindow: any, ipcMain: any) => {

    ipcMain.handle('getFacilities', async () => {
        return await getFacilities();
    });

    ipcMain.handle('ConnectSocket', (e: any, facility: string) => {
        if (!facility) {
            console.log("facility can not be empty.");
            return;
        }
        console.log(facility.toString());
        if (currentSocket != null && currentSocket.connected) {
            currentSocket.disconnect();
        }
        let env = cache.getCache('environment') || {};
        let socketUrl = env.socketUrl || 'wss://wise.logisticsteam.com';
        currentSocket = socketConnect(socketUrl, facility, mainWindow);
    });

    ipcMain.handle('DisConnectSocket', () => {
        if (currentSocket != null && currentSocket.connected) {
            currentSocket.disconnect();
        }
    });
};
