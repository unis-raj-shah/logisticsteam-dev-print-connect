import { autoUpdater } from 'electron-updater'
const uploadUrl = process.env.VUE_APP_URL + ""; // 安装包helatest.yml所在服务器地址
import { app, protocol, BrowserWindow, Menu, globalShortcut, ipcMain, ipcRenderer, Tray, dialog } from "electron";
// 检测更新，在你想要检查更新的时候执行，renderer事件触发后的操作自行编写
export const updateHandle = (mainWindow: any) => {
    let message = {
        error: { status: -1, msg: '检测更新查询异常' },
        checking: { status: 0, msg: '正在检查更新...' },
        updateAva: { status: 1, msg: '检测到新版本' },
        updateNotAva: { status: 2, msg: '您现在使用的版本为最新版本,无需更新!' },
    }

    autoUpdater.setFeedURL(uploadUrl)
    //在下载之前将autoUpdater的autoDownload属性设置成false，通过渲染进程触发主进程事件来实现这一设置
    autoUpdater.autoDownload = false;
    // 检测更新查询异常
    autoUpdater.on('error', function (error) {
        sendUpdateMessage(mainWindow, message.error)
    })
    // 当开始检查更新的时候触发
    autoUpdater.on('checking-for-update', function () {
        sendUpdateMessage(mainWindow, message.checking)
    })
    // 当发现有可用更新的时候触发，更新包下载会自动开始
    autoUpdater.on('update-available', function (info) {
        // 主进程向renderer进程发送是否确认更新
        mainWindow.webContents.send('isUpdateNow', info)
        sendUpdateMessage(mainWindow, message.updateAva)
    })
    // 当发现版本为最新版本触发
    autoUpdater.on('update-not-available', function (info) {
        sendUpdateMessage(mainWindow, message.updateNotAva)
    })
    // 更新下载进度事件
    autoUpdater.on('download-progress', function (progressObj) {
        mainWindow.webContents.send('downloadProgress', progressObj)
    })
    // 包下载成功时触发
    autoUpdater.on('update-downloaded', function () {
        sendUpdateMessage(mainWindow, { updateDownloaded: true })
        autoUpdater.quitAndInstall() // 包下载完成后，重启当前的应用并且安装更新
        app.quit();

    })

    // 收到renderer进程确认更新
    ipcMain.on('updateNow', (e, arg) => {
        console.log('开始更新')
        autoUpdater.downloadUpdate();
    })

    ipcMain.on('checkForUpdate', () => {
        // 收到renderer进程的检查通知后，开始检查更新
        autoUpdater.checkForUpdates()
    })
}

// 通过main进程发送事件给renderer进程，提示更新信息
function sendUpdateMessage(mainWindow: any, text: any) {
    mainWindow.webContents.send('message', text);
    mainWindow.webContents.send('message', process.env.VUE_APP_ENV);
}