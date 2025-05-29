<template>
    <el-dialog v-model.sync="dialogVisible" :title="`${formType === 'add' ? 'Add New' : 'Edit'} Group`" width="40%"
        :close-on-click-modal="false">
        <el-form ref="ruleFormRef" :rules="rules" label-width="auto" :model="ruleForm" class="table-from">
            <el-form-item label="Group Name" prop="groupName">
                <el-input v-model="ruleForm.groupName" style="width: 240px" />
            </el-form-item>
            <el-form-item label="Enabled/Disabled" prop="isEnabled" v-if="formType != 'add'">
                <el-switch v-model="ruleForm.isEnabled" size="large" :active-value="1" :inactive-value="0" />
            </el-form-item>
            <el-form-item label="Drop-off point" prop="dropOffPoints">
                <el-select v-model="ruleForm.dropOffPoints" multiple placeholder="Select drop-Off Point">
                    <el-option v-for="item in dropOffPoints" :key="item" :label="item" :value="item" />
                </el-select>
            </el-form-item>
            <el-form-item label="Chute List" prop="chuteNos">
                <el-select v-model="ruleForm.chuteNos" multiple placeholder="Select Chute" filterable>
                    <el-option-group v-for="group in options" :key="group.label" :label="group.label">
                        <el-option v-for="item in group.options" :key="item.value" :label="item.label"
                            :value="item.value" />
                    </el-option-group>
                </el-select>
            </el-form-item>
            <el-form-item>
                <div class="center-content">
                    <el-button @click="dialogVisible = false">Cancel</el-button>
                    <el-button type="primary" :loading="saveLoading" @click="submitForm(ruleFormRef)">
                        Save
                    </el-button>
                </div>
            </el-form-item>
        </el-form>
    </el-dialog>
</template>

<script lang="ts" setup>
import { reactive, ref, nextTick, onMounted, computed, toRaw, watch } from 'vue';
import { FormInstance, ElMessage } from 'element-plus';
import { saveGroup, getChuteGroupList } from '@/db/autoSorting';
import _ from 'lodash';

const dialogVisible = ref(false);
const ruleFormRef = ref<FormInstance>();
const emit = defineEmits(['reloadTable']);

let saveLoading = ref(false);
let formType = ref('add');
let options = ref<any>([]);
let dropOffPoints = ref<any>([]);

interface RuleForm {
    id?: number;
    groupName: string;
    chuteNos: any;
    dropOffPoints: any;
    isEnabled: number;
}

let ruleForm = reactive<RuleForm>({
    id: 0,
    groupName: '',
    chuteNos: [],
    dropOffPoints: [],
    isEnabled: 1
});
console.log('ruleForm', ruleForm);

let rules = reactive({
    groupName: [{ required: true, message: 'Required', trigger: 'change' }],
    chuteNos: [{ required: false, message: 'Required', trigger: 'change' }],
});

const handleShow = (row: any, type: string) => {
    dialogVisible.value = true;
    // 初始化的时候重置表单
    resetForm(ruleFormRef.value);
    // 等待dom渲染完毕填充数据
    nextTick(() => {
        // 判断是否是添加或者编辑
        formType.value = type;
        if (row) {
            ruleForm.id = row.id;
            ruleForm.groupName = row.groupName;
            ruleForm.chuteNos = _.map(row.chuteList, 'chuteNo');
            ruleForm.dropOffPoints = !_.isEmpty(row.dropOffPoints) ? row.dropOffPoints : [];
            ruleForm.isEnabled = row.isEnabled;
            getChuteGroupList()
                .then((res: any) => {
                    options.value = [];
                    dropOffPoints.value = [];
                    const chuteListGroup = _.groupBy(res, 'groupName');
                    console.log('chuteListGroup', chuteListGroup);
                    for (const key in chuteListGroup) {
                        if (_.has(chuteListGroup, key)) {
                            const group = _.filter(chuteListGroup[key], (item: any) => { return item.chuteType != 'Drop-off' })
                            const groupOptions = group.map((o: any) => ({
                                value: o.chuteNo,
                                label: o.chuteNo,
                            }));
                            options.value.push({
                                label: !key || key === 'null' ? 'No Group' : key,
                                options: groupOptions,
                            });
                        }
                    }
                    dropOffPoints.value = _.map(_.filter(res, (item: any) => { return item.chuteType == 'Drop-off' }), "chuteNo");
                })
                .catch((err: any) => {
                    ElMessage.error(`error: ${err.message}`);
                });
        }
    });
};

const submitForm = async (formEl: FormInstance | undefined) => {
    if (!formEl) return;
    await formEl.validate((valid, fields) => {
        if (valid) {
            saveLoading.value = true;
            const groupData = toRaw(ruleForm);
            groupData.dropOffPoints = groupData.dropOffPoints ? groupData.dropOffPoints.join(",") : "";
            // 编辑
            if (formType.value === 'edit') {
                console.log(' edit ', groupData);
                saveGroup(groupData)
                    .then(() => {
                        ElMessage.success('Update Success');
                        dialogVisible.value = false;
                        emit('reloadTable');
                    })
                    .catch((err: any) => {
                        ElMessage.error(`error: ${err.message}`);
                    })
                    .finally(() => {
                        saveLoading.value = false;
                    });
            } else {
                // 新增
                delete groupData.id;
                groupData.isEnabled = 1;
                console.log(' add ', groupData);
                saveGroup(groupData)
                    .then(() => {
                        ElMessage.success('Add Success');
                        dialogVisible.value = false;
                        emit('reloadTable');
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
<style scoped>
.center-content {
    width: 100%;
    display: flex;
    justify-content: center;
}
</style>
