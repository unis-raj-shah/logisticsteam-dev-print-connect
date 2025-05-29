<template>
    <div
        :class="{ hidden: hidden || total === 0 }"
        class="flex flex-row justify-between mt-[10px] mb-[10px]"
    >
        <span class="leading-8 text-gray-300">{{ total }} Results</span>
        <div class="flex flex-row justify-between">
            <span class="leading-8 px-3 font-bold">Show:</span>
            <el-select
                :teleported="teleported"
                v-model="_limit"
                placeholder="Select"
                class="w-20 mr-5"
                @change="handleSizeChange"
            >
                <el-option
                    v-for="(item, index) in pageSizes"
                    :key="index"
                    :label="item"
                    :value="item"
                />
            </el-select>
            <el-pagination
                :background="background"
                :layout="layout"
                :page-sizes="pageSizes"
                :total="total"
                v-bind="$attrs"
                v-model:current-page="_page"
                v-model:page-size="_limit"
                @current-change="handleCurrentChange"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watchEffect, toRefs } from 'vue';
import type { PaginationData } from './types.d.ts';
import _ from 'lodash';

const props = defineProps({
    total: {
        required: true,
        type: Number,
    },
    page: {
        type: Number,
        default: 1,
    },
    teleported: {
        type: Boolean,
        default: true,
    },
    limit: {
        type: Number,
        default: 10,
    },
    pageSizes: {
        type: Array as () => number[],
        default() {
            return [10, 20, 50, 100, 300, 500, 1000];
        },
    },
    layout: {
        type: String,
        default: 'prev, pager, next, jumper',
    },
    background: {
        type: Boolean,
        default: true,
    },
    hidden: {
        type: Boolean,
        default: false,
    },
    // 分片列表
    sliceList: {
        type: Array,
        default: () => [],
    },
    // 所有列表数据
    allList: {
        type: Array,
        default: () => [],
    },
    // 是否初始化触发pagination事件
    initPagination: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(['update:page', 'update:limit', 'update:sliceList', 'pagination']);

const _page = computed({
    get() {
        return props.page;
    },
    set(val) {
        emit('update:page', val);
    },
});

const _limit = computed({
    get() {
        return props.limit;
    },
    set(val) {
        emit('update:limit', val);
    },
});

const sliceList = computed({
    get() {
        return props.sliceList;
    },
    set(val) {
        emit('update:sliceList', val);
    },
});

// 初始化列表切片起始坐标
let start = computed(() => {
    return (_page.value - 1) * _limit.value;
});
let end = computed(() => {
    const val =
        (_limit.value * _page.value > props.total ? props.total : _limit.value * _page.value) - 1;
    return val || 0;
});

// 判断是否触发分页事件初始化
props.initPagination && handleCurrentChange(1);

// 监听列表数据的初始化传入及页码的变动，进行分片处理
const { allList } = toRefs(props);
watchEffect(() => {
    sliceList.value = _.slice(allList.value, start.value, Number(end.value) + 1) || [];
});

// 分页大小改变
function handleSizeChange(val: number) {
    // 更新分页大小
    _limit.value = val;
    // 初始化分页数触发分页数点击
    _page.value = 1;
    nextTick(() => {
        handleCurrentChange(_page.value);
    });
}

// 分页数改变
function handleCurrentChange(val: number) {
    // 更新分页数
    _page.value = val;
    nextTick(() => {
        emit('pagination', {
            page: val,
            limit: _limit.value,
            start: start.value,
            end: end.value,
            sliceList: sliceList.value,
        } as PaginationData);
    });
}
</script>

<style scoped>
.flex {
    display: flex;
}

.flex-row {
    flex-direction: row;
}

.justify-between {
    justify-content: space-between;
}

.leading-8 {
    line-height: 2rem;
}

.px-3 {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
}

.mt-\[10px\] {
    margin-top: 10px;
}

.mb-\[10px\] {
    margin-bottom: 10px;
}

.w-20 {
    width: 5rem;
}
</style>
