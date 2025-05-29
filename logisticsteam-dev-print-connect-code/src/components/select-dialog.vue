<template>
    <el-dialog
        v-model.sync="dialogVisible"
        :title="title"
        width="40%"
        :close-on-click-modal="false"
    >
        <el-form
            ref="ruleFormRef"
            :model="ruleForm"
            :rules="rules"
            label-width="auto"
            class="table-from"
        >
            <el-form-item :label="label" prop="selectedValue">
                <el-select v-model="ruleForm.selectedValue" filterable placeholder=" ">
                    <el-option
                        v-for="item of options"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                    />
                </el-select>
            </el-form-item>
            <el-form-item class="table-button">
                <el-button @click="dialogVisible = false">Cancel</el-button>
                <el-button type="primary" :loading="saveLoading" @click="submitForm(ruleFormRef)">
                    Save
                </el-button>
            </el-form-item>
        </el-form>
    </el-dialog>
</template>

<script lang="ts" setup>
import { reactive, ref, toRaw } from 'vue';
import { ElMessage, FormInstance } from 'element-plus';

const dialogVisible = ref(false);
let saveLoading = ref(false);
const emit = defineEmits(['afterConfirm']);
let ruleFormRef = ref<FormInstance>();
let ruleForm = ref({
    selectedValue: [],
});
const rules = reactive({
    selectedValue: [{ required: true, message: 'Required', trigger: 'change' }],
});

const props = withDefaults(
    defineProps<{
        title: string;
        label?: string;
        isInteger?: boolean;
        successMessage?: string;
        options: any;
        confirmFunction: (value: any) => any;
    }>(),
    {
        title: 'DiaLog',
        label: ' ',
        successMessage: 'Update Success',
        options: [],
        isInteger: false,
    }
);

const handleShow = (value: any) => {
    console.log('handleShow', value);
    dialogVisible.value = true;
    ruleForm.value.selectedValue = value;
};

const submitForm = async (formEl: FormInstance | undefined) => {
    if (!formEl) return;
    await formEl.validate((valid, fields) => {
        if (valid) {
            saveLoading.value = true;
            props
                .confirmFunction(toRaw(ruleForm.value.selectedValue))
                .then((res: any) => {
                    ElMessage.success(props.successMessage);
                    dialogVisible.value = false;
                    emit('afterConfirm');
                })
                .catch((err: any) => {
                    ElMessage.error(`error: ${err.message}`);
                })
                .finally(() => {
                    saveLoading.value = false;
                });
        }
    });
};

defineExpose<{
    handleShow: (value: any) => void;
}>({
    handleShow,
});
</script>
<style scoped>
.table-button {
    margin-top: 35px;
}
</style>
