<template>
  <div class="login">
    <div class="content">
      <h1>Login</h1>
      <el-tabs type="border-card" stretch>
        <div class="login-user">
          <el-form label-width="40px" :model="account" ref="elFormRef">
            <el-form-item label="账号" prop="name">
              <el-input v-model="account.username"></el-input>
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="account.password" show-password></el-input>
            </el-form-item>
          </el-form>
        </div>
      </el-tabs>
      <el-button
        type="primary"
        class="login-commit"
        @click="logInNow"
        :loading="logining"
        >Login</el-button
      >

      <el-button
        type="primary"
        class="login-commit"
        @click="goDebug"
        style="margin-left: 0px"
        >Go Debug</el-button
      >
      <!-- <el-button type="primary" class="login-commit" @click="test"
        >test</el-button
      >

      <el-button type="primary" class="login-commit" @click="clear"
        >clear</el-button
      > -->
    </div>
  </div>
</template>

<script lang="ts">
import router from "@/router";
import { defineComponent, ref, reactive, toRefs, onMounted } from "vue";
import cache from "../shared/cache";
import _ from "lodash";
import loginService from "../service/loginService";
import companyService from "../service/companyService";
import { ElMessage } from "element-plus";

// declare const window: any;
export default defineComponent({
  name: "Login",
  setup() {
    const account = reactive({
      username: "",
      password: "",
      channel: "Web",
      returnUserPermissions: ["WEB"],
    });

    let logining = ref(false);

    const searchFacility = (
      defaultCompanyFacility: any,
      assignedCompanyFacilities: any,
      call: any
    ) => {
      var companyIds = _.uniq(_.map(assignedCompanyFacilities, "companyId"));
      var facililtyIds = _.uniq(_.map(assignedCompanyFacilities, "facilityId"));
      var promises = [];
      for (let index = 0; index < companyIds.length; index++) {
        const companyId = companyIds[index];
        promises.push(
          companyService.searchFacility({
            ids: facililtyIds,
            wiseCompanyId: companyId,
          })
        );
      }
      promises.push(
        companyService.searchCompany({
          ids: companyIds,
        })
      );
      Promise.all(promises).then((response: any) => {
        var orgs = _.flattenDeep(_.map(response, "data"));
        var orgsMap = _.keyBy(orgs, (o: any) => {
          if (o.companyId) {
            return o.id + o.companyId;
          } else {
            return o.id;
          }
        });
        _.forEach(assignedCompanyFacilities, function (cf: any) {
          setCompanyFacilityObjInfoById(cf, orgsMap);
        });
        setCompanyFacilityObjInfoById(defaultCompanyFacility, orgsMap);
        //
        if (assignedCompanyFacilities && assignedCompanyFacilities.length > 0) {
          if (!defaultCompanyFacility) {
            defaultCompanyFacility = assignedCompanyFacilities[0];
          }
        }
        cache.setCache("companyFacility", defaultCompanyFacility);
        cache.setCache("assignedCompanyFacilities", assignedCompanyFacilities);
        call && call();
      });
    };

    const setCompanyFacilityObjInfoById = (cf: any, orgsMap: any) => {
      if (!cf) return;
      if (cf.companyId) {
        cf.company = orgsMap[cf.companyId];
      }
      if (cf.facilityId) {
        cf.facility = orgsMap[cf.facilityId + cf.companyId];
      }
    };

    const logInNow = () => {
      logining.value = true;
      let loginParam = {
        username: account.username,
        password: account.password,
        channel: "Web",
        returnUserPermissions: ["WEB"],
      };
      loginService.login(loginParam).then(
        function (params: any) {
          logining.value = false;
          console.log(params);

          cache.setCache("token", params.data.oAuthToken);
          cache.setCache("userInfo", params.data.userView);
          console.log(cache.getCache("token"));
          searchFacility(
            params.data.userView.defaultCompanyFacility,
            params.data.userView.assignedCompanyFacilities,
            () => {
              router.push("main");
            }
          );
        },
        function (error: any) {
          logining.value = false;
          ElMessage.error("" + error);
          // alert(error);
        }
      );
    };

    const goDebug = () => {
      // console.log(cache.getCache("token"));
      router.push("/debug");

      // ipcRenderer
      //   .invoke("request", {
      //     method: "GET",
      //     url: "https://www.baidu.com",
      //   })
      //   .then((data: any) => {
      //     console.log(data);
      //     return true;
      //   });
      // .catch((resp: any) => console.warn(resp));
    };

    const clear = () => {
      cache.clearCache();
      console.log(cache.getCache("token"));
    };

    onMounted(() => {
      cache.clearCache();
    });

    return { account, logInNow, goDebug, logining, clear };
  },
});
</script>

<style scoped>
.login {
  width: 100%;
  height: 100%;
  background: center center no-repeat;
  background-size: 100% 100%;
}

.content {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  margin-top: -100px;
}

h1 {
  text-align: center;
}
.el-tabs {
  width: 320px;
}
.login-commit {
  margin-top: 10px;
  width: 100%;
}
</style>
