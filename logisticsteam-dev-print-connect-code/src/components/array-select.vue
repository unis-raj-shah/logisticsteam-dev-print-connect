<template>
    <el-select
        v-model="model"
        multiple
        filterable
        allow-create
        :placeholder="placeholder"
        default-first-option
        :reserve-keyword="false"
        no-data-text=" "
        @change="handleSelectChange"
    />
</template>
<script setup lang="ts">
import _ from 'lodash';

const props = withDefaults(
    defineProps<{
        placeholder?: string;
        isInteger?: boolean;
    }>(),
    {
        placeholder: 'input and press enter',
        isInteger: false,
    }
);

const model = defineModel();
const handleSelectChange = (selectedItems: any) => {
    if (!props.isInteger) return;
    _.remove(selectedItems, (item: string) => isNaN(parseInt(item)));
    _.forEach(
        selectedItems,
        (item: string, index: string | number, array: { [x: string]: number }) => {
            array[index] = parseInt(item);
        }
    );
};
</script>
<style scoped></style>
