<template>
    <el-tabs
        v-model="activeName"
        type="border-card"
        class="admin-tools-tabs"
        @tab-click="handleClick"
        v-loading="isTableLoading"
    >
        <el-tab-pane label="Remove Sorting Status" name="first" class="first-container">
            <el-main class="parent-container">
                <el-table :data="tableData" style="flex: 1;">
                    <el-table-column fixed label="Tracking#" prop="trackingNo" min-width="100">
                        <template #default="{ row }">
                            <div style="font-weight: bold">
                                {{ row.trackingNo }}
                            </div>
                        </template>
                    </el-table-column>
                    <el-table-column label="Status" prop="status" min-width="100">
                        <template #default="{ row }">
                            <el-tag color="#3498DB">
                                <span style="color: white">{{ row.status }}</span>
                            </el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column label="Terminal" prop="terminal" min-width="100" />
                    <el-table-column label="Route#" prop="routeNo" min-width="100" />
                    <el-table-column label="Chute No" prop="chuteNo" min-width="100">
                        <template #default="{ row }">
                            <div style="font-weight: bold">
                                {{ row.chuteNo }}
                            </div>
                        </template>
                    </el-table-column>
                    <el-table-column label="Create Time" prop="createTime" min-width="100" />
                    <el-table-column label="Update Time" prop="updateTime" min-width="100" />
                    <el-table-column fixed="right" label="Operations" min-width="120">
                        <template #default="{ row }">
                            <el-button link type="primary" @click="removeRowDialogShow(row)">Remove</el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </el-main>
            <el-footer class="footer-item">
                <u-pagination
                    v-model:page="searchData.page"
                    v-model:limit="searchData.pageSize"
                    :pageSizes="[20, 50, 100, 300]"
                    :total="total"
                    @pagination="search"
                />
            </el-footer>
            <el-dialog
                v-model="dialogVisible"
                width="500"
                :show-close="false"
                append-to-body
            >
                <template #header>
                    <el-icon color="red" size="18">
                        <Warning />
                    </el-icon>
                    Tips
                </template>
                <div>
                    <p>Are you sure you want to remove package '{{ currentRow.trackingNo }}'?</p>
                    <p>Created on: {{ currentRow.createTime }}.</p>
                    <p>Please confirm your action.</p>
                </div>
                <template #footer>
                    <div class="dialog-footer">
                        <el-button @click="dialogVisible = false">Cancel</el-button>
                        <el-button type="primary" @click="removeRowConfirm">
                            Confirm
                        </el-button>
                    </div>
                </template>
            </el-dialog>
        </el-tab-pane>
        <el-tab-pane label="Confirm Chute Packages" name="second" class="second-container">
            <el-form :inline="true">
                <el-form-item label="Chute No">
                    <div class="width-220">
                        <el-select
                            v-model="chuteNo"
                            filterable
                            remote
                            placeholder="Please select chute no"
                            remote-show-suffix
                            :remote-method="getChuteOptions"
                            :loading="getChuteOptionsLoading"
                        >
                            <el-option
                                v-for="item in chuteOptions"
                                :key="item"
                                :label="item"
                                :value="item"
                            />
                        </el-select>
                    </div>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="searchQueuePackageData">Search</el-button>
                </el-form-item>
            </el-form>
            <el-card
                v-if="!_.isEmpty(queuePackageData)"
                v-loading="searchQueuePackageDataLoading"
                style="flex: 1"
                :body-style="{ height: 'calc(100% - 130px)' }"
            >
                <template #header>
                    <label>{{ queuePackageData.chuteNo }}</label>
                </template>
                <label>Received Packages Inside:</label>
                <div class="packages-inside-div">
                    <el-tag
                        v-for="tag in detailTags"
                        :key="tag.barcode"
                        :closable="isEditPackageData"
                        :disable-transitions="false"
                        @close="handleClose(tag)"
                        :type="tag.type"
                    >
                        {{ tag.barcode }}
                    </el-tag>
                    <div v-if="isEditPackageData" style="display: flex">
                        <div class="width-150">
                            <el-autocomplete
                                v-model="inputValue"
                                :fetch-suggestions="getItemOptions"
                                class="el-autocomplete"
                                @select="selectItemBarcode"
                                size="small"
                                clearable
                            >
                                <template #default="{ item }">
                                    {{ item }}
                                </template>
                            </el-autocomplete>
                        </div>
                        <el-button size="small" @click="handleInputConfirm">
                            +
                        </el-button>
                    </div>
                </div>
                <label v-if="isEditPackageData">Local Packages Inside:</label>
                <div v-if="isEditPackageData" class="packages-inside-div">
                    <el-tag v-for="tag in queuePackageData.localDetails" :key="tag.barcode">
                        {{ tag.barcode }}
                    </el-tag>
                </div>
                <template #footer>
                    <div v-if="isEditPackageData" style="text-align: end">
                        <el-button type="primary" @click="changeQueuePackageDataDialogShow">Confirm</el-button>
                    </div>
                </template>
            </el-card>
            <el-empty v-else description="No Data" />
            <el-dialog
                v-model="dialogVisible2"
                width="500"
                :show-close="false"
                append-to-body
            >
                <template #header>
                    <el-icon color="red" size="18">
                        <Warning />
                    </el-icon>
                    Tips
                </template>
                <div>
                    <p>Are you sure you want to change chute package data?</p>
                    <p>Please confirm your action.</p>
                </div>
                <template #footer>
                    <div class="dialog-footer">
                        <el-button @click="dialogVisible2 = false">Cancel</el-button>
                        <el-button type="primary" @click="changeQueuePackageDataConfirm">
                            Confirm
                        </el-button>
                    </div>
                </template>
            </el-dialog>
        </el-tab-pane>
    </el-tabs>
</template>
<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import UPagination from '@/components/u-pagination/index.vue';
import {
    getPlatform,
    packagesMonitorSearch,
    tryInitDBIfNeed,
    removePackageData,
    searchChuteInfoList,
    getQueuePackageInfoByChuteNo,
    searchItemsByBarcodes,
    changeQueuePackageData,
    searchItemsByKey,
} from '@/db/autoSorting';
import { ElMessage, TabsPaneContext } from 'element-plus';
import { ChuteWorkStatusEnum, PackageMonitorStatusEnum } from '@/constants/autoSortingConstants';
import _ from 'lodash';

let activeName = ref<string>('first');
let tableData = ref([] as any); // 当前展示的列表数据
let isTableLoading = ref<boolean>(false);
let isTimer = ref<boolean>(false);
let searchData = ref<any>({
    page: 1,
    pageSize: 20,
    isOnlyToday: true,
    status: PackageMonitorStatusEnum.SORTING,
});
let total = ref(0);
let timerId = ref<any>(null);
let dialogVisible = ref<boolean>(false);
let currentRow = ref<any>({});
let queuePackageData = ref<any>({});
let chuteNo = ref<string>('');
let chuteOptions = ref<string[]>([]);
let getChuteOptionsLoading = ref<boolean>(false);
let searchQueuePackageDataLoading = ref<boolean>(false);
let inputValue = ref('');
let inputVisible = ref(false);
let detailTags = ref<any[]>([]);
let isEditPackageData = ref<boolean>(false);
let dialogVisible2 = ref<boolean>(false);

const handleClick = async (tab: TabsPaneContext) => {
    if (tab.paneName == activeName.value) return;
    if (tab.paneName == 'first') {
        chuteNo.value = '';
        queuePackageData.value = {};
        await search();
        timerId.value = setInterval(async () => {
            if (isTableLoading.value || isTimer.value) return;
            isTimer.value = true;
            await getTableData();
        }, 5000);
    } else {
        clearInterval(timerId.value);
        await getChuteOptions('');
    }
};

const search = async () => {
    isTableLoading.value = true;
    await getTableData();
};

const getTableData = async () => {
    await packagesMonitorSearch(searchData.value)
        .then((res: any) => {
            console.log('getTableData', res);
            tableData.value = res.data;
            total.value = res.total;
        })
        .catch((err: any) => {
            ElMessage.error(`error: ${err.message}`);
        })
        .finally(() => {
            isTableLoading.value = false;
            isTimer.value = false;
        });
};

const removeRowDialogShow = (row: any) => {
    currentRow.value = row;
    dialogVisible.value = true;
};

const removeRowConfirm = async () => {
    dialogVisible.value = false;
    try {
        await removePackageData(currentRow.value);
        await search();
        ElMessage.success(`Remove success!`);
    } catch (err: any) {
        ElMessage.error(`error: ${err.message}`);
    }
};

const getChuteOptions = async (query: string) => {
    getChuteOptionsLoading.value = true;
    try {
        const res = await searchChuteInfoList({
            chuteNo: query,
            workStatusIn: [ChuteWorkStatusEnum.FULL_PACKAGE, ChuteWorkStatusEnum.COLLECT_PACKAGE],
            isEnabled: 1,
        });
        console.log('getChuteOptions', res);
        chuteOptions.value = _.map(res, 'chuteNo') || [];
    } catch (err: any) {
        ElMessage.error(`Get chute options error: ${err.message}`);
    } finally {
        getChuteOptionsLoading.value = false;
    }
};

const searchQueuePackageData = async () => {
    console.log('searchQueuePackageData');
    if (_.isEmpty(chuteNo.value)) {
        ElMessage.error('Please select chute no');
        return;
    }
    searchQueuePackageDataLoading.value = true;
    try {
        queuePackageData.value = await getQueuePackageInfoByChuteNo(chuteNo.value);
        const tags = [];
        isEditPackageData.value = !_.isEmpty(queuePackageData.value.localDetails);
        if (isEditPackageData.value) {
            const barcodes = _.map(queuePackageData.value.details, 'barcode');
            const localBarcodes = _.map(queuePackageData.value.localDetails, 'barcode');
            const items = await searchItemsByBarcodes(barcodes);
            const itemMap = _.keyBy(items, 'barcode') || {};
            for (const detail of queuePackageData.value.details) {
                if (_.includes(localBarcodes, detail.barcode)) {
                    tags.push({ barcode: detail.barcode, type: 'success' });
                } else if (_.isEmpty(itemMap[itemMap.barcode])){
                    tags.push({ barcode: detail.barcode, type: 'danger' });
                } else {
                    tags.push({ barcode: detail.barcode, type: 'primary' });
                }
            }
        } else {
            for (const detail of queuePackageData.value.details) {
                tags.push({ barcode: detail.barcode, type: 'success' });
            }
        }
        detailTags.value = tags;
    } catch (err: any) {
        ElMessage.error(`Search queue package data error: ${err.message}`);
    } finally {
        searchQueuePackageDataLoading.value = false;
    }
};

const handleClose = (tag: string) => {
    detailTags.value.splice(detailTags.value.indexOf(tag), 1);
};

const handleInputConfirm = async () => {
    if (inputValue.value) {
        const currentBarcodes = _.map(detailTags.value, 'barcode');
        if (_.includes(currentBarcodes, inputValue.value)) {
            ElMessage.error(`package data already exist: ${detailTags.value}`);
            inputVisible.value = false;
            inputValue.value = '';
            return;
        }
        if (!_.isEmpty(queuePackageData.value.localDetails)) {
            const localBarcodes = _.map(queuePackageData.value.localDetails, 'barcode');
            if (_.includes(localBarcodes, inputValue.value)) {
                detailTags.value.push({ barcode: inputValue.value, type: 'success' });
                inputVisible.value = false;
                inputValue.value = '';
                return;
            }
        }
        const items = await searchItemsByBarcodes([inputValue.value]);
        if (_.isEmpty(items)) {
            detailTags.value.push({ barcode: inputValue.value, type: 'danger' });
        } else {
            detailTags.value.push({ barcode: inputValue.value, type: 'primary' });
        }
    }
    inputVisible.value = false;
    inputValue.value = '';
};

const changeQueuePackageDataDialogShow = () => {
    dialogVisible2.value = true;
};

const changeQueuePackageDataConfirm = async () => {
    dialogVisible2.value = false;
    searchQueuePackageDataLoading.value = true;
    try {
        await changeQueuePackageData(queuePackageData.value, detailTags.value);
        await searchQueuePackageData();
        ElMessage.success(`Change package data success!`);
    } catch (err: any) {
        ElMessage.error(`Change package data error: ${err.message}`);
    } finally {
        searchQueuePackageDataLoading.value = false;
    }
};

const getItemOptions = async (query: string, cb: any) => {
    try {
        const res = await searchItemsByKey(query);
        cb(_.map(res, 'barcode') || []);
    } catch (err: any) {
        ElMessage.error(`Get item options error: ${err.message}`);
    }
};

const selectItemBarcode = (value: string) => {
    inputValue.value = value;
};

onMounted(async () => {
    try {
        await tryInitDBIfNeed();
        await getPlatform();
    } catch (e) {
        console.error('getPlatform Error', e);
    }
    await search();
    timerId.value = setInterval(async () => {
        if (isTableLoading.value || isTimer.value) return;
        isTimer.value = true;
        await getTableData();
    }, 5000);
});

onBeforeUnmount(() => {
    console.log('onBeforeUnmount');
    clearInterval(timerId.value);
});
</script>
<style scoped>
.admin-tools-tabs {
    height: 100%;
}
:deep(.el-tabs__content) {
    height: calc(100% - 25px);
}
.parent-container {
    display: flex;
    flex-direction: column;
    height: calc(100% - 60px);
    padding: 0;
}
.first-container {
    height: 100%;
}
.footer-item {
    height: 50px;
}
.width-220 {
    width: 220px;
}
.width-150 {
    width: 150px;
}
.second-container {
    text-align: start;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding-bottom: 10px;
}
.packages-inside-div {
    display: flex;
    flex-wrap: wrap; /* 使元素自动换行 */
    gap: 10px; /* 控制元素之间的间距 */
}
</style>
