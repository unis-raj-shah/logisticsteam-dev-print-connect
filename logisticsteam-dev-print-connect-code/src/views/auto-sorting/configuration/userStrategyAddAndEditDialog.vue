<template>
    <el-dialog
        v-model.sync="dialogVisible"
        :title="`${formType == 'add' ? 'Add' : 'Edit'} Strategy`"
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
            <div class="content">
                <div class="description">
                    <template v-if="ruleForm.strategyType === 'defaultStrategy'">
                        {{ruleForm.description}}
                    </template>
                    <el-input
                        v-else
                        type="textarea"
                        autosize
                        v-model="ruleForm.description"
                    />
                </div>
                <el-form-item label="Name" prop="strategyName">
                    <el-input
                        v-model="ruleForm.strategyName"
                    />
                </el-form-item>
                <div v-for="(param, key) of ruleForm.parameters" :key="key">
                    <el-form-item
                        :label="param.description"
                        :prop="`parameters.${key}.value`"
                        v-if="param.type === 'select'"
                    >
                        <el-select v-model="param.value" filterable placeholder=" ">
                            <el-option
                                v-for="item of param.options"
                                :key="typeof item === 'string' ? item : Object.keys(item)[0]"
                                :label="typeof item === 'string' ? item : Object.values(item)[0]"
                                :value="typeof item === 'string' ? item : Object.keys(item)[0]"
                            />
                        </el-select>
                    </el-form-item>
                    <el-form-item
                        :label="param.description"
                        :prop="`parameters.${key}.value`"
                        v-else-if="param.type === 'number'"
                    >
                        <el-input-number v-model="param.value" :min="1" controls-position="right" />
                    </el-form-item>
                    <el-form-item
                        :label="param.description"
                        :prop="`parameters.${key}.value`"
                        v-else-if="param.type === 'string'"
                    >
                        <el-input v-model="param.value" placeholder=" " />
                    </el-form-item>
                    <el-form-item
                        :label="param.description"
                        :prop="`parameters.${key}.value`"
                        v-else-if="param.type === 'intArray'"
                    >
                        <array-select v-model="param.value" :is-integer="true" />
                    </el-form-item>
                    <el-form-item
                        :label="param.description"
                        :prop="`parameters.${key}.value`"
                        v-else-if="param.type === 'stringArray'"
                    >
                        <array-select v-model="param.value" />
                    </el-form-item>
                    <el-form-item
                        :label="param.description"
                        :prop="`parameters.${key}.value`"
                        v-else-if="param.type === 'switch'"
                    >
                        <el-switch
                            v-model="param.value"
                            active-color="#13ce66"
                            inactive-color="#ff4949">
                        </el-switch>
                    </el-form-item>
                    <el-form-item
                        :label="param.description"
                        :prop="`parameters.${key}.value`"
                        v-else-if="param.type === 'chute-search-multiple-select'"
                    >
                        <el-select
                            v-model="param.value"
                            multiple
                            filterable
                            remote
                            reserve-keyword
                            :remote-method="(query) => getChuteOptions(query, key, param.type)"
                            :loading="param.loading">
                            <el-option
                                v-for="item of param.options"
                                :key="typeof item === 'string' ? item : Object.keys(item)[0]"
                                :label="typeof item === 'string' ? item : Object.values(item)[0]"
                                :value="typeof item === 'string' ? item : Object.keys(item)[0]"
                            />
                        </el-select>
                    </el-form-item>
                    <el-form-item
                        :label="param.description"
                        :prop="`parameters.${key}.value`"
                        v-else-if="param.type === 'relation-switch'"
                    >
                        <el-switch
                            v-model="param.value"
                            @change="relationSwitchChange"
                            active-color="#13ce66"
                            inactive-color="#ff4949">
                        </el-switch>
                    </el-form-item>
                    <template v-else-if="param.type === 'relation-number'">
                        <transition name="el-zoom-in-top">
                            <el-form-item
                                :label="param.description"
                                :prop="`parameters.${key}.value`"
                                v-show="ruleForm.parameters[param.supperKey].value"
                            >
                                <el-input-number v-model="param.value" :min="1" controls-position="right" />
                            </el-form-item>
                        </transition>
                    </template>
                    <div v-else>
                        {{ param }}
                    </div>
                </div>
            </div>
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
import { saveUserStrategy, getChuteListByChuteNoLike } from '@/db/autoSorting';
import { UserStrategyTypeEnum } from '@/constants/autoSortingConstants';
import strategyService from '@/service/autoSortingStrategyService';
import ArraySelect from '@/components/array-select.vue';
import strategies from '@/models/sorting-strategy/index';
import _ from 'lodash';

const dialogVisible = ref(false);
const ruleFormRef = ref<FormInstance>();
const formType = ref('');
const emit = defineEmits(['reloadTable']);

let saveLoading = ref(false);
let inputString = ref('');

interface RuleForm {
    id?: number;
    strategyName: string;
    strategyType: string;
    displayName: string;
    description: string;
    parameters?: any;
}

// 初始化 ruleForm 对象
const initialRuleForm = {
    id: 0,
    strategyType: '',
    strategyName: '',
    description: '',
    displayName: '',
    parameters: {},
};

let ruleForm = reactive<RuleForm>(_.cloneDeep(initialRuleForm));

let rules = reactive({
    strategyName: [{ required: true, message: 'Please input Name', trigger: 'change' }]
});

const handleShow = (row: RuleForm, type: string) => {
    dialogVisible.value = true;
    formType.value = type;
    // 初始化的时候重置表单
    resetForm(ruleFormRef.value);
    // 等待dom渲染完毕填充数据
    nextTick(() => {
        if (row) {
            Object.assign(ruleForm, _.cloneDeep(initialRuleForm));
            delete ruleForm.id;
            ruleForm = Object.assign(ruleForm, _.cloneDeep(toRaw(row)));
            handleStrategyChange(ruleForm.strategyType);
            console.log('rules', rules);
        }
    });
};

const initRules = () => {
    for (const key in ruleForm.parameters) {
        const curPar = ruleForm.parameters[key];
        const isRequired = _.get(curPar, 'required');
        const isRelationNumber = _.eq(_.get(curPar, 'type'), 'relation-number');
        const supperKeyValue = _.get(ruleForm.parameters, [_.get(curPar, 'supperKey'), 'value']);

        if (isRequired && (!isRelationNumber || (isRelationNumber && supperKeyValue))) {
            _.set(rules, `parameters.${key}.value`, [
                { required: true, message: 'Required.', trigger: 'change' },
            ]);
        } else {
            _.unset(rules, `parameters.${key}.value`);
        }
    }
};

const handleStrategyChange = (value: string) => {
    console.log('handleStrategyChange', value);
    if (_.isEmpty(value)) {
        value = UserStrategyTypeEnum.MANUAL_CHUTE_STRATEGY;
        const strategy = strategies[value];
        ruleForm.strategyType = strategy.strategyType;
        ruleForm.displayName = strategy.displayName;
        ruleForm.description = strategy.description;
        ruleForm.parameters = strategyService.getUserParamsAll({}, strategy.parameters);
    }
    initRules();
};

const submitForm = async (formEl: FormInstance | undefined) => {
    if (!formEl) return;
    await formEl.validate((valid, fields) => {
        if (valid) {
            saveLoading.value = true;
            const userStrategy = toRaw(ruleForm);
            userStrategy.parameters = strategyService.getUserStrategyParams(
                userStrategy.parameters
            );
            console.log(' save userStrategy', userStrategy);
            saveUserStrategy(userStrategy)
                .then(() => {
                    ElMessage.success('Save Success');
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
    });
};

const resetForm = (formEl: FormInstance | undefined) => {
    if (!formEl) return;
    formEl.resetFields();
};

const getChuteOptions = async (query: string, key: string, type: string) => {
    try {
        ruleForm.parameters[key].loading = true;
        let curDesc = ruleForm.parameters[key].description;
        let optionsNotIn: string[] = [];
        _.forEach(_.values(ruleForm.parameters), (parameter: any) => {
            if (!_.eq(parameter.description, curDesc) && _.eq(parameter.type, type)) {
                optionsNotIn = _.concat(optionsNotIn, parameter.value);
            }
        });
        let res;
        res = await getChuteListByChuteNoLike({ chuteNo: query });
        let chuteNos = _.map(res, 'chuteNo') || [];
        ruleForm.parameters[key].options = _.difference(chuteNos, optionsNotIn);
    } catch (err: any) {
        ElMessage.error(`error: ${err.message}`);
    } finally {
        ruleForm.parameters[key].loading = false;
    }
};

const relationSwitchChange = (value: boolean) => {
    console.log('relationSwitchChange', value);
    initRules();
};

defineExpose<{
    handleShow: (row: RuleForm, type: string) => void;
}>({
    handleShow,
});
</script>
<style scoped>
.content {
    max-height: 500px;
    overflow-y: auto;
}
.description {
    border: #79bbff 1px solid;
    margin-bottom: 18px;
    padding: 10px;
}
</style>
