<template>
    <div class="common-layout">
        <el-container>
            <el-main>
                <el-card style="width: 100%;margin-bottom: 10px;">
                    <template #header><div style="text-align: left;font-weight: 600;">Environment Setup</div></template>
                    <SocketServer></SocketServer>
                </el-card>
                <el-card class="card-main">
                    <el-form :label-position="'top'" style="text-align: left;" :inline="true" :model="searchData" :rules="rules" ref="ruleFormRef">
                        <el-card class="card-item" shadow="never">
                            <template #header><div style="text-align: left;font-weight: 600;">Basic Sorting Setting</div></template>
                            <div class="demo-form-inline">
                                <el-form-item label="Wave Data Fetch Time">
                                    <el-time-picker
                                        v-model="searchData.waveDataFetchTime"
                                        format="HH:mm"
                                        value-format="HH:mm"
                                    />
                                    <el-button type="primary" @click="fetchData" :loading="fetching">Fetch</el-button>
                                </el-form-item>
                                <el-form-item label="Get Pkgs Timer Interval(Min.)">
                                    <el-input type="number" v-model="searchData.getPkgsTimerInterval" />
                                    <el-button type="primary" @click="execute" :loading="fetching">Execute</el-button>
                                </el-form-item>
                                <el-form-item label="Maximum Carrying Capacity(Pound)">
                                    <el-input type="number" v-model="searchData.maximumCarryingCapacity" />
                                </el-form-item>
                                <el-form-item label="Package Info Retention Period(Day)">
                                    <el-input type="number" v-model="searchData.packageInfoRetentionPeriod" />
                                </el-form-item>
                            </div>
                        </el-card>
                        <el-card class="card-item" shadow="never">
                            <template #header><div style="text-align: left;font-weight: 600;">Check Chute Setting</div></template>
                            <div class="demo-form-inline">
                                <el-form-item label="Timely Check Chute">
                                    <el-switch v-model="searchData.timelyCheckChute" />
                                </el-form-item>
                                <el-form-item
                                    prop="checkChuteTimerInterval"
                                    label="Check Chute Timer Interval(Min.)"
                                >
                                    <el-input type="number" v-model="searchData.checkChuteTimerInterval" />
                                </el-form-item>
                                <el-form-item
                                    prop="maxIntervalSinceLastDrop"
                                    label="Max Interval Since Last Drop(Min.)"
                                >
                                    <el-input type="number" v-model="searchData.maxIntervalSinceLastDrop" />
                                </el-form-item>
                            </div>
                        </el-card>
                        <el-card class="card-item" shadow="never">
                            <template #header><div style="text-align: left;font-weight: 600;">Chute Allocation Setting</div></template>
                            <div class="demo-form-inline">
                                <el-form-item label="Dynamic Chute Allocation">
                                    <el-switch v-model="searchData.dynamicSettingChute" />
                                </el-form-item>
                                <el-form-item label="Data Scope(Day)">
                                    <el-input type="number" :max="180" v-model="searchData.dataScope" />
                                </el-form-item>
                                <el-form-item label="Setting Frequency(Per Day)">
                                    <el-input type="number" v-model="searchData.settingFrequency" />
                                </el-form-item>
                                <el-form-item label="Package Type">
                                    <el-select
                                        v-model="searchData.packageType"
                                        multiple
                                        @change="packageTypeChange"
                                        clearable
                                    >
                                        <el-option label="Poly Bag" value="Poly Bag" />
                                        <el-option label="Box" value="Box" />
                                    </el-select>
                                </el-form-item>
                                <el-row style="justify-content: flex-end; width: 100%;">
                                    <el-button type="primary" @click="submitForm(ruleFormRef)">Save</el-button>
                                </el-row>
                            </div>
                        </el-card>
                    </el-form>
                </el-card>
            </el-main>
        </el-container>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, reactive } from 'vue';
import {
    getPlatform,
    tryInitDBIfNeed,
    setConfig,
    getSortingSetupConfig,
    clearLocalServerDataAndSaveWhenClosingWave,
    packingTimeoutAlert,
} from '@/db/autoSorting';
import { ElMessage, FormInstance } from 'element-plus';
import { AUTO_SORTING_PLATFORM } from '@/constants/autoSortingConstants';
import { ipcRenderer } from 'electron';
import TimerManager from '@/shared/TimerManager';
import SocketServer from '@/components/SocketServer.vue';
import dayjs from 'dayjs';
import _ from 'lodash';

let platforms = ref<any>([]);
let isPlatformLoading = ref<boolean>(false);
let tableData = ref([] as any); // 当前展示的列表数据
let isTableLoading = ref<boolean>(false);
let searchData = ref<any>({
    status: '',
    terminal: '',
    trackingNo: '',
    route: '',
    labelCode: '',
});
let fetching = ref<boolean>(false);
const ruleFormRef = ref<FormInstance>();
const rules = reactive({
    checkChuteTimerInterval: [{ required: true, message: 'Required', trigger: 'change' }],
    maxIntervalSinceLastDrop: [{ required: true, message: 'Required', trigger: 'change' }],
});

// 获取列表数据
const getTableData = () => {
    isTableLoading.value = true;
    tableData.value = [];
    getSortingSetupConfig()
        .then((res: any) => {
            try {
                console.log('sorting_setup', res);
                searchData.value = res;
                if (!searchData.value.dataScope) {
                    searchData.value.dataScope = 180;
                }
                if (!searchData.value.settingFrequency) {
                    searchData.value.settingFrequency = 1;
                }
                if (!searchData.value.packageType) {
                    searchData.value.packageType = ['Poly Bag'];
                }
                if (typeof searchData.value.packageType === 'string') {
                    searchData.value.packageType = [searchData.value.packageType];
                }
            } catch (error) {
                console.log('sorting_setup_error', error);
            }
        })
        .catch((err: any) => {
            ElMessage.error(`error: ${err.message}`);
        })
        .finally(() => {
            isTableLoading.value = false;
        });
};

const submitForm = async (formEl: FormInstance | undefined) => {
    if (!formEl) return;
    await formEl.validate((valid, fields) => {
        if (valid) {
            save();
        }
    });
};

const save = () => {
    console.log('searchData.value', searchData.value);
    if (searchData.value.dynamicSettingChute) {
        searchData.value.settingFrequencyStartDate = dayjs().format('YYYY-MM-DD');
    }
    setConfig('sorting_setup', JSON.stringify(searchData.value))
        .then(async (res: any) => {
            await reBuildTimer();
            ElMessage.success('Save success');
        })
        .catch((err: any) => {
            ElMessage.error(`error: ${err.message}`);
        })
        .finally(() => {
            isTableLoading.value = false;
        });
};

const reBuildTimer = async () => {
    const config: any = await getSortingSetupConfig();
    const timerManager = TimerManager.getInstance();
    timerManager.clearTimer('PackingTimeoutAlert');
    if (config.timelyCheckChute) {
        timerManager.addTimer(
            'PackingTimeoutAlert',
            packingTimeoutAlert,
            config.checkChuteTimerInterval * 60000
        );
    }
    timerManager.clearTimer('pullWave');
    timerManager.addTimer('pullWave', pullWave, config.getPkgsTimerInterval * 60000);
};

const execute = async () => {
    console.log('execute');
    //等待集成逻辑
    fetching.value = true;
    const isSuccess = await ipcRenderer.invoke('pullWave');
    if (isSuccess) {
        ElMessage.success('Execute success');
    } else {
        ElMessage.error('Execute failed');
    }
    fetching.value = false;
};

const packageTypeChange = () => {
    if (_.isEmpty(searchData.value.packageType)) {
        searchData.value.packageType = ['Poly Bag'];
    }
};

const fetchData = async () => {
    console.log('fetchData');
    //等待集成逻辑
    fetching.value = true;
    const isSuccess = await clearLocalServerDataAndSaveWhenClosingWave();
    if (isSuccess) {
        ElMessage.success('Fetch success');
    } else {
        ElMessage.error('Fetch failed');
    }
    fetching.value = false;
};

isPlatformLoading.value = true;
platforms.value = AUTO_SORTING_PLATFORM;
isPlatformLoading.value = false;

onMounted(async () => {
    try {
        await tryInitDBIfNeed();
        await getPlatform();
    } catch (e) {
        console.error('getPlatform Error', e);
    }
    getTableData();
});

function pullWave() {
    throw new Error('Function not implemented.');
}
</script>

<style scoped>
.demo-form-inline {
    display: flex;
    flex-wrap: wrap;
}

.demo-form-inline .el-input {
    --el-input-width: 220px;
}

.demo-form-inline .el-select {
    --el-select-width: 220px;
}
.el-card__header {
    text-align: left;
}

:deep(.card-main > .el-card__body) {
    padding: 0 !important;
}

.card-item {
    width: 100%;
}
</style>
