<template>
    <el-container class="common-layout">
        <el-header style="height: auto">
            <el-row style="justify-content:space-around;">
                <el-statistic title="Idle Chute Count" :value="stats.idleChuteCount" />
                <el-statistic title="Working Chute Count" :value="stats.workingChuteCount" />
                <el-statistic title="Require Collect Chute Count(Not Full)"
                    :value="stats.requireCollectChuteNotFullCount" />
                <el-statistic title="Require Collect Chute Count(Full)" :value="stats.requireCollectChuteFullCount" />
            </el-row>
        </el-header>
        <el-main class="chute-container">
            <div class="colorDemo">
                <el-row class="min-height-50">
                    <span style="font-weight: 600;margin-right: 10px;">Chute No:</span>
                    <el-col :span="5" class="flex">
                        <div class="width-220">
                            <el-autocomplete v-model="searchData.chuteNo" :fetch-suggestions="getChuteOptions"
                                placeholder="Please input chute no" @select="selectChuteNo" clearable>
                                <template #default="{ item }">
                                    {{ item }}
                                </template>
                            </el-autocomplete>
                        </div>
                    </el-col>
                    <span style="font-weight: 600;margin-inline: 10px;">Group:</span>
                    <el-select v-model="searchData.groupId" placeholder="Please select group" clearable>
                        <el-option v-for="group in groups" :key="group.id" :label="group.groupName" :value="group.id" />
                    </el-select>
                </el-row>
                <el-row class="min-height-50">
                    <span style="font-weight: 600;margin-right: 10px;">Chute Type: </span>
                    <el-col :span="5" class="flex" v-for="item in chuteTypes" :key="item">
                        <label class="custom-checkbox">
                            <input type="checkbox" class="checkbox-input" v-model="searchData.checkChuteTypeMap[item]">
                            <span :class="'checkbox-mark ' + item"></span>
                            {{ item }}
                        </label>
                    </el-col>
                </el-row>
                <el-row class="min-height-50">
                    <span style="font-weight: 600;margin-right: 10px;">Work Status: </span>
                    <el-col :span="5" class="flex" v-for="item in workStatuses" :key="item">
                        <label class="custom-checkbox">
                            <input type="checkbox" class="checkbox-input" v-model="searchData.checkWorkStatusMap[item]">
                            <span :class="'checkbox-mark ' + item"></span>
                            {{ ChuteRevealWorkStatusEnum[item] }}
                        </label>
                    </el-col>
                    <div class="fill-white">
                        <el-button style="float: right" type="primary" @click="search">
                            Search
                        </el-button>
                    </div>
                </el-row>
            </div>
            <div id="infinite-list-wrapper" class="infinite-list-wrapper">
                <template v-for="chute in lazyChutes" :key="chute.id">
                    <el-tooltip placement="top" effect="light" append-to-body>
                        <template #content>
                            <template v-if="!_.isEmpty(chute.routeName)">
                                <template v-if="chute.chuteType === ChuteTypeEnum.ROUTE">
                                    <p class="text-center bold size-16 terminal-color">{{ terminalMap[chute.jobId] }}</p>
                                    <p class="text-center bold size-16 route-color">
                                        <u-quick-copy :copy-string="chute.routeName" />
                                        {{ chute.routeName }}
                                    </p>
                                </template>
                                <template v-else>
                                    <p class="text-center bold size-16 terminal-color">{{ chute.routeName }}</p>
                                </template>
                                <p class="text-center bold size-30">
                                    {{ chuteDetailCount[chute.chuteNo] ? chuteDetailCount[chute.chuteNo].qty : 0 }}
                                </p>
                            </template>
                            <template v-else>
                                <p class="text-center bold size-16 terminal-color">Not Occupied</p>
                            </template>
                        </template>
                        <el-card :class="getChuteClass(chute)">
                            <div>{{ chute.chuteNo }}</div>
                        </el-card>
                    </el-tooltip>
                </template>
                <p v-show="isInfiniteScroll" style="display: flex;flex-direction: row;height: 25px;justify-items: center">
                    <img src='@/assets/loading-spinner-grey.gif' />
                    <span>&nbsp;LOADING...</span>
                </p>
            </div>
        </el-main>
    </el-container>
</template>
<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import {
    getChuteListByChuteNoLike,
    getChuteWorkList,
    getGroupList,
    getPlatform,
    getTerminalMapByJobIds,
    queryChuteDetailMap,
    tryInitDBIfNeed,
} from '@/db/autoSorting';
import { ElMessage } from 'element-plus';
import { ChuteRevealWorkStatusEnum, ChuteTypeEnum, ChuteWorkStatusEnum } from '@/constants/autoSortingConstants';
import _ from 'lodash';
import cache from '@/shared/cache';
import { ipcRenderer } from 'electron';
import UQuickCopy from '@/components/u-quick-copy/index.vue';

let stats = ref<any>({
    idleChuteCount: 0,
    workingChuteCount: 0,
    requireCollectChuteNotFullCount: 0,
    requireCollectChuteFullCount: 0,
});
let isRequesting = ref(false);
let chuteKeyName = ref('');
let timerId = ref<any>(null);
let chuteDetailCount = ref<any>({});
const chuteTypes = [ChuteTypeEnum.ROUTE, ChuteTypeEnum.TERMINAL]; //ChuteTypeEnum.EXCEPTION
const workStatuses = [
    ChuteWorkStatusEnum.IDLE,
    ChuteWorkStatusEnum.ASSIGNED,
    ChuteWorkStatusEnum.COLLECT_PACKAGE,
    ChuteWorkStatusEnum.FULL_PACKAGE,
];
const searchData = ref<any>({
    checkChuteTypeMap: {},
    checkWorkStatusMap: {},
});
const groups = ref<any>([]);
let refreshParams: any = {
    checkChuteTypeMap: {},
    checkWorkStatusMap: {},
    currentLimit: 0,
};
let isInfiniteScroll = ref<boolean>(true);
const lazyChutes = ref<any>([]);
const terminalMap = ref<any>({});

const refreshData = async () => {
    if (isRequesting.value) return;
    console.log('refreshData start');
    const startTime = performance.now();
    try {
        isRequesting.value = true;
        const chuteWorkList = await getChuteWorkList(null, null, '', '', -1, [ChuteTypeEnum.DROP_OFF, ChuteTypeEnum.EXCEPTION]);
        stats.value.idleChuteCount = _.size(_.filter(chuteWorkList, (item: any) => item.workStatus === ChuteWorkStatusEnum.IDLE));
        stats.value.workingChuteCount = _.size(_.filter(chuteWorkList, (item: any) => item.workStatus === ChuteWorkStatusEnum.ASSIGNED));
        stats.value.requireCollectChuteNotFullCount = _.size(_.filter(chuteWorkList, (item: any) => item.workStatus === ChuteWorkStatusEnum.COLLECT_PACKAGE));
        stats.value.requireCollectChuteFullCount = _.size(_.filter(chuteWorkList, (item: any) => item.workStatus === ChuteWorkStatusEnum.FULL_PACKAGE));
        lazyChutes.value = await getChuteWorkList(
            refreshParams.checkChuteTypeMap,
            refreshParams.checkWorkStatusMap,
            refreshParams.chuteNo,
            refreshParams.groupId,
            -1,
            [ChuteTypeEnum.DROP_OFF, ChuteTypeEnum.EXCEPTION]
        );
        if (!_.isEmpty(lazyChutes.value)) {
            const jobIds = _.compact(_.map(_.filter(lazyChutes.value, (chute: any) => chute.chuteType === ChuteTypeEnum.ROUTE), "jobId"));
            terminalMap.value = await getTerminalMapByJobIds(jobIds);
        }
    } catch (err: any) {
        ElMessage.error(err);
    } finally {
        isRequesting.value = false;
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        console.log('refreshData execution time:', executionTime, 'ms');
    }
};

const refreshChuteDetailData = async () => {
    const chuteDetailMap = await queryChuteDetailMap();
    chuteDetailCount.value = _.keyBy(chuteDetailMap, 'chuteNo');
    console.log('chuteDetailCount', chuteDetailCount.value);
};

onMounted(async () => {
    try {
        await tryInitDBIfNeed();
        const platform = await getPlatform();
        if (platform && platform.name) {
            let socketConfig = cache.getCache('autoSortingSocketConfig') || {};
            if (socketConfig.isConnectToSocket) {
                ipcRenderer.invoke('autoSortingConnectSocket', platform.name);
            }
        }
        chuteKeyName.value = platform.chuteKeyName + ':' || '';
    } catch (e) {
        console.error('getPlatform Error', e);
    }
    groups.value = await getGroupList();
    await refreshChuteDetailData();
    await refreshData();
    isInfiniteScroll.value = false;
    timerId.value = setInterval(async () => {
        await refreshChuteDetailData();
        await refreshData();
    }, 5000);
});

onBeforeUnmount(() => {
    console.log('onBeforeUnmount');
    clearInterval(timerId.value);
});

const getChuteClass = (chute: any) => {
    return `chuteCard ${chute.chuteType} ${chute.workStatus}`;
};

const getChuteOptions = async (query: string, cb: any) => {
    try {
        const res = await getChuteListByChuteNoLike({ chuteNo: query, chuteTypeNotIn: [ChuteTypeEnum.DROP_OFF, ChuteTypeEnum.EXCEPTION] });
        cb(_.map(res, 'chuteNo') || []);
    } catch (err: any) {
        ElMessage.error(`error: ${err.message}`);
    }
};

const selectChuteNo = (value: string) => {
    searchData.value.chuteNo = value;
};

const search = async () => {
    (document.getElementById('infinite-list-wrapper') as HTMLDivElement).scrollTo({ top: 0, behavior: 'smooth' });
    refreshParams = JSON.parse(JSON.stringify(searchData.value));
    await refreshData();
};
</script>
<style scoped>
.flex {
    display: flex;
}

.chuteCard {
    display: flex;
    justify-content: center; /* 水平居中 */
    align-items: center; /* 垂直居中 */
    height: 50px;
    width: 50px;
}

.colorDemo {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 10px;
    margin-bottom: 10px;
}

.demoBox {
    width: 18px;
    height: 18px;
    box-sizing: content-box;
    margin-right: 5px;
}

.demoBox2 {
    width: 21px;
    height: 21px;
    box-sizing: content-box;
    margin-right: 5px;
}

.doneStatus {
    color: #67c23a;
}

.inTransitStatus {
    color: #409eff;
}

.chute-container {
    text-align: left;
    flex: 1;
    display: flex;
    flex-direction: column;
}

.custom-checkbox {
    display: inline-block;
    position: relative;
    padding-left: 30px;
    margin-bottom: 12px;
    cursor: pointer;
    font-size: 16px;
    user-select: none;
}

.custom-checkbox .checkbox-input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
}

.checkbox-mark {
    position: absolute;
    top: 0;
    left: 0;
    height: 20px;
    width: 20px;
    background-color: #fff;
    border: 2px solid #ccc;
    border-radius: 3px;
}

.custom-checkbox:hover .checkbox-input~.checkbox-mark {
    background-color: #f0f0f0;
}

.custom-checkbox .checkbox-input:checked~.checkbox-mark:after {
    content: "";
    position: absolute;
    display: block;
    left: 6px;
    top: 2px;
    width: 5px;
    height: 10px;
    border: solid black;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
}

/* 可选：为禁用状态添加特殊样式 */
.custom-checkbox.disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

.custom-checkbox.disabled .checkbox-input {
    pointer-events: none;
}

/* 正常状态 */
.checkbox-mark.Route {
    border-color: #00C853;
}

.Route {
    border: 2px solid #00C853;
}

/* 异常状态 */
.checkbox-mark.Exception {
    border-color: #FF3D00;
}

.Exception {
    border: 2px solid #FF3D00;
}

/* Tem状态 */
.checkbox-mark.Terminal {
    border-color: #9C27B0;
}

.Terminal {
    border: 2px solid #9C27B0;
}

/* 禁用状态 */
.checkbox-mark.disabled {
    border-color: #757575;
}

.disabledChute {
    border: 2px solid #757575;
    /* background-color: #b1b3b8; */
}

.Idle {
    background-color: #BDBDBD;
}

.checkbox-mark.Idle {
    border-color: #BDBDBD;
}

.custom-checkbox .checkbox-input~.checkbox-mark.Idle {
    background-color: #BDBDBD;
}

.custom-checkbox .checkbox-input:checked~.checkbox-mark.Idle {
    background-color: #BDBDBD;
}


.Assigned {
    background-color: #2196F3;
}

.checkbox-mark.Assigned {
    border-color: #2196F3;
}

.custom-checkbox .checkbox-input~.checkbox-mark.Assigned {
    background-color: #2196F3;
}

.custom-checkbox .checkbox-input:checked~.checkbox-mark.Assigned {
    background-color: #2196F3;
}


.Collect.Package {
    background-color: #FFC107;
}

.checkbox-mark.Collect.Package {
    border-color: #FFC107;
}

.custom-checkbox .checkbox-input~.checkbox-mark.Collect.Package {
    background-color: #FFC107;
}

.custom-checkbox .checkbox-input:checked~.checkbox-mark.Collect.Package {
    background-color: #FFC107;
}

.Full.Package {
    background-color: #4CAF50;
}

.checkbox-mark.Full.Package {
    border-color: #4CAF50;
}

.custom-checkbox .checkbox-input~.checkbox-mark.Full.Package {
    background-color: #4CAF50;
}

.custom-checkbox .checkbox-input:checked~.checkbox-mark.Full.Package {
    background-color: #4CAF50;
}

.common-layout {
    --el-font-size-extra-small: 20px;
}

.el-statistic {
    --el-statistic-title-font-weight: 600;
}

.el-select {
    --el-select-width: 220px;
}

.el-autocomplete {
    --el-autocomplete-width: 220px;
}

.min-height-50 {
    min-height: 50px;
}

.fill-white {
    flex: 1;
}

.common-layout {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.infinite-list-wrapper {
    overflow: auto;
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); /* width */
    grid-template-rows: repeat(auto-fill, minmax(50px, 1fr));
    gap: 8px; /* 元素之间的间隙 */
}

.width-220 {
    width: 220px;
}

:deep(.el-card__body) {
    padding: 0;
    text-align: center;
}

.text-center {
    text-align: center;
}

.bold {
    font-weight: bold;
}

.size-16 {
    font-size: 16px;
}

.size-30 {
    font-size: 30px;
}

.terminal-color {
    color: #9C27B0;
}

.route-color {
    color: #00C853;
}
</style>
