<template>
    <div class="common-layout">
        <el-container>
            <el-main class="chute-container">
                <div>
                    <div class="search-container">
                        <!-- 状态下拉选择 -->
                        <div class="flex">
                            <div style="width: 100px; margin-right: 5px">Route#</div>
                            <el-input
                                v-model="searchData.routeNo"
                                placeholder="Please input route no"
                                class="wave-no-input" />
                        </div>
                        <div style="display: flex;margin-left: 5px;">
                            <div style="margin-right: 5px;width:50px">Status</div>
                            <label class="custom-checkbox" v-for="item in jobStatuses" :key="item">
                                <input type="checkbox" class="checkbox-input" v-model="jobStatusParam[item]">
                                <span :class="'checkbox-mark ' + item"></span>
                                {{ statusLabelMap[item] }}
                            </label>
                        </div>
                        <!-- 查询按钮 -->
                        <el-button style="height: 36px; margin-left: auto;" type="primary" @click="search">
                            Search
                        </el-button>
                    </div>
                    <el-table :data="tableData" v-loading="isTableLoading" style="width: 100%"
                        :default-expand-all="true">
                        <el-table-column label="Wave No" prop="waveNo" />
                        <el-table-column label="Status" prop="status">
                            <template #default="{ row }">
                                <el-tag :type="getStatusType(row.status)"> {{ row.status }}</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="Allocated Pkg Qty">
                            <template #default="{ row }">
                                <div style="font-weight: bold;color: black">
                                    {{ assignedQtyMap[row.waveNo] }}
                                </div>
                            </template>
                        </el-table-column>
                        <el-table-column align="right">
                            <template #default="scope">
<!--                                <el-button v-if="scope.row.status === WaveStatusEnum.RUNNING" size="small" type="danger"-->
<!--                                    @click="clickStopWave(scope.row)">Stop-->
<!--                                </el-button>-->
                                <el-button
                                    v-if="scope.row.status === WaveStatusEnum.STOP"
                                    size="small"
                                    type="success"
                                    @click="clickStartWave(scope.row)"
                                >
                                    Start
                                </el-button>
                                <template v-if="scope.row.status === WaveStatusEnum.RUNNING">
                                    <el-popconfirm
                                        confirm-button-text="confirm"
                                        cancel-button-text="cancel"
                                        :icon="InfoFilled"
                                        icon-color="red"
                                        title="Collect the partial bags and end today’s wave?"
                                        @confirm="collectAllPackages"
                                        width="300"
                                    >
                                        <template #reference>
                                            <el-button
                                                size="small"
                                                type="danger"
                                            >
                                                Collect All Packages
                                            </el-button>
                                        </template>
                                    </el-popconfirm>
                                </template>
                            </template>
                        </el-table-column>
                        <el-table-column type="expand">
                            <template #default="{ row }">
                                <div class="terminal-list" v-if="row.jobGroup && row.jobGroup.length">
                                    <template v-for="(jobs, index) in row.jobGroup" :key="index">
                                        <el-divider content-position="left">{{ jobs[0].terminal }}</el-divider>
                                        <div class="job-list">
                                            <template v-for="(job, id) in jobs" :key="id">
                                                <el-tooltip placement="top" effect="light" append-to-body>
                                                    <template #content>
                                                        <p class="text-center bold size-16 terminal-color">{{ job.terminal }}</p>
                                                        <p class="text-center bold size-16 route-color">
                                                            <u-quick-copy :copy-string="job.chuteKey" />
                                                            {{ job.chuteKey }}
                                                        </p>
                                                        <p class="text-center bold size-30">
                                                            {{ getCurrentDropOffCount(row.waveNo, job.chuteKey) }}
                                                        </p>
                                                    </template>
                                                    <div :class="'job ' + getCurrentStatus(row.waveNo, job.chuteKey)">
                                                        <div class="text-center size-18">
                                                            {{ _.split(job.chuteKey, ".")[0].substring(0, 3) }}
                                                        </div>
                                                    </div>
                                                </el-tooltip>
                                            </template>
                                        </div>
                                    </template>
                                </div>
                                <span v-else>No jobList</span>
                            </template>
                        </el-table-column>
                    </el-table>
                </div>
            </el-main>
        </el-container>
    </div>
</template>
<script lang="ts" setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
    closeLibiaoWave,
    getDropOffCountByRouteNoV3,
    getWaveList,
    startWave,
    stopWave,
} from '@/db/autoSorting';
import { ElMessage, ElMessageBox } from 'element-plus';
import { InfoFilled } from '@element-plus/icons-vue';
import { JobStatusEnum, WaveStatusEnum } from '@/constants/autoSortingConstants';
import _ from 'lodash';
import UQuickCopy from '@/components/u-quick-copy/index.vue';

const searchData = reactive<any>({});
let tableData = ref([] as any); // 当前展示的列表数据
let isTableLoading = ref<boolean>(false);
const jobStatuses = [JobStatusEnum.COMPLETED, JobStatusEnum.UNASSIGNED, JobStatusEnum.ASSIGNED];
let timerId = ref<any>(null);
const statusLabelMap: any = {
    Unassigned: 'Unprocessed',
    Assigned: 'Processing',
    Completed: 'Processed',
};
let jobStatusParam = ref<any>({});
let dropOffCountMap = ref<any>({});
let assignedQtyMap = ref<any>({});

const getDropOffCountMap = async () => {
    const { waveQtyMap, waveAssignedQtyMap } = await getDropOffCountByRouteNoV3();
    console.log('getDropOffCountMap', waveQtyMap, waveAssignedQtyMap);
    dropOffCountMap.value = waveQtyMap;
    assignedQtyMap.value = waveAssignedQtyMap;
};

// 获取列表数据
const getTableData = (isLoading: boolean) => {
    if (isLoading) isTableLoading.value = true;
    const jobStatuses = _.keys(jobStatusParam.value).filter((item: any) => jobStatusParam.value[item]);
    getWaveList(searchData)
        .then((res: any) => {
            console.log('getTableData', res);
            const waves = JSON.parse(JSON.stringify(res));
            for (let id = 0; id < _.size(waves); id++) {
                waves[id].jobList = [];
                waves[id].jobGroup = [];
                for (let job of res[0].jobList) {
                    job.status = getCurrentStatus(res[0].waveNo, job.chuteKey);
                    if (_.isEmpty(jobStatuses)) {
                        waves[id].jobList.push(job);
                    } else if (_.includes(jobStatuses, job.status)) {
                        waves[id].jobList.push(job);
                    }
                }
                waves[id].jobList = _.sortBy(waves[id].jobList, ['terminal', 'chuteKey']);
                waves[id].jobGroup = _.reverse(_.values(_.groupBy(waves[id].jobList, 'terminal')));
            }
            tableData.value = waves;
        })
        .catch((err: any) => {
            ElMessage.error(`error: ${err.message}`);
        })
        .finally(async () => {
            isTableLoading.value = false;
        });
};

onMounted(async () => {
    await getDropOffCountMap();
    getTableData(true);
    timerId.value = setInterval(async () => {
        await getDropOffCountMap();
        getTableData(false);
    }, 5000);
});

onBeforeUnmount(() => {
    clearInterval(timerId.value);
});

const search = () => {
    getTableData(true);
};

const getStatusType = (status: string) => {
    switch (status) {
        case WaveStatusEnum.STOP:
            return 'info';
        case WaveStatusEnum.RUNNING:
            return 'warning';
        case WaveStatusEnum.COMPLETED:
            return 'success';
        default:
            return 'info';
    }
};

const clickStopWave = (row: any) => {
    ElMessageBox.confirm(`Are you sure to stop this wave:${row.waveNo}?`, 'Warning', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        type: 'warning',
    }).then(() => {
        console.log('stopWave', row);
        stopWave(row.id)
            .then(() => {
                getTableData(false);
                ElMessage({
                    type: 'success',
                    message: 'Stop successfully!',
                });
            })
            .catch((err: any) => {
                ElMessage.error(`error: ${err.message}`);
            });
    });
};

const clickStartWave = (row: any) => {
    ElMessageBox.confirm(`Are you sure to start this wave:${row.waveNo}?`, 'Warning', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        type: 'warning',
    }).then(() => {
        console.log('startWave', row);
        startWave(row.id)
            .then(() => {
                getTableData(false);
                ElMessage({
                    type: 'success',
                    message: 'Start successfully!',
                });
            })
            .catch((err: any) => {
                ElMessage.error(`error: ${err.message}`);
            });
    });
};
const getCurrentDropOffCount = (waveNo: string, chuteKey: string): number => {
    return dropOffCountMap.value[waveNo] && dropOffCountMap.value[waveNo][chuteKey] ? dropOffCountMap.value[waveNo][chuteKey].assignedQty : 0;
};

const collectAllPackages = async () => {
    const res = await closeLibiaoWave();
    if (!res || res.code == 500) {
        ElMessage.error(`collect all packages error: ${res?.message}`);
    } else {
        ElMessage({
            type: 'success',
            message: 'collect all packages successfully!',
        });
    }
};

const getCurrentStatus = (waveNo: string, chuteKey: string): string => {
    const count2 = dropOffCountMap.value[waveNo] && dropOffCountMap.value[waveNo][chuteKey] ? dropOffCountMap.value[waveNo][chuteKey].qty : 0;
    if (count2 === 0) return 'Exception';
    const count = getCurrentDropOffCount(waveNo, chuteKey);
    if (count === 0) return 'Unassigned';
    if (count < count2) return 'Assigned';
    return 'Completed';
};
</script>
<style scoped>
.chute-container {
    text-align: left;
}

.search-container {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 10px;
    display: flex;
    align-items: center;
}

.flex {
    display: flex;
    align-items: center;
    margin-right: 10px;
}

.wave-no-input .el-input__inner {
    height: 36px;
    /* 设置 Wave No 输入框的高度 */
    line-height: 36px;
    /* 设置 Wave No 输入框的行高 */
}
.terminal-list {
    display: flex;
    flex-direction: column;
}

.job-list {
    margin-block: 5px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(50px, auto));
    grid-auto-rows: minmax(50px, auto);
    gap: 8px;
}

.job {
    display: flex;
    justify-content: center; /* 水平居中 */
    align-items: center; /* 垂直居中 */
    flex-direction: column;
    background-color: #f0f0f0;
    border-radius: 5px;
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1);
    /* 添加阴影效果 */
    padding: 5px;
    transition: transform 0.3s ease;
    /* 添加动画效果 */
    color: black;
}

.Completed {
    background-color: #2ecc71;
}

.Assigned {
    background-color: #3498db;
}

.Unassigned {
    background-color: #BDBDBD;
}

.Exception {
    background-color: #e74c3c;
}

.job:hover {
    transform: translateY(-5px);
    /* 悬停时卡片向上移动 */
}

.job-item {
    text-align: center;
    font-size: 8px;
    font-weight: bold;
    word-wrap: break-word;
}


.custom-checkbox {
    display: inline-block;
    position: relative;
    padding-left: 30px;
    /* margin-bottom: 12px; */
    cursor: pointer;
    font-size: 16px;
    user-select: none;
    margin-right: 20px;
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

.Unassigned {
    background-color: #BDBDBD;
}

.checkbox-mark.Unassigned {
    border-color: #BDBDBD;
}

.custom-checkbox .checkbox-input~.checkbox-mark.Unassigned {
    background-color: #BDBDBD;
}

.custom-checkbox .checkbox-input:checked~.checkbox-mark.Unassigned {
    background-color: #BDBDBD;
}

.Assigned {
    background-color: #3498db;
}

.checkbox-mark.Assigned {
    border-color: #3498db;
}

.custom-checkbox .checkbox-input~.checkbox-mark.Assigned {
    background-color: #3498db;
}

.custom-checkbox .checkbox-input:checked~.checkbox-mark.Assigned {
    background-color: #3498db;
}

.Completed {
    background-color: #2ecc71;
}

.checkbox-mark.Completed {
    border-color: #2ecc71;
}

.custom-checkbox .checkbox-input~.checkbox-mark.Completed {
    background-color: #2ecc71;
}

.custom-checkbox .checkbox-input:checked~.checkbox-mark.Completed {
    background-color: #2ecc71;
}

.Exception {
    background-color: #e74c3c;
}

.checkbox-mark.Exception {
    border-color: #e74c3c;
}

.custom-checkbox .checkbox-input~.checkbox-mark.Exception {
    background-color: #e74c3c;
}

.custom-checkbox .checkbox-input:checked~.checkbox-mark.Exception {
    background-color: #e74c3c;
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

.size-18 {
    font-size: 18px;
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
