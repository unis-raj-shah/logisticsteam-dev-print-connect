<template>
    <el-dialog
        v-model.sync="dialogVisible"
        :title="`${formType === 'add' ? 'Add New' : 'Edit'} Chute Allocation`"
        width="40%"
        :close-on-click-modal="false"
    >
        <el-form
            ref="ruleFormRef"
            :rules="rules"
            label-width="auto"
            :model="ruleForm"
            class="table-from"
        >
            <el-form-item label="Name" prop="routeName">
                <el-input
                    v-model="ruleForm.routeName"
                    style="width: 240px"
                />
            </el-form-item>
            <el-form-item label="Type" prop="type">
                <el-select
                    v-model="ruleForm.type"
                    style="width: 200px"
                >
                    <el-option
                        v-for="item in getOptions('chuteAllocationTypeEnum')"
                        :key="item.label"
                        :label="item.label"
                        :value="item.label"
                    ></el-option>
                </el-select>
            </el-form-item>
            <el-form-item label="Chute No" prop="fixedChuteNos">
                <el-select
                    v-model="ruleForm.fixedChuteNos"
                    multiple
                    filterable
                    remote
                    reserve-keyword
                    placeholder="Please select chute no"
                    @change="fixedChuteNosIsEmpty"
                    :remote-method="getChuteOptions"
                    :loading="chuteNoSearchLoading">
                    <el-option
                        v-for="item in chuteNoList"
                        :key="item"
                        :label="item"
                        :value="item">
                    </el-option>
                </el-select>
            </el-form-item>
            <el-form-item label="Chute Needed" prop="isChuteNeeded">
                <el-switch
                    v-model="ruleForm.isChuteNeeded"
                    active-color="#13ce66"
                    inactive-color="#ff4949"
                    :disabled="!_.isEmpty(ruleForm.fixedChuteNos)"
                    :active-value="1"
                    :inactive-value="0">
                </el-switch>
            </el-form-item>
            <el-row style="justify-content: flex-end;">
                <el-button @click="dialogVisible = false">Cancel</el-button>
                <el-button type="primary" :loading="saveLoading" @click="submitForm(ruleFormRef)">
                    Save
                </el-button>
            </el-row>
        </el-form>
    </el-dialog>
</template>

<script lang="ts" setup>
import { reactive, ref, nextTick, toRaw } from 'vue';
import { FormInstance, ElMessage } from 'element-plus';
import { getOptions } from '@/apis/selectData';
import {
    getChuteListByChuteNoLike,
    saveChuteAllocation,
    validateRouteNameExist,
    searchChuteAllocationList,
} from '@/db/autoSorting';
import { ipcRenderer } from 'electron';
import { ChuteAllocationTypeEnum } from '@/constants/autoSortingConstants';
import _ from 'lodash';

const dialogVisible = ref(false);
const ruleFormRef = ref<FormInstance>();
const emit = defineEmits(['reloadTable']);

const saveLoading = ref(false);
const formType = ref('add');
const chuteNoList = ref([]);
const chuteNoSearchLoading = ref(false);

interface RuleForm {
    id?: number;
    routeName: string;
    type: ChuteAllocationTypeEnum;
    fixedChuteNos: any;
    isChuteNeeded: number;
}

let ruleForm = reactive<RuleForm>({
    id: 0,
    routeName: '',
    type: ChuteAllocationTypeEnum.ROUTE,
    fixedChuteNos: [],
    isChuteNeeded: 0,
});
console.log('ruleForm', ruleForm);

let rules = reactive({
    routeName: [{ required: true, message: 'Please input route name', trigger: 'blur' }],
    type: [{ required: true, message: 'Please select type', trigger: 'change' }],
});
const handleShow = (type: string, row: any) => {
    dialogVisible.value = true;
    // 初始化的时候重置表单
    resetForm(ruleFormRef.value);
    // 等待dom渲染完毕填充数据
    nextTick(() => {
        // 判断是否是添加或者编辑
        formType.value = type;
        if (row) {
            ruleForm = Object.assign(ruleForm, row);
        }
    });
};

const submitForm = async (formEl: FormInstance | undefined) => {
    if (!formEl) return;
    await formEl.validate(async (valid, fields) => {
        if (valid) {
            saveLoading.value = true;
            let chuteAllocationData = toRaw(ruleForm);
            if (_.isEmpty(chuteAllocationData.fixedChuteNos)) {
                chuteAllocationData.fixedChuteNos = null;
            } else {
                chuteAllocationData.fixedChuteNos = JSON.stringify(chuteAllocationData.fixedChuteNos);
            }
            let successInfo = 'Update Success';
            if (_.eq(formType.value, 'add')) {
                successInfo = 'Add Success';
                delete chuteAllocationData.id;
            }
            validateRouteNameExist(chuteAllocationData.routeName, chuteAllocationData.id)
                .then((res) => {
                    if (!_.isEmpty(res)) {
                        ElMessage.error('The chute allocation route name already exist');
                        saveLoading.value = false;
                        return;
                    }
                    saveChuteAllocation(chuteAllocationData)
                        .then(() => {
                            ElMessage.success(successInfo);
                            dialogVisible.value = false;
                            emit('reloadTable');
                            ipcRenderer.invoke('auto-sorting-main-message', 'refreshChuteInfoList');
                        })
                        .catch((err: any) => {
                            ElMessage.error(`error: ${err.message}`);
                        })
                        .finally(() => {
                            saveLoading.value = false;
                        });
                })
                .catch((err: any) => {
                    ElMessage.error(`error: ${err.message}`);
                    saveLoading.value = false;
                });
        }
    });
};

const resetForm = (formEl: FormInstance | undefined) => {
    if (!formEl) return;
    formEl.resetFields();
};

const getChuteOptions = async (query: string) => {
    try {
        chuteNoSearchLoading.value = true;
        let chuteAllocations = await searchChuteAllocationList({ type: ruleForm.type });
        let chuteNos: string[] = [];
        for (let chuteAllocation of chuteAllocations) {
            if (_.eq(chuteAllocation.id, ruleForm.id)) continue;
            chuteAllocation.fixedChuteNos = JSON.parse(chuteAllocation.fixedChuteNos) || [];
            chuteNos = _.concat(chuteNos, chuteAllocation.fixedChuteNos);
        }
        let res = await getChuteListByChuteNoLike({
            chuteNo: query,
            chuteType: ruleForm.type,
            chuteNoNotIn: chuteNos,
        });
        chuteNoList.value = _.map(res, 'chuteNo') || [];
    } catch (err: any) {
        ElMessage.error(`error: ${err.message}`);
    } finally {
        chuteNoSearchLoading.value = false;
    }
};

const fixedChuteNosIsEmpty = () => {
    if (!_.isEmpty(ruleForm.fixedChuteNos)) {
        ruleForm.isChuteNeeded = 1;
    }
};

defineExpose({
    handleShow,
});
</script>
<style lang="scss" scoped></style>
