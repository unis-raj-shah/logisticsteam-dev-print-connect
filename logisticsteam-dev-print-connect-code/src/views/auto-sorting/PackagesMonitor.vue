<template>
    <el-container class="common-layout">
        <el-main class="parent-container">
            <el-form class="row-flex" :model="searchData">
                <el-form-item label="Tracking#" class="flex-item">
                    <el-input
                        v-model="searchData.trackingNo"
                        placeholder="Please input tracking#"
                        clearable
                    />
                </el-form-item>
                <el-form-item label="Terminal" class="flex-item">
                    <el-input
                        v-model="searchData.terminal"
                        placeholder="Please input terminal"
                        clearable
                    />
                </el-form-item>
                <el-form-item label="Route#" class="flex-item">
                    <el-input
                        v-model="searchData.routeNo"
                        placeholder="Please input route#"
                        clearable
                    />
                </el-form-item>
                <el-form-item label="Label Code" class="flex-item">
                    <el-input
                        v-model="searchData.labelCode"
                        placeholder="Please input label code"
                        clearable
                    />
                </el-form-item>
                <el-form-item label="Chute No" class="flex-item">
                    <el-input
                        v-model="searchData.chuteNo"
                        placeholder="Please input chute no"
                        clearable
                    />
                </el-form-item>
                <el-form-item label="Status" class="flex-item">
                    <el-select v-model="searchData.statuses" placeholder="Select status" style="width: 400px" multiple clearable>
                        <el-option
                            v-for="status in statuses"
                            :key="status"
                            :label="status"
                            :value="status"
                        />
                    </el-select>
                </el-form-item>
                <el-form-item label="Today Only" class="flex-item">
                    <el-checkbox v-model="searchData.isOnlyToday"/>
                </el-form-item>
                <el-form-item style="float: right;margin-right: 10px">
                    <el-button type="primary" @click="exportExcel" :disabled="isTableLoading">
                        Export
                    </el-button>
                </el-form-item>
                <el-form-item style="float: right">
                    <el-button type="primary" @click="search">Search</el-button>
                </el-form-item>
            </el-form>
            <el-table :data="tableData" v-loading="isTableLoading" class="fill-white">
                <el-table-column label="Tracking#" prop="trackingNo" min-width="100">
                    <template #default="{ row }">
                        <div style="font-weight: bold">
                            {{ row.trackingNo }}
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="Status" prop="status" min-width="100">
                    <template #default="{ row }">
                        <el-tag :color="statusColors[row.status]">
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
                <el-table-column label="Label Code" prop="label_Code" min-width="100" />
                <el-table-column label="Exception Reason" min-width="100" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div style="font-weight: bold;white-space: nowrap;overflow: hidden;text-overflow: ellipsis;">
                            {{ row.exceptionReason }}
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="Create Time" prop="createTime" min-width="100" />
                <el-table-column label="Update Time" prop="updateTime" min-width="100" />
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
    </el-container>
</template>

<script lang="ts" setup>
import {ref, onMounted, onBeforeUnmount} from 'vue';
import {
    getPlatform,
    tryInitDBIfNeed,
    packagesMonitorSearch,
    s2ab,
    getPackagesMonitor,
} from '@/db/autoSorting';
import { ElMessage } from 'element-plus';
import { AUTO_SORTING_PLATFORM } from '@/constants/autoSortingConstants';
import UPagination from '@/components/u-pagination/index.vue';
import * as XLSX from "xlsx";
import {saveAs} from "file-saver";

let platforms = ref<any>([]);
let isPlatformLoading = ref<boolean>(false);
let tableData = ref([] as any); // 当前展示的列表数据
let isTableLoading = ref<boolean>(false);
const statuses = [
    'Unsorted',
    'Sorting',
    'Sorted',
    'Bonded',
    'Not Found',
    'Overweight',
    'Exception',
    'Incremental Found',
];
let searchData = ref<any>({
    page: 1,
    pageSize: 20,
    isOnlyToday: true,
});

const statusColors: any = {
    Unsorted: '#FFA500',
    Sorting: '#3498DB',
    Sorted: '#2ECC71',
    Bonded: '#9B59B6',
    'Not Found': '#E74C3C',
    Overweight: '#F1C40F',
    Exception: '#E67E22',
    'Incremental Found': '#1ABC9C',
};
let total = ref(0);
let timerId = ref<any>(null);
let refreshParams: any = {
    page: 1,
    pageSize: 20,
    isOnlyToday: true,
};
// 获取列表数据
const getTableData = () => {
    isTableLoading.value = true;
    tableData.value = [];
    packagesMonitorSearch(refreshParams)
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
        });
};

const search = () => {
    refreshParams = JSON.parse(JSON.stringify(searchData.value));
    getTableData();
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
    timerId.value = setInterval(async () => {
        await getTableData();
    }, 60000);
});

onBeforeUnmount(() => {
    console.log('onBeforeUnmount');
    clearInterval(timerId.value);
});

const exportExcel = async () => {
    const packages: any[] = await getPackagesMonitor(searchData.value);
    const exportData: any[] = [];
    for (const pkg of packages) {
        exportData.push({
            'Tracking#': pkg.trackingNo,
            Status: pkg.status,
            Terminal: pkg.terminal,
            'Route#': pkg.routeNo,
            'Chute No': pkg.chuteNo,
            'Label Code': pkg.label_Code,
            'Exception Reason': pkg.exceptionReason,
            'Create Time': pkg.createTime,
            'Update Time': pkg.updateTime,
        });
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    saveAs(blob, 'PackageMonitors.xlsx');
};
</script>

<style scoped>
.el-input {
    --el-input-width: 220px;
}

.el-select {
    --el-select-width: 220px;
}

.demo-pagination-block+.demo-pagination-block {
    margin-top: 10px;
}

.demo-pagination-block .demonstration {
    margin-bottom: 16px;
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

.row-flex {
    display: flex;
    flex-wrap: wrap;
}

.flex-item {
    flex: 1;
    margin: 10px;
}
.fill-white {
    flex: 1;
}
</style>
