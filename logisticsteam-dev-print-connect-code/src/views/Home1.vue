<template>
  <div class="container-fluid">
    <div class="row">
      <div class="col-md-6">
        <!-- <el-input
          v-model="input2"
          class="w-50 m-2"
          placeholder="Type something"
        /> -->
        <a @click="robotForkliftSettingView">Robot Forklift Setting</a>
      </div>
      <div class="col-md-12">
        <div class="row">
          <div class="col-md-4" style="display: flex">
            <div
              class="redCircle"
              style="margin-left: 10px; margin-right: 5px"
            ></div>
            Exception: {{ getExceptionRobot }}
          </div>
          <div class="col-md-4" style="display: flex">
            <div
              class="greenCircle"
              style="margin-left: 10px; margin-right: 5px"
            ></div>
            Working: {{ getWorkingRobot }}
          </div>
          <div class="col-md-4" style="display: flex">
            <div
              class="grayCircle"
              style="margin-left: 10px; margin-right: 5px"
            ></div>
            IDLE: {{ getIdleRobot }}
          </div>
        </div>
      </div>
    </div>

    <div class="row">
      <div
        class="col-md-4"
        v-for="carInfo in carsInfo"
        :key="carInfo.id"
        style="margin-top: 10px"
      >
        <el-card class="box-card">
          <template #header>
            <div class="card-header">
              <div style="height: 30px; line-height: 30px">
                <div style="float: left; display: flex">
                  <div
                    class="greenCircle"
                    v-if="carInfo.status == 'Working'"
                    style="margin-top: 4px; margin-right: 4px"
                  ></div>
                  <div
                    class="grayCircle"
                    v-if="carInfo.status == 'Idle'"
                    style="margin-top: 4px; margin-right: 4px"
                  ></div>
                  <div
                    class="redCircle"
                    v-if="carInfo.status == 'Exception'"
                    style="margin-top: 4px; margin-right: 4px"
                  ></div>
                  {{ carInfo.name }}
                </div>
                <div style="float: right">
                  <i
                    class="fa fa-map-marker"
                    style="margin-right: 5px; margin-left: 40px"
                  ></i
                  >{{ carInfo.robotLocationName }}
                  <a @click="closeRobotForklift(carInfo.id)">close</a>
                </div>
              </div>
            </div>
          </template>
          <template v-if="carInfo.currentActivity" style="display: block">
            <div style="text-align: left">
              Current Activity:
              <b
                >{{ carInfo.currentActivity.taskType }}({{
                  carInfo.currentActivity.lpId
                }})</b
              >
            </div>
            <div style="margin-left: 20px; margin-top: 10px; text-align: left">
              1. Load Pallet: {{ carInfo.currentActivity.fromLocationName }}
              <i
                class="fa fa-check-square"
                v-show="carInfo.currentActivity.isLoadPalleted"
                style="color: green"
              ></i>
              <i
                class="fa fa-arrow-left"
                v-show="carInfo.currentActivity.currentStatus == 'Load Pallet'"
                style="color: gray"
              ></i>
            </div>

            <div style="margin-left: 20px; margin-top: 10px; text-align: left">
              2. Unload Pallet: {{ carInfo.currentActivity.toLocationName }}
              <i
                class="fa fa-check-square"
                v-show="carInfo.currentActivity.isUnLoadPalleted"
                style="color: green"
              ></i>
              <i
                class="fa fa-arrow-left"
                v-show="
                  carInfo.currentActivity.currentStatus == 'Unload Pallet'
                "
                style="color: gray"
              ></i>
            </div>

            <div v-if="carInfo.exceptionDetail">
              <p style="color: red; font-weight: 700">Exception Detail:</p>
              <p style="text-indent: 2em">{{ carInfo.exceptionDetail }}</p>
            </div>

            <div style="margin-top: 20px; text-align: left">
              Pending Activity:
              <b>{{
                carInfo.pendingActivities ? carInfo.pendingActivities.length : 0
              }}</b
              ><i
                style="margin-left: 5px"
                class="fa fa-plus-square"
                @click="pendingActivitiesView(carInfo.id)"
              ></i>
            </div>

            <div v-if="carInfo.idleTime">IDLE Time: {{ carInfo.idleTime }}</div>

            <hr v-if="carInfo.currentActivity.customerName" />
            <div v-if="carInfo.currentActivity.customerName">
              {{ carInfo.currentActivity.customerName }}

              <div style="float: right; margin-left: 20px">
                {{ carInfo.currentActivity.taskId
                }}<span v-show="carInfo.currentActivity.orderId"
                  >({{ carInfo.currentActivity.orderId }})</span
                >
              </div>
            </div>
          </template>
        </el-card>
      </div>
    </div>

    <!-- 弹框 -->
    <el-dialog v-model="dialogFormVisible" title="Pending Activity" width="80%">
      <el-table
        border
        :data="pendingActivities"
        style="width: 100%"
        max-height="400"
        clearSelection
      >
        <el-table-column property="taskId" label="Task" />
        <el-table-column property="taskType" label="Task Type" />
        <el-table-column property="lpId" label="Lp ID" />
        <el-table-column property="status" label="Status" />
        <el-table-column
          property="fromLocationName"
          label="From Location Name"
        />
        <el-table-column property="toLocationName" label="To Location Name" />
        <el-table-column property="customerName" label="Customer Name" />
      </el-table>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogFormVisible = false">Cancel</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 弹框 -->
    <el-dialog
      v-model="dialogFormVisible1"
      title="Robot Forklift Setting"
      width="80%"
    >
      <el-table
        border
        :data="carsInfo"
        style="width: 100%"
        max-height="400"
        clearSelection
      >
        <el-table-column property="name" label="Robot Forklift Name" />
        <el-table-column label="Robot Forklift API">
          <template #default="scope">
            <el-input v-model="scope.row.robotForkliftApi" />
          </template>
        </el-table-column>
        <el-table-column property="notificationApi" label="Notification Api" />
      </el-table>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogFormVisible1 = false">Cancel</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  onMounted,
  reactive,
  ref,
  toRefs,
} from "vue";
import _ from "lodash";
import robotForkliftService from "../service/robotForkliftService";
import cache from "../shared/cache";
import { ipcRenderer } from "electron";

export default defineComponent({
  name: "Home",
  setup() {
    const account = reactive({
      carsInfo: reactive<any>([]),
      dialogFormVisible: ref(false),
      pendingActivities: ref([]),
      dialogFormVisible1: ref(false),
      robotForkliftsSetting: reactive<any>([]),
    });

    ipcRenderer.on("notificationRobotForklift", function (event, arg) {
      const message = `异步消息: ${arg}`;
      console.log(message);

      let robotForklif = _.find(account.carsInfo, (robotForklif: any) => {
        return robotForklif.id == arg;
      });
      if (robotForklif) {
        if (!robotForklif.currentActivity.isLoadPalleted) {
          robotForklif.currentActivity.isLoadPalleted = true;
        } else if (!robotForklif.currentActivity.isUnLoadPalleted) {
          robotForklif.currentActivity.isUnLoadPalleted = true;
        }
        if (
          robotForklif.currentActivity.isLoadPalleted &&
          robotForklif.currentActivity.isUnLoadPalleted
        ) {
          closeRobotForklift(robotForklif);
        } else {
          executeTask(robotForklif);
        }
      }
    });

    const getExceptionRobot = computed(() => {
      return _.filter(account.carsInfo, (carInfo: any) => {
        return carInfo.status == "Exception";
      }).length;
    });

    const getWorkingRobot = computed(() => {
      return _.filter(account.carsInfo, (carInfo: any) => {
        return carInfo.status == "Working";
      }).length;
    });

    const getIdleRobot = computed(() => {
      return _.filter(account.carsInfo, (carInfo: any) => {
        return carInfo.status == "Idle";
      }).length;
    });

    const robotForkliftSettingView = () => {
      account.dialogFormVisible1 = true;
    };

    const pendingActivitiesView = (id: any) => {
      let carInfo = _.find(account.carsInfo, (carInfo: any) => {
        return carInfo.id == id;
      });

      account.pendingActivities = carInfo.pendingActivities;
      account.dialogFormVisible = true;
    };

    function closeRobotForklift(robotForkliftId: any) {
      console.log("机器人id", robotForkliftId);
      robotForkliftService
        .closeRobotForklift(robotForkliftId)
        .then(function (response) {
          searchRobotForklift(
            { limit: -1 },
            function (robotForkliftViews: any) {
              console.log("关闭后search", robotForkliftViews);
              let index = _.findIndex(
                robotForkliftViews,
                (robotForklift: any) => {
                  return robotForklift.id == robotForkliftId;
                }
              );
              console.log(index);
              if (index > -1) {
                account.carsInfo.splice(index, 1, robotForkliftViews[index]);
                console.log("更新后↓");
                console.log(account.carsInfo);
                executeTask(robotForkliftViews[index]);
              }
            }
          );
        });
    }

    function executeTask(robotForklif: any) {
      console.log(robotForklif);
      let actionParam = getRobotInstruction(robotForklif);
      console.log(actionParam);
      
      if (!actionParam) {
        return;
      }
      if (actionParam.startsWith("L")) {
        robotForklif.currentActivity.currentStatus = "Load Pallet";
      }
      if (actionParam.startsWith("U")) {
              console.log(actionParam);

        robotForklif.currentActivity.currentStatus = "Unload Pallet";
      }
      let param = { data: actionParam };
      robotForkliftService.executeTask(param).then(function (response) {
        console.log(response);
      });
    }

    function getRobotInstruction(robotForklif: any) {
      let actionParam = "";
      if (!_.isEmpty(robotForklif.currentActivity)) {
        if (!robotForklif.currentActivity.isLoadPalleted) {
          actionParam =
            "L;" + robotForklif.currentActivity.fromLocationName + ";TRUE";
        } else if (!robotForklif.currentActivity.isUnLoadPalleted) {
          actionParam =
            "U;" + robotForklif.currentActivity.toLocationName + ";TRUE";
        }
      }
      return actionParam;
    }

    function searchRobotForklift(param: any, call?: any) {
      robotForkliftService.searchRobotForklift(param).then((res) => {
        let robotForkliftViews = res.data;
        _.forEach(robotForkliftViews, (robotForklift: any) => {
          if (!_.isEmpty(robotForklift.pendingActivities)) {
            robotForklift.pendingActivities = _.filter(
              robotForklift.pendingActivities,
              (pendingActivity: any) => {
                return pendingActivity.status != "Done";
              }
            );
          }
        });
        if (call) {
          call(robotForkliftViews);
          return;
        }
        account.carsInfo = robotForkliftViews;
        _.forEach(account.carsInfo, (robotForklift: any) => {
          executeTask(robotForklift);
        });
        console.log(res.data);
      });
    }

    onMounted(() => {
      searchRobotForklift({ limit: -1 });
    });

    return {
      ...toRefs(account),
      getExceptionRobot,
      getWorkingRobot,
      getIdleRobot,
      pendingActivitiesView,
      closeRobotForklift,
      robotForkliftSettingView
    };
  },
});
</script>
<style scoped>
/* p {
  font-size: 14px;
  font-family: Cambria, Cochin, Georgia, Times, "Times New Roman", serif;
} */
span {
  font-size: 20px;
}
.redCircle {
  border-radius: 50%;
  width: 20px;
  height: 20px;
  background-color: red;
  /* 宽度和高度需要相等 */
}
.grayCircle {
  border-radius: 50%;
  width: 20px;
  height: 20px;
  background-color: gray;
  /* 宽度和高度需要相等 */
}
.greenCircle {
  border-radius: 50%;
  width: 20px;
  height: 20px;
  background-color: green;
  /* 宽度和高度需要相等 */
}
</style>
