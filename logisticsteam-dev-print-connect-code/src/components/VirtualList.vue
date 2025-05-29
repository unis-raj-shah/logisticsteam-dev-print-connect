<template>
  <div class="virtual-list" ref="scrollContainer" @scroll="onScroll">
    <div :style="{ height: `${totalHeight}px` }"></div>
    <div
      v-for="item in visibleItems"
      :key="item.id"
      class="virtual-item"
      :style="{ transform: `translateY(${item.translateY}px)` }"
    >
      {{ item.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, defineProps } from 'vue';

interface Item {
  id: number;
  text: string;
  translateY?: number;
}

const props = defineProps<{
  items: Item[];
  itemHeight?: number;
  buffer?: number;
}>();

const itemHeight = props.itemHeight || 50;
const buffer = props.buffer || 5;

const scrollContainer = ref<HTMLDivElement | null>(null);
const totalHeight = ref(props.items.length * itemHeight);
const visibleItems = ref<Item[]>([]);
const startIndex = ref(0);
const endIndex = ref(0);

const updateVisibleItems = () => {
  if (scrollContainer.value) {
    const scrollTop = scrollContainer.value.scrollTop;
    startIndex.value = Math.floor(scrollTop / itemHeight);
    endIndex.value = Math.min(
      props.items.length,
      startIndex.value + Math.ceil(scrollContainer.value.clientHeight / itemHeight) + buffer
    );

    visibleItems.value = props.items.slice(startIndex.value, endIndex.value).map((item, index) => ({
      ...item,
      translateY: (startIndex.value + index) * itemHeight,
    }));
  }
};

const onScroll = () => {
  updateVisibleItems();
};

watch(() => props.items, () => {
  updateVisibleItems();
});

onMounted(() => {
  updateVisibleItems();
});
</script>

<style scoped>
.virtual-list {
  height: 400px;
  overflow-y: auto;
  border: 1px solid #ccc;
  position: relative;
}

.virtual-item {
  width: 100%;
  box-sizing: border-box;
  position: absolute;
  left: 0;
  right: 0;
}
</style>
