<template>
    <el-form :label-position="'top'" style="text-align: left" :inline="true">
        <el-form-item label="Server">
            <el-select v-model="defaultEnvironmentLabel" style="width: 200px" @change="changeEnvironment()" :disabled="isDisableSocket">
                <el-option :key="o.label" :label="o.label" :value="o.label" v-for="o in environments"></el-option>
            </el-select>
        </el-form-item>
        <el-form-item label="Platform">
            <el-select
                v-model="selPlatform"
                :loading="isPlatformLoading"
                filterable
                style="width: 200px"
                @change="platformChange"
                :disabled="isDisableSocket"
            >
                <el-option
                    :key="o.name"
                    :label="o.name"
                    :value="o.name"
                    v-for="o in platforms"
                />
            </el-select>
        </el-form-item>
        <el-form-item style="padding-top: 26px">
            <el-switch
                @change="checkFacilities"
                v-model="isConnectToSocket"
                active-text="Connect To Socket"
            />
            <div v-if="isConnectToSocket" style="margin-left: 10px">
                <el-button
                    :type="socketConnected ? 'success' : 'primary'"
                    @click="connectSocket"
                    :loading="socketConnecting"
                    style="margin-top: 5px"
                >
                    <i v-if="socketConnected" class="connected"></i>
                    {{ socketConnected ? 'Re Connect Socket' : 'Connect Socket' }}
                </el-button>
            </div>
        </el-form-item>
    </el-form>
    <el-form :label-position="'top'" style="text-align: left" :inline="true">
        <el-form-item label="Local IP">
            <el-input v-model="ip" :disabled="true" />
        </el-form-item>
        <el-form-item label="Port">
            <el-input :disabled="true" value="7444" />
        </el-form-item>
    </el-form>
</template>
<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import {
    getPlatform,
    setPlatform,
    tryInitDBIfNeed,
} from '@/db/autoSorting';
import { ElMessage, ElButton } from 'element-plus';
import {
    AUTO_SORTING_PLATFORM,
    AUTO_SORTING_PLATFORM_PROD,
    ENVIRONMENTS,
    ENVIRONMENTS_PROD,
} from '@/constants/autoSortingConstants';
import cache from '@/shared/cache';
import _ from 'lodash';
import { ipcRenderer } from 'electron';
import os from 'os';

let isConnectToSocket = ref<boolean>(false);
let isDisableSocket = ref<boolean>(false);
let selPlatform = ref<any>('');
let socketConnecting = ref<boolean>(false);
let socketConnected = ref<boolean>(false);
let platforms = ref<any>([]);
let isPlatformLoading = ref<boolean>(false);
let ip = ref<any>('');
let environments = ref<any>();
if (process.env.NODE_ENV === 'production' && process.env.VUE_APP_LSO) {
    environments.value = ENVIRONMENTS_PROD;
} else {
    environments.value = ENVIRONMENTS;
}

const cacheEnvironment = cache.getCache('autoSortingEnvironment') || {};
let defaultEnvironmentLabel = ref(cacheEnvironment.label || environments.value[0].label);

if (process.env.NODE_ENV === 'none') {
    environments.value.push({
        label: 'Local',
        requestUrl: 'http://localhost:9001',
        socketUrl: 'http://localhost:9001',
    });
}

const changeEnvironment = () => {
    let environment = _.find(environments.value, { label: defaultEnvironmentLabel.value });
    if (environment) {
        cache.setCache('autoSortingEnvironment', environment);
        isConnectToSocket.value = false;
        checkFacilities();
        socketConnecting.value = false;
        // connectSocket();
    }
};

async function checkFacilities() {
    console.log('checkFacilities');
    let socketConfig = cache.getCache('autoSortingSocketConfig') || {};
    socketConfig.isConnectToSocket = isConnectToSocket.value;
    cache.setCache('autoSortingSocketConfig', socketConfig);
    setTimeout(function () {
        if (!isConnectToSocket.value) {
            ipcRenderer.invoke('autoSortingDisConnectSocket');
        }
    }, 1000);
}

function connectSocket() {
    if (_.isEmpty(selPlatform.value)) {
        return;
    }

    let socketConfig = cache.getCache('autoSortingSocketConfig') || {};
    socketConfig.isConnectToSocket = isConnectToSocket.value;
    cache.setCache('autoSortingSocketConfig', socketConfig);

    socketConnecting.value = true;
    ipcRenderer.invoke('autoSortingConnectSocket', selPlatform.value);
}

const platformChange = async (value: string) => {
    setPlatform(value)
        .then(() => {
            console.log('setPlatform success');
        })
        .catch((err: any) => {
            ElMessage.error(`error: ${err.message}`);
        });
};

function initSocket() {
    let socketConfig = cache.getCache('autoSortingSocketConfig') || {};
    isConnectToSocket.value = socketConfig.isConnectToSocket || false;
    if (isConnectToSocket.value) {
        connectSocket();
    }
}

function getPublicIP() {
    const ifaces: any = os.networkInterfaces();

    let en0 = ref<any>('');
    if (ifaces['WLAN']) {
        let row = _.find(ifaces['WLAN'], (o: any) => _.startsWith(o.address, '192.'));
        if (row) {
            en0 = row.address;
        }
    }
    Object.keys(ifaces).forEach((ifname) => {
        let alias = 0;
        ifaces[ifname].forEach(function (iface: any) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }
            if (en0.value) return;
            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                en0 = iface.address;
                console.log(ifname + ':' + alias, iface.address);
            } else {
                // this interface has only one ipv4 adress
                console.log(ifname, iface.address);
                en0 = iface.address;
            }
            ++alias;
        });
    });
    return en0;
}

ipcRenderer.on('autoSortingSocketConnectComplete', function (event, arg) {
    socketConnecting.value = false;
    console.log('autoSortingSocketConnectComplete');
});
ipcRenderer.on('autoSortingSocketConnectSuccess', function (event, arg) {
    socketConnecting.value = false;
    socketConnected.value = true;
    console.log('autoSortingSocketConnectSuccess');
});
ipcRenderer.on('autoSortingSocketDisConnect', function (event, arg) {
    socketConnecting.value = false;
    socketConnected.value = false;
    console.log('autoSortingSocketDisConnect');
});

onMounted(async () => {
    await tryInitDBIfNeed();
    setTimeout(initSocket, 1000);
    if (process.env.NODE_ENV === 'production' && process.env.VUE_APP_LSO) {
        platforms.value = AUTO_SORTING_PLATFORM_PROD;
        isDisableSocket.value = true;
    } else {
        platforms.value = AUTO_SORTING_PLATFORM;
    }
    const platform = await getPlatform();
    if (platform) {
        selPlatform.value = platform.name;
    }
    ip.value = getPublicIP();
});
</script>
