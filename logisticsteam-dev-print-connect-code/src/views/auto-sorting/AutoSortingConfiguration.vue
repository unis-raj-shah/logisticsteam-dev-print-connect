<template>
    <el-container class="common-layout">
        <el-main class="parent-container">
            <el-form>
                <el-row style="justify-content: flex-end">
                    <el-button
                        class="h-[47px]"
                        type="primary"
                        @click="addRow"
                        :disabled="!selPlatform"
                    >
                        + Add New
                    </el-button>
                </el-row>
                <el-row class="row-flex">
                    <el-form-item label="Chute No" class="flex-item">
                        <div class="width-220">
                            <el-autocomplete
                                v-model="searchData.chuteNo"
                                :fetch-suggestions="getChuteOptions"
                                placeholder="Please input chute no"
                                @select="selectChuteNo"
                                class="el-autocomplete"
                                clearable
                            >
                                <template #default="{ item }">
                                    {{ item }}
                                </template>
                            </el-autocomplete>
                        </div>
                    </el-form-item>
                    <el-form-item label="Status" class="flex-item">
                        <el-select
                            v-model="searchData.isEnabled"
                            placeholder="Please select status"
                            clearable
                        >
                            <el-option label="Enabled" :value="1" />
                            <el-option label="Disabled" :value="0" />
                        </el-select>
                    </el-form-item>
                    <el-form-item label="Chute Type" class="flex-item">
                        <el-select
                            v-model="searchData.chuteType"
                            placeholder="Please select type"
                            clearable
                        >
                            <el-option
                                v-for="item in getOptions('chuteTypeEnum')"
                                :key="item.label"
                                :label="item.label"
                                :value="item.label"
                            />
                        </el-select>
                    </el-form-item>
                    <el-form-item label="Group" class="flex-item">
                        <el-select
                            v-model="searchData.groupId"
                            placeholder="Please select group"
                            clearable
                        >
                            <el-option
                                v-for="group in groups"
                                :key="group.id"
                                :label="group.groupName"
                                :value="group.id"
                            />
                        </el-select>
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
                    <el-button type="primary" @click="getTableData" :disabled="isTableLoading">
                        Search
                    </el-button>
                </el-row>
            </el-form>
            <el-table :data="tableData" v-loading="isTableLoading" class="fill-white" :show-overflow-tooltip="true">
                <el-table-column label="Chute No" prop="chuteNo" min-width="150" fixed="left" />
                <el-table-column label="Status" prop="isEnabled" min-width="150">
                    <template #default="{ row }">
                        <el-result
                            class="result-icon"
                            :icon="row.isEnabled === 1 ? 'success' : 'error'"
                        />
                    </template>
                </el-table-column>
                <el-table-column
                    label="Chute Type"
                    prop="chuteType"
                    min-width="150"
                    :show-overflow-tooltip="true"
                />
                <el-table-column label="Group" prop="groupName" min-width="150" :show-overflow-tooltip="true">
                    <template #default="{ row }">
                        <span>{{ ChuteTypeEnum.DROP_OFF !== row.chuteType ? row.groupName : '' }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="Action" fixed="right" align="right" min-width="150">
                    <template #default="scope">
                        <el-button size="small" type="primary" plain @click="editRow(scope.row)">
                            Edit
                        </el-button>
                        <el-button size="small" type="danger" plain @click="deleteRow(scope.row)">
                            Delete
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
            <AddAndEditDialog ref="addAndEditDialogRef" @reloadTable="getTableData" />
            <u-error-dialog :err-dialog-visible="errDialogVisible" :err-infos="errInfos" />
        </el-main>
        <el-footer class="footer-item">
            <u-pagination
                v-model:page="searchData.page"
                v-model:limit="searchData.pageSize"
                :pageSizes="[20, 50, 100, 300]"
                :total="total"
                @pagination="getTableData"
            />
        </el-footer>
    </el-container>
</template>

<script lang="tsx" setup>
import { onMounted, ref } from 'vue';
import {
    deleteChute,
    getChuteGroupList,
    getChuteGroupListByPaging,
    getChuteListByChuteNoLike,
    getGroupList,
    getPlatform,
    s2ab,
    saveChute,
    tryInitDBIfNeed,
} from '@/db/autoSorting';
import { getOptions } from '@/apis/selectData';
import { ElButton, ElMessage, ElMessageBox, ElResult } from 'element-plus';
import { ipcRenderer } from 'electron';
import { ChuteTypeEnum } from '@/constants/autoSortingConstants';
import _ from 'lodash';
import AddAndEditDialog from '@/views/auto-sorting/configuration/chuteAddAndEditDialog.vue';
import UPagination from '@/components/u-pagination/index.vue';
import UErrorDialog from '@/components/u-error-dialog/index.vue';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

let addAndEditDialogRef = ref<InstanceType<typeof AddAndEditDialog>>(null); // 弹窗对象
let tableData = ref([] as any); // 当前展示的列表数据
let isTableLoading = ref<boolean>(false);
let selPlatform = ref<any>('');
let searchData = ref<any>({
    page: 1,
    pageSize: 20,
});
let total = ref(0);
const groups = ref<any>([]);
let fileUploadRef = ref<HTMLInputElement | null>(null);
let files = ref<any>();
const errInfos = ref<string[]>([]);
const errDialogVisible = ref<boolean>(false);

// 获取列表数据
const getTableData = () => {
    isTableLoading.value = true;
    tableData.value = [];
    getChuteGroupListByPaging(searchData.value)
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

onMounted(async () => {
    try {
        await tryInitDBIfNeed();
        const platform = await getPlatform();
        if (platform) {
            selPlatform.value = platform.name;
        }
    } catch (e) {
        console.error('getPlatform Error', e);
    }
    groups.value = await getGroupList();
    getTableData();
});

// 删除
const deleteRow = (val: any) => {
    ElMessageBox.confirm(`Do you want to delete this row ?`, 'Delete Confirm', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        type: 'warning',
    }).then(() => {
        deleteChute(val.id)
            .then(() => {
                getTableData();
                ElMessage({
                    type: 'success',
                    message: 'Delete completed',
                });
                ipcRenderer.invoke('auto-sorting-main-message', 'refreshChuteInfoList');
            })
            .catch((err: any) => {
                ElMessage.error(`error: ${err.message}`);
            });
    });
};

const addRow = () => {
    addAndEditDialogRef.value.handleShow('add', selPlatform.value);
};

const editRow = (rowData: any) => {
    console.log('tes', rowData);
    addAndEditDialogRef.value.handleShow('edit', selPlatform.value, rowData);
};

const getChuteOptions = async (query: string, cb: any) => {
    try {
        const res = await getChuteListByChuteNoLike({ chuteNo: query });
        cb(_.map(res, 'chuteNo') || []);
    } catch (err: any) {
        ElMessage.error(`error: ${err.message}`);
    }
};

const selectChuteNo = (value: string) => {
    searchData.value.chuteNo = value;
};

const exportExcel = async () => {
    const chutes = await getChuteGroupList();
    const exportData: any[] = [];
    for (const chute of chutes) {
        exportData.push({
            'Chute No': chute.chuteNo,
            Status: chute.isEnabled === 1 ? 'Enable' : 'Disable',
            'Chute Type': chute.chuteType,
        });
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    saveAs(blob, 'ChuteConfiguration.xlsx');
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
        const importData: any[] = XLSX.utils.sheet_to_json(worksheet);
        const allChuteNos: string[] = _.map(importData, 'Chute No');
        const allChuteTypes: string[] = _.uniq(_.map(importData, 'Chute Type'));
        errInfos.value = [];
        const groupByChuteNo = _.values(_.groupBy(allChuteNos, (o: string) => o));
        const duplicateChuteNos: string[] = [];
        for (const chuteNos of groupByChuteNo) {
            if (_.size(chuteNos) > 1) {
                duplicateChuteNos.push(chuteNos[0]);
            }
        }
        if (!_.isEmpty(duplicateChuteNos)) {
            errInfos.value.push(
                `The chute configuration have duplicate chute no. Ref: chute no=${JSON.stringify(
                    duplicateChuteNos
                )}`
            );
        }
        const invalidChuteType = _.difference(allChuteTypes, [
            ChuteTypeEnum.DROP_OFF,
            ChuteTypeEnum.ROUTE,
            ChuteTypeEnum.TERMINAL,
            ChuteTypeEnum.EXCEPTION,
        ]);
        if (!_.isEmpty(invalidChuteType)) {
            errInfos.value.push(
                `The chute configuration have invalid chute type. Ref: type=${JSON.stringify(
                    invalidChuteType
                )}`
            );
        }
        if (!_.isEmpty(errInfos.value)) {
            errDialogVisible.value = true;
            isTableLoading.value = false;
            files.value = [];
            return;
        }
        const chutes = await getChuteListByChuteNoLike({ chuteNoIn: allChuteNos });
        const chuteMap = _.keyBy(chutes, 'chuteNo');
        for (const data of importData) {
            const chute = chuteMap[data['Chute No']];
            if (_.isEmpty(chute)) {
                await saveChute({
                    chuteNo: data['Chute No'],
                    isEnabled: _.eq(data.Status, 'Enable') ? 1 : 0,
                    chuteType: data['Chute Type'],
                    platform: global.platform.name,
                });
            } else {
                await saveChute(
                    {
                        chuteNo: data['Chute No'],
                        isEnabled: _.eq(data.Status, 'Enable') ? 1 : 0,
                        chuteType: data['Chute Type'],
                        platform: global.platform.name,
                    },
                    chute.id
                );
            }
        }
        await getTableData();
        files.value = [];
        ElMessage.success('import success!');
    };
    await reader.readAsArrayBuffer(file);
};

const triggerFileUpload = () => {
    fileUploadRef.value?.click();
};
</script>

<style scoped>
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

.result-icon {
    --el-result-icon-font-size: 20px;
    height: 20px;
    width: 0;
    padding: 20px;
}

.el-select {
    --el-select-width: 220px;
}

.el-input__wrapper {
    width: 200px;
    flex-grow: initial;
}

.row-flex {
    display: flex;
}

.flex-item {
    flex: 1;
    margin: 10px;
}

.width-220 {
    width: 220px;
}
</style>
