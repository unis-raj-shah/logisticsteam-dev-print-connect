<template>
    <el-container v-loading="loading" :element-loading-text="loadingText" style="height: inherit;">
        <el-aside class="sidebar" width="280px" style="position: fixed;">
            <el-menu router default-active="/autoSortingMain" style="--el-menu-bg-color:white">
                <el-menu-item index="/autoSortingMain">
                    <el-icon>
                        <Histogram />
                    </el-icon>
                    Chute Monitor</el-menu-item>
                <el-menu-item index="/autoSortingMain/waveManagement">
                    <el-icon>
                        <DataBoard />
                    </el-icon>
                    Wave Management
                </el-menu-item>
                <el-menu-item index="/autoSortingMain/autoSortingConfiguration">
                    <el-icon>
                        <PMenu />
                    </el-icon>
                    Chute Configuration
                </el-menu-item>
                <el-menu-item index="/autoSortingMain/groupConfiguration">
                    <el-icon>
                        <Grid />
                    </el-icon>
                    Group Configuration
                </el-menu-item>
                <el-menu-item index="/autoSortingMain/sortingStrategy">
                    <el-icon>
                        <DataLine />
                    </el-icon>
                    Sorting Strategy Definition
                </el-menu-item>
                <el-menu-item index="/autoSortingMain/businessStrategy">
                    <el-icon>
                        <DataAnalysis />
                    </el-icon>
                    Business Strategy Configuration
                </el-menu-item>
                <el-menu-item index="/autoSortingMain/packagesMonitor">
                    <el-icon>
                        <Monitor />
                    </el-icon>
                    Packages Monitor
                </el-menu-item>
                <el-menu-item index="/autoSortingMain/sortingSetup">
                    <el-icon>
                        <Setting />
                    </el-icon>
                    Setting
                </el-menu-item>
                <el-menu-item index="/autoSortingMain/chuteAllocationManagement">
                    <el-icon>
                        <Tickets />
                    </el-icon>
                    Chute Allocation Management
                </el-menu-item>
                <el-menu-item index="/autoSortingMain/adminTools">
                    <el-icon>
                        <Tools />
                    </el-icon>
                    Admin Tools
                </el-menu-item>
                <el-menu-item index="/">
                    <el-icon>
                        <HomeFilled />
                    </el-icon>
                    Back to Main Page
                </el-menu-item>
            </el-menu>
        </el-aside>
        <el-container style="margin-left: 280px;height: inherit;">
            <el-main>
                <router-view></router-view>
            </el-main>
        </el-container>
    </el-container>
</template>
<script lang="ts">
import { defineComponent, ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { ipcRenderer } from 'electron';
import TimerManager from '@/shared/TimerManager';
import {
    packingTimeoutAlert,
    clearLocalServerDataAndSaveWhenClosingWave,
    getSortingSetupConfig,
    tryInitDBIfNeed,
    tryInsertUserStrategyForBusinessIfNeed,
    jobRemovalDuplication,
    getPlatform,
    tryGetPlatformIfNeed,
    getWave,
} from '@/db/autoSorting';
import dayjs from 'dayjs';
import logger from '@/service/autoSortingLogService';
import { LogNameEnum, WaveStatusEnum } from '@/constants/autoSortingConstants';
import _ from 'lodash';

// declare const window: any;
export default defineComponent({
    name: 'AutoSortingMain',
    setup() {
        let accountShow = reactive<any>({
            pdf: reactive<any>({
                selectedPrinters: [],
            }),
            zpl: reactive<any>({
                selectedPrinters: [],
            }),
            availableSelectPrinters: [],
            isLight: true,
            isUnis: false,
            isSaas: false,
        });

        let loading = ref(false);
        let loadingText = ref('Data preparing, please wait.');
        let isClearLocalServerDataAndSave = false;

        function changeTheme(type: any) {
            if (type == 'dark' && !accountShow.isLight) {
                return;
            }
            if (type == 'light' && accountShow.isLight) {
                return;
            }
            accountShow.isLight = !accountShow.isLight;
            let rot;
            let link: any = document.getElementById('variationsCss');
            if (accountShow.isLight) {
                rot = './variations-white.css';
            } else {
                rot = './variations-black.css';
            }
            ipcRenderer.invoke('dark-mode');
            link.href = rot;
        }

        const timerManager = TimerManager.getInstance();

        // 在组件挂载时启动定时器
        onMounted(async () => {
            await tryInitDBIfNeed();
            await tryGetPlatformIfNeed();
            const config: any = await getSortingSetupConfig();
            if (config.timelyCheckChute) {
                timerManager.addTimer(
                    'PackingTimeoutAlert',
                    packingTimeoutAlert,
                    config.checkChuteTimerInterval * 60000
                );
            }
            const currentTime = dayjs().format('HH:mm');
            const date1 = convertToDayjs(currentTime);
            const date2 = convertToDayjs(config.waveDataFetchTime);
            if (date1.isAfter(date2)) {
                try {
                    loading.value = true;
                    await clearLocalServerDataAndSaveWhenClosingWave();
                } catch(e: any) {
                    const errorMessage = `clearLocalServerDataAndSave error ${e.message}`;
                    logger.error(errorMessage, LogNameEnum.EXCEPTION);
                }  finally {
                    loading.value = false;
                }
            }
            timerManager.addTimer('pullWave', pullWave, config.getPkgsTimerInterval * 60000);
            timerManager.addTimer('clearLocalServerDataAndSave', clearLocalServerDataAndSave, 60000);
            await tryInsertUserStrategyForBusinessIfNeed();
            await jobRemovalDuplication();
            timerManager.addTimer('aScanQueue', actionAScanQueue, 1000);
            timerManager.addTimer('packageBondedQueue', actionPackageBondedQueue, 1000);
            timerManager.addTimer('getAmazonawsPackageQueue', actionGetAmazonawsPackageQueue, 1000);
        });

        // 在组件卸载时清除定时器（如果需要）
        onBeforeUnmount(() => {
            timerManager.clearTimer('PackingTimeoutAlert');
            timerManager.clearTimer('pullWave');
            timerManager.clearTimer('clearLocalServerDataAndSave');
            timerManager.clearTimer('aScanQueue');
            timerManager.clearTimer('packageBondedQueue');
            timerManager.clearTimer('getAmazonawsPackageQueue');
        });

        async function clearLocalServerDataAndSave() {
            if (isClearLocalServerDataAndSave) return;
            try {
                isClearLocalServerDataAndSave = true;
                await tryInitDBIfNeed();
                await tryGetPlatformIfNeed();
                const currentTime = dayjs().format('HH:mm');
                const config: any = await getSortingSetupConfig();
                const date1 = convertToDayjs(currentTime);
                const date2 = convertToDayjs(config.waveDataFetchTime);
                if (date1.isAfter(date2)) {
                    const waveNo = `WAVE-${dayjs().format('YYYYMMDD')}-001`;
                    const wave = await getWave(waveNo, WaveStatusEnum.RUNNING);
                    if (_.isEmpty(wave)) {
                        loading.value = true;
                        await clearLocalServerDataAndSaveWhenClosingWave();
                    }
                }
            } catch (e: any) {
                const errorMessage = `clearLocalServerDataAndSave error ${e.message}`;
                logger.error(errorMessage, LogNameEnum.EXCEPTION);
            } finally {
                loading.value = false;
                isClearLocalServerDataAndSave = false;
            }
        }

        function convertToDayjs(timeStr: any) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return dayjs().hour(hours).minute(minutes).second(0).millisecond(0);
        }

        function pullWave() {
            ipcRenderer.invoke('pullWave');
        }

        async function actionAScanQueue() {
            const platform = await getPlatform();
            await ipcRenderer.invoke('autoSortingKeepConnectedSocket', platform.name);
            await ipcRenderer.invoke('aScanQueue');
        }

        async function actionPackageBondedQueue() {
            const platform = await getPlatform();
            await ipcRenderer.invoke('autoSortingKeepConnectedSocket', platform.name);
            await ipcRenderer.invoke('packageBondedQueue');
        }

        async function actionGetAmazonawsPackageQueue() {
            const platform = await getPlatform();
            await ipcRenderer.invoke('autoSortingKeepConnectedSocket', platform.name);
            await ipcRenderer.invoke('getAmazonawsPackageQueue');
        }

        return {
            accountShow,
            changeTheme,
            loadingText,
            loading,
        };
    },
});

ipcRenderer.on('autoSortingSocketConnectComplete', function (event, arg) {
    console.log('autoSortingSocketConnectComplete');
});
ipcRenderer.on('autoSortingSocketConnectSuccess', function (event, arg) {
    global.socketConnected = true;
    console.log('autoSortingSocketConnectSuccess');
});
ipcRenderer.on('autoSortingSocketDisConnect', function (event, arg) {
    global.socketConnected = false;
    console.log('autoSortingSocketDisConnect');
});
</script>

<style scoped>
.sidebar {
    background-color: #f0f2f5;
    height: 100%;
}

:deep(.el-menu) {
    background-color: #f0f2f5;
}

.el-menu-item.is-active {
    background-color: white;
}

body {
    font-family: 'Roboto', sans-serif;
}
</style>
