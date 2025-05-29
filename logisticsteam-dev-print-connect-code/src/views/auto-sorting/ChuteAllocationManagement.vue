<template>
    <el-container class="common-layout">
        <el-main class="parent-container">
            <el-form class="demo-form-inline">
                <el-row style="justify-content: flex-end">
                    <el-button type="primary" @click="addAndEditDialogRef.handleShow('add', {})">
                        + Add New
                    </el-button>
                </el-row>
                <el-row class="row-flex">
                    <el-form-item label="Name" class="flex-item">
                        <el-input
                            v-model="search.routeName"
                            placeholder="Please input name"
                            clearable
                        />
                    </el-form-item>
                    <el-form-item label="Type" class="flex-item">
                        <el-select v-model="search.type" placeholder="Please select type" clearable>
                            <el-option
                                v-for="item in getOptions('chuteAllocationTypeEnum')"
                                :key="item.label"
                                :label="item.label"
                                :value="item.label"
                            />
                        </el-select>
                    </el-form-item>
                    <el-form-item label="Chute Needed" class="flex-item">
                        <el-select
                            v-model="search.isChuteNeeded"
                            placeholder="Please select chute needed"
                            clearable
                        >
                            <el-option label="Yes" :value="1" />
                            <el-option label="No" :value="0" />
                        </el-select>
                    </el-form-item>
                    <el-form-item label="Chute No" class="flex-item">
                        <el-input
                            v-model="search.chuteNo"
                            placeholder="Please input chute no"
                            clearable
                        />
                    </el-form-item>
                </el-row>
                <el-row style="float: right">
                    <input
                        :value="files"
                        type="file"
                        ref="fileUploadRef"
                        @change="importExcel"
                        style="display: none"
                    />
                    <el-button type="primary" @click="triggerFileUpload" :disabled="isTableLoading">
                        Import
                    </el-button>
                    <el-button type="primary" @click="exportExcel" :disabled="isTableLoading">
                        Export
                    </el-button>
                    <el-button type="primary" @click="getTableData()" :disabled="isTableLoading">
                        Search
                    </el-button>
                </el-row>
            </el-form>
            <el-table v-loading="isTableLoading" :data="tableData" class="fill-white" :default-expand-all="true">
                <el-table-column label="Name" prop="routeName" min-width="100" />
                <el-table-column label="Type" prop="type" min-width="100">
                    <template #default="{ row }">
                        <el-tag :color="typeColors[row.type]">
                            <span style="color: white">{{ row.type }}</span>
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="Chute Needed" prop="isChuteNeeded" min-width="100">
                    <template #default="{ row }">
                        {{ row.isChuteNeeded === 1 ? 'Yes' : 'No' }}
                    </template>
                </el-table-column>
                <el-table-column label="Fixed Chute No" prop="fixedChuteNos" min-width="100">
                    <template #default="{ row }">
                        {{ _.join(row.fixedChuteNos, ',') }}
                    </template>
                </el-table-column>
                <el-table-column label="Action" min-width="100" fixed="right">
                    <template #default="{ row }">
                        <el-button
                            type="primary"
                            plain
                            @click="addAndEditDialogRef.handleShow('edit', row)"
                        >
                            Edit
                        </el-button>
                        <el-button type="danger" plain @click="deleteRow(row)">Delete</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <AddAndEditDialog ref="addAndEditDialogRef" @reloadTable="getTableData()" />
            <u-error-dialog :err-dialog-visible="errDialogVisible" :err-infos="errInfos" />
        </el-main>
        <el-footer class="footer-item">
            <u-pagination
                v-model:page="search.paging.pageNo"
                v-model:limit="search.paging.limit"
                :pageSizes="[20, 50, 100, 300]"
                :total="search.paging.totalCount"
                @pagination="getTableData"
            />
        </el-footer>
    </el-container>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import AddAndEditDialog from './configuration/chuteAllocationAddAndEditDialog.vue';
import {
    deleteChuteAllocation,
    getChuteListByChuteNoLike,
    saveChuteAllocation,
    searchChuteAllocationByPaging,
    searchChuteAllocationList,
    s2ab,
} from '@/db/autoSorting';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getOptions } from '@/apis/selectData';
import _ from 'lodash';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ChuteAllocationTypeEnum } from '@/constants/autoSortingConstants';
import UPagination from '@/components/u-pagination/index.vue';
import UErrorDialog from '@/components/u-error-dialog/index.vue';

let addAndEditDialogRef = ref<InstanceType<typeof AddAndEditDialog>>(null); // 弹窗对象
let isTableLoading = ref<boolean>(false);
let tableData = ref([] as any); // 当前展示的列表数据
let search = ref<any>({
    paging: {
        pageNo: 1,
        limit: 20,
        totalCount: 0,
        totalPage: 0,
    },
});
let fileUploadRef = ref<HTMLInputElement | null>(null);
let files = ref<any>();
const typeColors: any = {
    Route: '#4CAF50',
    Terminal: '#9C27B0',
};
const errInfos = ref<string[]>([]);
const errDialogVisible = ref<boolean>(false);

// 获取列表数据
const getTableData = () => {
    isTableLoading.value = true;
    tableData.value = [];
    searchChuteAllocationByPaging(search.value)
        .then((res: any) => {
            _.forEach(res.data, (item: any) => {
                item.fixedChuteNos = JSON.parse(item.fixedChuteNos);
            });
            console.log('getTableData', res);
            tableData.value = res.data;
            search.value.paging = res.paging;
        })
        .catch((err: any) => {
            ElMessage.error(`error: ${err.message}`);
        })
        .finally(() => {
            isTableLoading.value = false;
        });
};

onMounted(async () => {
    getTableData();
});

const deleteRow = (row: any) => {
    ElMessageBox.confirm(`Do you want to delete this row ?`, 'Delete Confirm', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        type: 'warning',
    })
        .then(() => {
            deleteChuteAllocation(row.id)
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

const exportExcel = async () => {
    const chuteAllocations = await searchChuteAllocationList({});
    const exportData: any[] = [];
    for (const chuteAllocation of chuteAllocations) {
        exportData.push({
            Name: chuteAllocation.routeName,
            Type: chuteAllocation.type,
            'Chute Needed': chuteAllocation.isChuteNeeded == 1 ? 'Yes' : 'No',
            'Fixed Chute No': _.join(JSON.parse(chuteAllocation.fixedChuteNos), ','),
        });
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    saveAs(blob, 'ChuteAllocations.xlsx');
};

const importExcel = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    isTableLoading.value = true;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        let importData: any[] = XLSX.utils.sheet_to_json(worksheet);
        let routeChutes = await getRouteChute();
        let terminalChutes = await getTerminalChute();
        errInfos.value = [];
        let totalFixedChuteNos: string[] = [];
        const chuteAllocations = await searchChuteAllocationList({});
        let fixedChuteNos: string[] = [];
        for (let chuteAllocation of chuteAllocations) {
            chuteAllocation.fixedChuteNos = JSON.parse(chuteAllocation.fixedChuteNos) || [];
            fixedChuteNos = _.concat(fixedChuteNos, chuteAllocation.fixedChuteNos);
        }
        const chuteAllocationMap = _.keyBy(chuteAllocations, 'routeName');
        for (let index = 0; index < _.size(importData); index++) {
            let chuteNos = _.compact(_.split(importData[index]['Fixed Chute No'], ',')) || [];
            let difChutes;
            if (_.eq('Route', importData[index].Type)) {
                difChutes = _.difference(chuteNos, routeChutes);
            } else if (_.eq('Terminal', importData[index].Type)) {
                difChutes = _.difference(chuteNos, terminalChutes);
            } else {
                errInfos.value.push(`chute type is not exist, please check. Ref: row=${index + 2}, routeName=${importData[index].Name}`);
                return;
            }
            if (!_.isEmpty(difChutes)) {
                errInfos.value.push(`chute type not match or chute is not exist, please check. Ref: row=${index + 2}, routeName=${importData[index].Name}`);
            }
            const chuteAllocation = chuteAllocationMap[importData[index]['Chute No']];
            let tempFixedChuteNos = JSON.parse(JSON.stringify(fixedChuteNos));
            if (!_.isEmpty(chuteAllocation)) {
                tempFixedChuteNos = _.difference(tempFixedChuteNos, chuteAllocation.fixedChuteNos);
            }
            const currentUsedChuteNos = _.intersection(tempFixedChuteNos, chuteNos);
            if (!_.isEmpty(currentUsedChuteNos)) {
                errInfos.value.push(`The chute allocation have chute assigned. Ref: row=${index + 2}, routeName=${importData[index].Name}`);
            }
            importData[index].isChuteNeeded = (!_.isEmpty(chuteNos) || _.eq(importData[index]['Chute Needed'], 'Yes')) ? 1 : 0;
            importData[index].fixedChuteNos = JSON.stringify(chuteNos);
            totalFixedChuteNos = _.concat(totalFixedChuteNos, chuteNos);
        }
        const group = _.groupBy(totalFixedChuteNos, (o: string) => o);
        const chuteNos = _.keys(group);
        const useDuplicationChuteNos = [];
        for (let chuteNo of chuteNos) {
            if (_.size(group[chuteNo]) > 1) {
                useDuplicationChuteNos.push(chuteNo);
            }
        }
        if (!_.isEmpty(useDuplicationChuteNos)) {
            errInfos.value.push(`The chute allocation exist chutes be reassigned. Ref: chuteNo=${JSON.stringify(useDuplicationChuteNos)}`);
        }
        let isDuplication = validateRouteNameDuplication(importData);
        if (!_.isEmpty(isDuplication)) errInfos.value.push(isDuplication);
        if (!_.isEmpty(errInfos.value)) {
            errDialogVisible.value = true;
            isTableLoading.value = false;
            files.value = [];
            return;
        }
        for (let data of importData) {
            const chuteAllocation = chuteAllocationMap[data['Chute No']];
            let chuteAllocationData: any = {
                routeName: data.Name,
                type: data.Type,
                isChuteNeeded: data.isChuteNeeded,
                fixedChuteNos: data.fixedChuteNos,
            };
            if (!_.isEmpty(chuteAllocation)) {
                chuteAllocationData.id = chuteAllocation.id;
            }
            await saveChuteAllocation(chuteAllocationData);
        }
        await getTableData();
        files.value = [];
    };
    await reader.readAsArrayBuffer(file);
};

const getRouteChute = async () => {
    let res = await getChuteListByChuteNoLike({ chuteType: ChuteAllocationTypeEnum.ROUTE });
    return _.map(res, 'chuteNo') || [];
};

const getTerminalChute = async () => {
    let res = await getChuteListByChuteNoLike({ chuteType: ChuteAllocationTypeEnum.TERMINAL });
    return _.map(res, 'chuteNo') || [];
};

const triggerFileUpload = () => {
    fileUploadRef.value?.click();
};

const validateRouteNameDuplication = (chuteAllocationList: any[]) => {
    const routeNames = _.map(chuteAllocationList, 'Name');
    const groups = _.values(_.groupBy(routeNames, (o: string) => _.toUpper(o)));
    const res = _.filter(groups, (o: string[]) => _.size(o) > 1);
    if (_.isEmpty(res)) return '';
    return `Duplicate name exists. Ref: ${_.join(_.map(res, (o: string[]) => JSON.stringify(o)), ',')}`;
};
</script>

<style scoped>
.demo-form-inline .el-input {
    --el-input-width: 220px;
}

.demo-form-inline .el-select {
    --el-select-width: 220px;
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

.fill-white {
    flex: 1;
}
.row-flex {
    display: flex;
}

.flex-item {
    flex: 1;
    margin: 10px;
}
</style>
