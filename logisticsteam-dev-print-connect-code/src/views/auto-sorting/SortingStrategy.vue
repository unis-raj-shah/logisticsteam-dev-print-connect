<template>
    <el-container class="common-layout">
        <el-main class="parent-container">
            <div style="text-align: right">
                <el-button type="primary" @click="addAndEditDialogRef.handleShow({}, 'add')">
                    + Add New
                </el-button>
            </div>
            <div>
                <el-table
                    :data="tableData"
                    v-loading="isTableLoading"
                    style="width: 100%"
                    :default-expand-all="true">
                    <el-table-column label="Name" prop="strategyName" />
                    <el-table-column label="Type" prop="displayName">
                        <template #default="{ row }">
                            <el-tag :color="typeColor[row.displayName]">
                                <span style="color: white;">{{ row.displayName }}</span>
                            </el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column label="Description" prop="description" />
                    <el-table-column label="Parameters" prop="parameters">
                        <template #default="{ row }">
                            <div v-for="(param, paramName) in row.parameters" :key="paramName">
                                <el-tag v-if="param.value" type="primary" class="paramTag">
                                    {{ param.description }}:
                                    <span class="paramValue">
                                        {{ strategyService.getLabelIfSelect(param) }}
                                    </span>
                                </el-tag>
                            </div>
                        </template>
                    </el-table-column>
                    <el-table-column>
                        <template #default="{ row }">
                            <el-button
                                type="primary"
                                plain
                                @click="addAndEditDialogRef.handleShow(row, 'edit')"
                                v-if="row.strategyType !== USER_DEFAULT_STRATEGY.strategyType"
                            >
                                Edit
                            </el-button>
                            <el-button
                                type="danger"
                                plain
                                @click="deleteStrategy(row)"
                                v-if="row.strategyType !== USER_DEFAULT_STRATEGY.strategyType"
                            >
                                Delete
                            </el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </div>
            <AddAndEditDialog ref="addAndEditDialogRef" @reloadTable="getTableData"></AddAndEditDialog>
        </el-main>
        <el-footer class="footer-item">
            <u-pagination
                v-model:page="currentPage"
                v-model:limit="pageSize"
                v-model:slice-list="tableData"
                :pageSizes="[5, 10, 30, 100]"
                :all-list="allDatas"
                :total="totalCount"/>
        </el-footer>
    </el-container>
</template>
<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import {
    deleteUserStrategy,
    getUserStrategyList,
    tryInsertUserStrategyForBusinessIfNeed,
} from '@/db/autoSorting';
import { ElMessage, ElMessageBox } from 'element-plus';
import strategyService from '@/service/autoSortingStrategyService';
import _ from 'lodash';
import AddAndEditDialog from './configuration/userStrategyAddAndEditDialog.vue';
import UPagination from '@/components/u-pagination/index.vue';
import { USER_DEFAULT_STRATEGY, UserStrategyTypeEnum } from '@/constants/autoSortingConstants';

let addAndEditDialogRef = ref<InstanceType<typeof AddAndEditDialog>>(null); // 弹窗对象

let isTableLoading = ref<boolean>(false);
let allDatas = ref([] as any); // 返回的所有列表数据
let tableData = ref([] as any); // 当前展示的列表数据
// <-------------分页参数S
let totalCount = ref<any>(0);
let currentPage = ref<any>(1);
let pageSize = ref<number>(5);
// <-------------分页参数E
const typeColor: any = {
    "Default": '#2196F3',
    "Manual Chute": "#FF9800"
}
// 获取列表数据
const getTableData = () => {
    isTableLoading.value = true;
    tableData.value = [];
    currentPage.value = 1;
    getUserStrategyList()
        .then((res: any) => {
            console.log('getTableData', res);
            _.forEach(res, (item: any) => {
                if (item.strategyType !== USER_DEFAULT_STRATEGY.strategyType) {
                    item.strategyType = UserStrategyTypeEnum.MANUAL_CHUTE_STRATEGY;
                }
                const strategy = strategyService.getStrategyByType(item.strategyType);
                if (strategy) {
                    item.description = _.get(item, 'description') || strategy.description;
                    item.displayName = strategy.displayName;
                    item.parameters = strategyService.getUserParamsAll(
                        item.parameters,
                        strategy.parameters
                    );
                }
            });
            console.log('getTableData foreach', res);
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
    await tryInsertUserStrategyForBusinessIfNeed();
    getTableData();
});

const deleteStrategy = (row: any) => {
    ElMessageBox.confirm(`Do you want to delete this row ?`, 'Delete Confirm', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        type: 'warning',
    })
        .then(() => {
            deleteUserStrategy(row)
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

.common-layout {
    height: 100%;
}

.parent-container {
    display: flex;
    flex-direction: column;
    height: calc(100% - 50px);
}

.footer-item {
    height: 50px;
}
</style>
