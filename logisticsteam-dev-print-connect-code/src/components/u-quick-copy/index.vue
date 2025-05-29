<template>
    <el-tooltip :content="copyStringView" placement="top-start">
        <a @click="copy" @mouseout="onmouseout">
            <i class="fa fa-files-o"></i>
        </a>
    </el-tooltip>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const copyStringView = ref<string>('');

const props = defineProps({
    copyString: {
        type: String,
    },
});

const copy = () => {
    var copyElement = document.createElement('textarea');
    copyElement.style.position = 'fixed';
    copyElement.style.opacity = '0';
    copyElement.textContent = props.copyString || '';
    var body = document.getElementsByTagName('body')[0];
    body.appendChild(copyElement);
    copyElement.select();
    document.execCommand('copy');
    body.removeChild(copyElement);
    copyStringView.value = 'Copied.';
};

const onmouseout = () => {
    copyStringView.value = props.copyString || '';
};
</script>

<style scoped>

</style>
