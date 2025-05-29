<template>
    <el-container class="common-layout">
        <el-main class="parent-container">
            <el-form>
                <el-row style="justify-content: flex-end">
                    <el-button type="primary" @click="addAndEditDialogRef.handleShow({}, 'add')">
                        + Add New
                    </el-button>
                </el-row>
                <el-row class="row-flex">
                    <el-form-item label="Name" class="flex-item">
                        <el-input
                            v-model="searchData.groupName"
                            placeholder="Please input name"
                            clearable
                        />
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
                    <el-form-item label="Chute No" class="flex-item">
                        <div class="width-220">
                            <el-autocomplete
                                v-model="searchData.chuteNo"
                                :fetch-suggestions="getChuteOptions"
                                placeholder="Please input chute no"
                                @select="selectChuteNo"
                                clearable
                            >
                                <template #default="{ item }">
                                    {{ item }}
                                </template>
                            </el-autocomplete>
                        </div>
                    </el-form-item>
                    <el-form-item label="Drop off Point" class="flex-item">
                        <div class="width-220">
                            <el-autocomplete
                                v-model="searchData.dropOffNo"
                                :fetch-suggestions="getDropOffOptions"
                                placeholder="Please input chute no"
                                @select="selectDropOffNo"
                                clearable
                            >
                                <template #default="{ item }">
                                    {{ item }}
                                </template>
                            </el-autocomplete>
                        </div>
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
                    <el-button type="primary" @click="triggerFileUpload" :disabled="isTableLoading">Import</el-button>
                    <el-button type="primary" @click="exportExcel" :disabled="isTableLoading">Export</el-button>
                    <el-button type="primary" @click="search" :disabled="isTableLoading">Search</el-button>
                </el-row>
            </el-form>
            <el-table
                :data="tableData"
                v-loading="isTableLoading"
                class="fill-white"
                :default-expand-all="true"
            >
                <el-table-column label="Name" prop="groupName" width="140" />
                <el-table-column label="Status" prop="isEnabled" width="100">
                    <template #default="{ row }">
                        <el-result
                            id="el-result"
                            :icon="row.isEnabled === 1 ? 'success' : 'error'"
                        />
                    </template>
                </el-table-column>
                <el-table-column label="Chute List" prop="chuteList">
                    <template #default="{ row }">
                        <el-tag v-for="chute in row.chuteList" :key="chute.id" class="mr-1">
                            {{ chute.chuteNo }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="Drop-Off Points" prop="dropOffPoints" width="140">
                    <template #default="{ row }">
                        <el-tag v-for="item in row.dropOffPoints" :key="item" class="mr-1">
                            {{ item }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="Action" width="200">
                    <template #default="{ row }">
                        <el-button
                            type="primary"
                            plain
                            @click="addAndEditDialogRef.handleShow(row, 'edit')"
                        >
                            Edit
                        </el-button>
                        <el-button type="warning" plain @click="deleteRow(row)">Delete</el-button>
                    </template>
                </el-table-column>
            </el-table>
            <AddAndEditDialog ref="addAndEditDialogRef" @reloadTable="search" />
            <u-error-dialog :err-dialog-visible="errDialogVisible" :err-infos="errInfos" />
        </el-main>
        <el-footer class="footer-item">
            <u-pagination
                v-model:page="searchData.paging.pageNo"
                v-model:limit="searchData.paging.limit"
                :pageSizes="[5, 10, 30, 100]"
                :total="searchData.paging.totalCount"
                @pagination="search"
            />
        </el-footer>
    </el-container>
</template>
<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import {
    deleteGroup,
    getChuteListByChuteNoLike,
    getGroupList,
    s2ab,
    saveGroup,
    searchGroupByPaging,
} from '@/db/autoSorting';
import { ElMessage, ElMessageBox } from 'element-plus';
import _ from 'lodash';
import AddAndEditDialog from './configuration/groupAddAndEditDialog.vue';
import { ChuteTypeEnum } from '@/constants/autoSortingConstants';
import UPagination from '@/components/u-pagination/index.vue';
import UErrorDialog from '@/components/u-error-dialog/index.vue';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

let addAndEditDialogRef = ref<InstanceType<typeof AddAndEditDialog>>(null); // 弹窗对象
const isTableLoading = ref<boolean>(false);
let tableData = ref([] as any); // 当前展示的列表数据
const searchData = ref<any>({
    paging: {
        pageNo: 1,
        limit: 5,
        totalCount: 0,
        totalPage: 0,
    },
});
let files = ref<any>();
let fileUploadRef = ref<HTMLInputElement | null>(null);
let errInfos = ref<string[]>([]);
const errDialogVisible = ref<boolean>(false);

// 获取列表数据
const getTableData = (groupIds?: any) => {
    isTableLoading.value = true;
    tableData.value = [];
    const params = JSON.parse(JSON.stringify(searchData.value));
    if (groupIds) {
        params.groupIds = groupIds;
    }
    searchGroupByPaging(params)
        .then((res: any) => {
            console.log('getTableData', res);
            tableData.value = res.data;
            searchData.value.paging = res.paging;
        })
        .catch((err: any) => {
            ElMessage.error(`error: ${err.message}`);
        })
        .finally(() => {
            isTableLoading.value = false;
        });
};

const exportExcel = async () => {
    const groups = await getGroupList({});
    let exportData: any[] = [];
    _.forEach(groups, (group: any) => {
        exportData.push({
            Name: group.groupName,
            Status: group.isEnabled === 1 ? 'Enable' : 'Disable',
            'Chute List': _.join(_.map(group.chuteList, 'chuteNo'), ','),
            'Drop-Off Points': _.join(group.dropOffPoints, ','),
        });
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
    saveAs(blob, 'GroupConfigurations.xlsx');
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
        errInfos.value = [];
        const allName: string[] = _.map(importData, 'Name');
        const duplicateNames: string[] = [];
        const groupByName = _.values(_.groupBy(allName, (o: string) => o));
        for (const names of groupByName) {
            if (_.size(names) > 1) {
                duplicateNames.push(names[0]);
            }
        }
        if (!_.isEmpty(duplicateNames)) {
            errInfos.value.push(`The group configuration have duplicate name. Ref: name=${JSON.stringify(duplicateNames)}`);
        }
        let allChuteNos: string[] = [];
        let allDropOffNos: string[] = [];
        for (const data of importData) {
            const curChuteNos = _.compact(_.split(data['Chute List'], ',')) || [];
            const curDropOffNos = _.compact(_.split(data['Drop-Off Points'], ',')) || [];
            allChuteNos = _.concat(allChuteNos, curChuteNos);
            allDropOffNos = _.concat(allDropOffNos, curDropOffNos);
        }
        const duplicateUseChuteNos: string[] = [];
        const groupByChuteNo = _.values(_.groupBy(allChuteNos, (o: string) => o));
        for (const chuteNos of groupByChuteNo) {
            if (_.size(chuteNos) > 1) {
                duplicateUseChuteNos.push(chuteNos[0]);
            }
        }
        if (!_.isEmpty(duplicateUseChuteNos)) {
            errInfos.value.push(`The group configuration have duplicate use chute. Ref: chute no=${JSON.stringify(duplicateUseChuteNos)}`);
        }
        const chutes = await getChuteListByChuteNoLike({
            chuteNoIn: allChuteNos,
            chuteTypeIn: [ChuteTypeEnum.ROUTE, ChuteTypeEnum.TERMINAL, ChuteTypeEnum.EXCEPTION],
        });
        const noExistChuteNos = _.difference(_.uniq(allChuteNos), _.map(chutes, 'chuteNo'));
        if (!_.isEmpty(noExistChuteNos)) {
            errInfos.value.push(`The group configuration have no exist chute. Ref: chute no=${JSON.stringify(noExistChuteNos)}`);
        }
        const dropOffNos = await getChuteListByChuteNoLike({
            chuteNoIn: allDropOffNos,
            chuteTypeIn: [ChuteTypeEnum.DROP_OFF],
        });
        const noExistDropOffNos = _.difference(_.uniq(allDropOffNos), _.map(dropOffNos, 'chuteNo'));
        if (!_.isEmpty(noExistDropOffNos)) {
            errInfos.value.push(`The group configuration have no exist drop-off point. Ref: drop-off no=${JSON.stringify(noExistDropOffNos)}`);
        }
        if (!_.isEmpty(errInfos.value)) {
            errDialogVisible.value = true;
            isTableLoading.value = false;
            files.value = [];
            return;
        }
        const groups = await getGroupList({ groupNameIn: allName });
        const groupMap = _.keyBy(groups, 'groupName');
        for (const data of importData) {
            const group = groupMap[data['Name']];
            let groupData: any = {
                groupName: data.Name,
                chuteNos: _.split(data['Chute List'], ','),
                dropOffPoints: data['Drop-Off Points'],
                isEnabled: _.eq(data.Status, 'Enable') ? 1 : 0,
            };
            if (!_.isEmpty(group)) {
                groupData.id = group.id;
            }
            await saveGroup(groupData);
        }
        searchData.value = {
            paging: {
                pageNo: 1,
                limit: 5,
                totalCount: 0,
                totalPage: 0,
            },
        };
        await getTableData();
        files.value = [];
        ElMessage.success('import success!');
    };
    await reader.readAsArrayBuffer(file);
};

const triggerFileUpload = () => {
    fileUploadRef.value?.click();
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
            deleteGroup(row)
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

const search = async () => {
    let groupIds;
    if (searchData.value.chuteNo) {
        const res = await getChuteListByChuteNoLike({ chuteNo: searchData.value.chuteNo, chuteTypeNotIn: [ChuteTypeEnum.DROP_OFF] });
        groupIds = _.map(res, 'groupId');
    }
    getTableData(groupIds);
};

const getDropOffOptions = async (query: string, cb: any) => {
    try {
        const res = await getChuteListByChuteNoLike({ chuteNo: query, chuteType: ChuteTypeEnum.DROP_OFF });
        cb(_.map(res, 'chuteNo') || []);
    } catch (err: any) {
        ElMessage.error(`error: ${err.message}`);
    }
};

const getChuteOptions = async (query: string, cb: any) => {
    try {
        const res = await getChuteListByChuteNoLike({ chuteNo: query, chuteTypeNotIn: [ChuteTypeEnum.DROP_OFF] });
        cb(_.map(res, 'chuteNo') || []);
    } catch (err: any) {
        ElMessage.error(`error: ${err.message}`);
    }
};

const selectChuteNo = (value: string) => {
    searchData.value.chuteNo = value;
};

const selectDropOffNo = (value: string) => {
    searchData.value.dropOffNo = value;
};

</script>
<style scoped>
.addBtn {
    text-align: left;
}

.gap-2 {
    margin: 2px;
}

.el-select {
    --el-select-width: 220px;
}

.el-input {
    --el-input-width: 220px;
}

.el-autocomplete {
    --el-autocomplete-width: 220px;
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
}

.flex-item {
    flex: 1;
    margin: 10px;
}

.width-220 {
    width: 220px;
}

.fill-white {
    flex: 1;
}
</style>
