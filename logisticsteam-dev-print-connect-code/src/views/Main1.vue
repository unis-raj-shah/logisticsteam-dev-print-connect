<template>
  <nav class="navbar navbar-default navbar-fixed-top">
    <div class="container-fluid">
      <div class="collapse navbar-collapse" id="bs-example-navbar-collapse-1">
        <p class="navbar-text">{{ currentDateTime }}</p>

        <ul class="nav navbar-nav navbar-right">
          <li class="dropdown">
            <a class="dropdown-toggle"
              >{{ userInfo.firstName }} {{ userInfo.lastName }}
              <span class="caret"></span
            ></a>
            <ul class="dropdown-menu">
              <li>
                <a href="javascript:void(0)" @click="loginOut()">Login Out</a>
              </li>
            </ul>
          </li>
        </ul>
        <ul class="nav navbar-nav navbar-right">
          <li class="dropdown">
            <a class="dropdown-toggle"
              >Facility: {{ companyFacility.facility.name
              }}<span class="caret"></span
            ></a>
            <ul class="dropdown-menu" style="overflow: auto; max-height: 500px">
              <li
                v-for="(
                  assignedCompanyFacilities, index
                ) in assignedCompanyFacilities"
                :key="assignedCompanyFacilities.facilityId"
                :index="'2-' + index"
              >
                <a
                  href="javascript:void(0)"
                  @click="changeFacility(assignedCompanyFacilities)"
                >
                  Facility: {{ assignedCompanyFacilities.facility.name }}</a
                >
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  </nav>
  <router-view style="padding-top: 70px" v-if="isRouterAlive"></router-view>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, toRefs, onMounted } from "vue";
import cache from "../shared/cache";
import _ from "lodash";
import { useRouter } from "vue-router";

export default defineComponent({
  name: "Main",
  setup() {
    const router = useRouter();
    const loginOut = () => {
      cache.clearCache();
      router.push("/");
    };
    function getCurrentTime() {
      var mouthLists = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      var weekdayList = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      var date = new Date();
      var mouth = mouthLists[date.getMonth()];
      var weekday = weekdayList[date.getDay()];
      var day = date.getDate();
      var year = date.getFullYear();
      var hour = date.getHours();
      var minutes =
        date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
      var second =
        date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds();
      var currentTime = weekday + " " + mouth + " " + day + "," + year;
      var currentHMS = hour + ":" + minutes + ":" + second;
      return {
        currentTime: currentTime,
        currentHMS: currentHMS,
      };
    }
    let state = reactive({
      companyFacility: cache.getCache("companyFacility"),
      assignedCompanyFacilities: cache.getCache("assignedCompanyFacilities"),
      userInfo: cache.getCache("userInfo"),
      isRouterAlive: ref(true),
      currentDateTime:
        getCurrentTime().currentTime + " " + getCurrentTime().currentHMS,
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
      state.currentDateTime =
        getCurrentTime().currentTime + " " + getCurrentTime().currentHMS;
    }, 1000);

    return {
      loginOut,
      ...toRefs(state),
      changeFacility,
    };
  },
});
</script>

<style scoped>
.dropdown:hover .dropdown-menu {
  display: block;
}
</style>
