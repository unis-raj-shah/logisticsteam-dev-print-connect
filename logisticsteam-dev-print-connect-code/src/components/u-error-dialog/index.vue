<template>
    <el-dialog v-model.sync="localErrDialogVisible" class="err-info-dialog">
        <template v-slot:title>
            <div class="err-info-title">{{ dialogName }}</div>
        </template>
        <el-table :data="errInfos" class="hidden-header-table">
            <el-table-column>
                <template #default="{ row }">
                    {{ row }}
                </template>
            </el-table-column>
        </el-table>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps({
    errInfos: {
        type: Array as () => string[],
        default: () => [],
    },
    errDialogVisible: {
        type: Boolean,
        required: true,
    },
    dialogName: {
        type: String,
        default: 'ERROR INFO',
    },
});

const localErrDialogVisible = ref(props.errDialogVisible);

const emit = defineEmits(['update:errDialogVisible']);

watch(
    () => props.errDialogVisible,
    (newValue) => (localErrDialogVisible.value = newValue)
);

watch(localErrDialogVisible, (newValue) => {
    if (newValue !== props.errDialogVisible) {
        emit('update:errDialogVisible', newValue);
    }
});
</script>

<style>
.err-info-dialog {
    height: 70%;
    display: flex;
    flex-direction: column;
}

.err-info-title {
    color: red;
    font-size: 20px;
    font-weight: bold;
}

.err-info-dialog .el-dialog__body {
    overflow-y: auto;
}

.hidden-header-table >>> .el-table__header-wrapper {
    display: none;
}
</style>
