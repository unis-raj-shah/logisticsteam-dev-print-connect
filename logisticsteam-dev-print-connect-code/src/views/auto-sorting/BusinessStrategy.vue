<template>
    <div class="common-layout">
        <el-container>
            <el-main>
                <!-- <div>
                    <div style="margin-bottom: 5px; display: flex; align-items: center">
                        <span style="margin-right: 5px; width: 150px">Current Business:</span>
                        <el-select v-model="currentBusiness" filterable style="width: 150px" @change="businessChange">
                            <el-option :key="o" :label="o" :value="o" v-for="o in businessesList"></el-option>
                        </el-select>
                        <el-icon :size="30" style="padding-left: 5px">
                            <Setting @click="businessClick" />
                        </el-icon>
                        <array-select-dialog :confirm-function="businessConfirm" ref="businessDialogRef"
                            title="Business List"></array-select-dialog>
                    </div>
                </div> -->
                <div style="text-align: right">
                    <el-button type="primary" @click="businessStrategyAddClick" :disabled="!currentBusiness">
                        + Add Business Strategy
                    </el-button>
                </div>
                <div>
                    <el-table :data="tableData" v-loading="isTableLoading" style="width: 100%">
                        <!-- <el-table-column label="Priority" prop="priority" width="80" /> -->
                        <!-- <el-table-column label="Business" prop="business" width="120" /> -->
                        <el-table-column label="Name" prop="strategyName" width="120" />
                        <el-table-column label="Status" prop="isEnabled" width="100">
                            <template #default="{ row }">
                                <el-result  id="el-result" :icon="row.isEnabled === 1 ? 'success' : 'error'">
                                </el-result>
                            </template>
                        </el-table-column>
                        <el-table-column label="Type" prop="displayName" width="130">
                            <template #default="{ row }">
                                <el-tag :color="typeColor[row.displayName]">
                                    <span style="color: white;">{{ row.displayName }}</span>
                                </el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="Description" prop="description" />
                        <el-table-column label="Action" width="340">
                            <template #default="{ row }">
                                <el-button type="primary" size="small" plain @click="viewParameters(row)">
                                    View parameters
                                </el-button>
                                <el-button type="danger" size="small" plain @click="deleteStrategy(row)"
                                    v-if="row.strategyType != USER_DEFAULT_STRATEGY.strategyType">
                                    Delete
                                </el-button>
                                <el-button type="warning" size="small" plain @click="enabledOrDisabled(row)">
                                    {{ row.isEnabled === 1 ? 'Disabled' : 'Enabled' }}
                                </el-button>
                                <!-- <el-button
                                    plain
                                    size="small"
                                    @click="priorityUp(row)"
                                    v-if="
                                        $index != 0 &&
                                        row.strategyType != USER_DEFAULT_STRATEGY.strategyType
                                    "
                                >
                                    <el-icon :size="20">
                                        <Top />
                                    </el-icon>
                                </el-button> -->
                                <!-- <el-button
                                    plain
                                    size="small"
                                    @click="priorityDown(row)"
                                    v-if="
                                        $index + 2 < totalCount &&
                                        row.strategyType != USER_DEFAULT_STRATEGY.strategyType
                                    "
                                >
                                    <el-icon :size="20">
                                        <Bottom />
                                    </el-icon>
                                </el-button> -->
                            </template>
                        </el-table-column>
                    </el-table>
                </div>
                <AddAndEditDialog ref="addAndEditDialogRef" @reloadTable="getTableData"></AddAndEditDialog>
                <select-dialog title="Add Business Strategy" label="Select Strategy" ref="businessStrategyAddDialogRef"
                    :confirm-function="businessStrategyAddConfirm" :options="unusedStrategyList"
                    @reloadTable="getTableData"></select-dialog>
                <el-dialog v-model="viewParametersDialog"
                    :title="currentRow.strategyName + ' - ' + currentRow.displayName">
                    <div v-for="(param, paramName) in currentRow.parameters" :key="paramName">
                        <el-tag v-if="param.value" type="primary" class="paramTag">
                            {{ param.description }}:
                            <span class="paramValue">
                                {{ strategyService.getLabelIfSelect(param) }}
                            </span>
                        </el-tag>
                    </div>
                </el-dialog>
            </el-main>
        </el-container>
    </div>
</template>
<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import {
    getCurrentBusiness,
    getBusinessList,
    saveBusinessList,
    saveCurrentBusiness,
    getBusinessStrategyList,
    addBusinessStrategy,
    priorityUpBusinessStrategy,
    priorityDownBusinessStrategy,
    deleteBusinessStrategy,
    tryInsertUserStrategyForBusinessIfNeed,
    getUnusedStrategyListExcludeDefaultByBusiness,
    tryInitDBIfNeed,
    enabledBusinessStrategy,
    disabledBusinessStrategy
} from '@/db/autoSorting';
import { ElMessage, ElMessageBox } from 'element-plus';
import strategyService from '@/service/autoSortingStrategyService';
import _ from 'lodash';
import { Setting, Top, Bottom } from '@element-plus/icons-vue';
import AddAndEditDialog from './configuration/userStrategyAddAndEditDialog.vue';
import ArraySelectDialog from '@/components/array-select-dialog.vue';
import BusinessStrategyAddDialog from '@/components/select-dialog.vue';
import SelectDialog from '@/components/select-dialog.vue';
import { USER_DEFAULT_STRATEGY } from '@/constants/autoSortingConstants';
import { ipcRenderer } from 'electron';
import { CircleCheck, Remove } from '@element-plus/icons-vue';

const typeColor: any = {
    "Default": '#2196F3',
    "Manual Chute": "#FF9800"
}
let addAndEditDialogRef = ref<InstanceType<typeof AddAndEditDialog>>(null); // 弹窗对象
let businessDialogRef = ref<InstanceType<typeof ArraySelectDialog>>(null); // 弹窗对象
let businessStrategyAddDialogRef = ref<InstanceType<typeof BusinessStrategyAddDialog>>(null); // 弹窗对象

let currentBusiness = ref('');
let businessesList = ref([]);
let isTableLoading = ref<boolean>(false);
let unusedStrategyList = ref([]);
let currentRow = ref({});
let viewParametersDialog = ref(false);

let allDatas = ref([] as any); // 返回的所有列表数据
let tableData = ref([] as any); // 当前展示的列表数据
// <-------------分页参数S
let totalCount = ref<any>(0);
let currentPage = ref<any>(1);
let pageSize = ref<number>(10);
// <-------------分页参数E

// 获取列表数据
const getTableData = () => {
    tableData.value = [];
    currentPage.value = 1;
    if (!currentBusiness.value) {
        return;
    }
    isTableLoading.value = true;
    getBusinessStrategyList(currentBusiness.value)
        .then((res: any) => {
            console.log('getTableData', res);
            _.forEach(res, (item: any) => {
                const strategy = strategyService.getStrategyByType(item.strategyType);
                if (strategy) {
                    item.description = strategy.description;
                    item.displayName = strategy.displayName;
                    item.parameters = strategyService.getUserParamsAll(
                        item.parameters,
                        strategy.parameters
                    );
                }
            });
            console.log('getTableData foreach', res);
            tableData.value = res;
            allDatas.value = res;
            totalCount.value = allDatas.value.length;
        })
        .catch((err: any) => {
            ElMessage.error(`error: ${err.message}`);
        })
        .finally(() => {
            isTableLoading.value = false;
        });
};

onMounted(async () => {
    await tryInitDBIfNeed();
    await refreshData();
});

const viewParameters = (row: any) => {
    currentRow.value = row;
    viewParametersDialog.value = true;
};

const refreshData = async () => {
    currentBusiness.value = await getCurrentBusiness();
    businessesList.value = await getBusinessList();
    getTableData();
};
const businessChange = async (value: string) => {
    await saveCurrentBusiness(value);
    await tryInsertUserStrategyForBusinessIfNeed();
    await refreshData();
    await ipcRenderer.invoke('auto-sorting-main-message', 'refreshCurrentBusiness');
};

const businessClick = async () => {
    businessDialogRef.value.handleShow(businessesList.value);
};

const businessStrategyAddClick = async () => {
    unusedStrategyList.value = _.forEach(
        await getUnusedStrategyListExcludeDefaultByBusiness(currentBusiness.value),
        (item: any) => {
            item.label =
                item.strategyName +
                ' - ' +
                strategyService.getStrategyByType(item.strategyType).displayName;
            item.value = item.id;
        }
    );
    businessStrategyAddDialogRef.value.handleShow();
};

const businessConfirm = async (value: string) => {
    await saveBusinessList(value);
    await refreshData();
};

const businessStrategyAddConfirm = async (value: string) => {
    await addBusinessStrategy(currentBusiness.value, Number(value));
    await refreshData();
};

const deleteStrategy = (row: any) => {
    ElMessageBox.confirm(`Do you want to delete this row ?`, 'Delete Confirm', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        type: 'warning',
    })
        .then(() => {
            deleteBusinessStrategy(row)
                .then(() => {
                    getTableData();
                    ElMessage({
                        type: 'success',
                        message: 'Delete completed',
                    });
                })
                .catch((err: any) => {
                    ElMessage.error(`error: ${err.message}`);
                });
        })
        .catch(() => {
            // do nothing
        });
};

const search = () => {
    getTableData();
};

const priorityUp = (row: any) => {
    priorityUpBusinessStrategy(row)
        .then(() => {
            getTableData();
        })
        .catch((err: any) => {
            ElMessage.error(`error: ${err.message}`);
        });
};
const priorityDown = (row: any) => {
    priorityDownBusinessStrategy(row)
        .then(() => {
            getTableData();
        })
        .catch((err: any) => {
            ElMessage.error(`error: ${err.message}`);
        });
};

const enabledOrDisabled = async (row: any) => {
    if (row.isEnabled == 1) {
        if (row.strategyType == USER_DEFAULT_STRATEGY.strategyType) {
            ElMessage.error('Default strategy cannot be disabled');
            return;
        }
        await disabledBusinessStrategy(row)
        const defaultBusinessStrategy = _.find(tableData.value, (item: any) => { return item.strategyType == USER_DEFAULT_STRATEGY.strategyType })
        await enabledBusinessStrategy(defaultBusinessStrategy)
    } else {
        const haveEnabled = _.filter(tableData.value, (item: any) => { return item.isEnabled });
        if (_.size(haveEnabled) == 1) {
            await disabledBusinessStrategy(haveEnabled[0]);
        }
        await enabledBusinessStrategy(row)
    }
    await refreshData();
};

</script>
<style scoped>
.paramValue {
    color: #67c23a;
}

.paramTag {
    margin-bottom: 5px;
}

.addBtn {
    text-align: left;
}
</style>
