<template>
    <el-dialog
        v-model.sync="dialogVisible"
        :title="`${formType === 'add' ? 'Add New' : 'Edit'} Chute`"
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
            <el-form-item label="Chute No" prop="chuteNo">
                <el-input
                    v-model="ruleForm.chuteNo"
                    style="width: 240px"
                    :disabled="formType !== 'add'"
                />
            </el-form-item>
            <el-form-item label="Enabled/Disabled" prop="isEnabled" v-if="formType !== 'add'">
                <el-switch
                    v-model="ruleForm.isEnabled"
                    size="large"
                    :active-value="1"
                    :inactive-value="0"
                />
            </el-form-item>
            <el-form-item label="Chute Type" prop="chuteType">
                <el-select
                    v-model="ruleForm.chuteType"
                    style="width: 200px"
                >
                    <el-option
                        v-for="item in getOptions('chuteTypeEnum')"
                        :key="item.label"
                        :label="item.label"
                        :value="item.label"
                    ></el-option>
                </el-select>
            </el-form-item>
            <el-form-item class="table-button float-right">
                <el-button @click="dialogVisible = false">Cancel</el-button>
                <el-button type="primary" :loading="saveLoading" @click="submitForm(ruleFormRef)">
                    Save
                </el-button>
            </el-form-item>
        </el-form>
    </el-dialog>
</template>

<script lang="ts" setup>
import { reactive, ref, nextTick, toRaw } from 'vue';
import { FormInstance, ElMessage } from 'element-plus';
import { getOptions } from '@/apis/selectData';
import { saveChute, getGroupList } from '@/db/autoSorting';
import _ from 'lodash';
import { ipcRenderer } from 'electron';
import { ChuteTypeEnum } from '@/constants/autoSortingConstants';

const dialogVisible = ref(false);
const ruleFormRef = ref<FormInstance>();
const emit = defineEmits(['reloadTable']);

const saveLoading = ref(false);
const formType = ref('add');
const groupList = ref<any>([]);

interface RuleForm {
    id?: number;
    chuteNo: string;
    isEnabled: number;
    chuteType: ChuteTypeEnum;
    assignableCondition: any;
    conditionValue: any,
    platform: string;
}

let ruleForm = reactive<RuleForm>({
    id: 0,
    chuteNo: '',
    isEnabled: 1,
    chuteType: ChuteTypeEnum.ROUTE,
    assignableCondition: null,
    conditionValue: null,
    platform: '',
});
console.log('ruleForm', ruleForm);

let rules = reactive({
    chuteNo: [{ required: true, message: 'Please input chute name', trigger: 'change' }],
    isEnabled: [{ required: true, message: 'Please input is Enabled', trigger: 'change' }],
    chuteType: [{ required: true, message: 'Please select chute type', trigger: 'change' }],
});
const handleShow = (type: string, platform: string, row: any) => {
    dialogVisible.value = true;
    // 初始化的时候重置表单
    resetForm(ruleFormRef.value);
    // 等待dom渲染完毕填充数据
    nextTick(() => {
        // 判断是否是添加或者编辑
        formType.value = type;
        ruleForm.platform = platform;
        if (row) {
            ruleForm = Object.assign(ruleForm, row);
        }
        _.unset(ruleForm, 'groupName');
        getGroupList().then((res) => {
            groupList.value = res;
        });
    });
};

const submitForm = async (formEl: FormInstance | undefined) => {
    if (!formEl) return;
    await formEl.validate((valid, fields) => {
        if (valid) {
            saveLoading.value = true;
            const chuteData = toRaw(ruleForm);
            // 编辑
            if (formType.value === 'edit') {
                console.log(' edit ', chuteData);
                saveChute(chuteData, chuteData.id)
                    .then(() => {
                        ElMessage.success('Update Success');
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
            } else {
                // 新增
                delete chuteData.id;
                chuteData.isEnabled = 1;
                console.log(' add ', chuteData);
                saveChute(chuteData)
                    .then(() => {
                        ElMessage.success('Add Success');
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
            }
        }
    });
};

const resetForm = (formEl: FormInstance | undefined) => {
    if (!formEl) return;
    formEl.resetFields();
};

defineExpose({
    handleShow,
});
</script>
<style lang="scss" scoped></style>
