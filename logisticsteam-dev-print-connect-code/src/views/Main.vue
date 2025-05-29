<template>
  <div class="main">
    <el-container class="main-content">
      <el-container class="page">
        <el-header>
          <el-menu
            :default-active="activeIndex"
            class="el-menu-demo"
            mode="horizontal"
            @select="handleSelect"
          >
            <el-sub-menu index="3">
              <template #title
                >{{ userInfo.firstName }} {{ userInfo.lastName }}</template
              >
              <el-menu-item index="3-1" @click="loginOut()"
                >Login out</el-menu-item
              >
            </el-sub-menu>

            <el-sub-menu index="2">
              <template #title
                >Facility: {{ companyFacility.facility.name }}</template
              >
              <template
                style="max-height: 500px; overflow: auto; display: block"
              >
                <el-menu-item
                  @click="changeFacility(assignedCompanyFacilities)"
                  v-for="(
                    assignedCompanyFacilities, index
                  ) in assignedCompanyFacilities"
                  :key="assignedCompanyFacilities.facilityId"
                  :index="'2-' + index"
                >
                  Facility:
                  {{ assignedCompanyFacilities.facility.name }}</el-menu-item
                >
              </template>
            </el-sub-menu>

            <el-sub-menu index="1">
              <template #title> {{ currentDateTime }}</template>
            </el-sub-menu>
          </el-menu>
        </el-header>
        <el-main class="page-content">
          <router-view v-if="isRouterAlive"></router-view>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, toRefs, onMounted } from "vue";
import cache from "../shared/cache";
import _ from "lodash";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";

export default defineComponent({
  name: "Main",
  setup() {
    const router = useRouter();
    const loginOut = () => {
      cache.clearCache();
      router.push("/");
    };
    let state = reactive({
      companyFacility: cache.getCache("companyFacility"),
      assignedCompanyFacilities: cache.getCache("assignedCompanyFacilities"),
      userInfo: cache.getCache("userInfo"),
      isRouterAlive: ref(true),
      currentDateTime: new Date(),
    });
    const changeFacility = (assignedCompanyFacilities: any) => {
      cache.setCache("companyFacility", assignedCompanyFacilities);
      state.companyFacility = assignedCompanyFacilities;
      state.isRouterAlive = false;
      setTimeout(function () {
        state.isRouterAlive = true;
      }, 1);
    };

    setInterval(function () {
      state.currentDateTime = new Date();
    }, 1000);

    const open4 = () => {
      ElMessage.error("Oops, this is a error message.");
    };
    onMounted(() => {
      open4();
    });

    return {
      loginOut,
      ...toRefs(state),
      changeFacility,
    };
  },
});
</script>

<style scoped>
.main {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.main-content,
.page {
  height: 100%;
}
.page-header {
  padding: 0px;
}
.page-content {
  height: calc(100% - 48px);
}

.el-header,
.el-footer {
  /* display: flex; */
  color: #333;
  text-align: center;
  align-items: center;
}

.el-header {
  height: 60px !important;
}

.el-aside {
  overflow-x: hidden;
  overflow-y: auto;
  line-height: 200px;
  text-align: left;
  cursor: pointer;
  background-color: #001529;
  transition: width 0.3s linear;
  scrollbar-width: none; /* firefox */
  -ms-overflow-style: none; /* IE 10+ */
}

.el-main {
  color: #333;
  background-color: #f0f2f5;
}

.el-menu--horizontal {
  height: 60px;
  width: 100%;
  display: block;
}
.el-sub-menu {
  float: right;
}

.el-popper .el-menu--horizontal {
  overflow: auto;
  max-height: 500px;
}
</style>
