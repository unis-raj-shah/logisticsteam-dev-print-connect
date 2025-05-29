import { ipcRenderer } from "electron";
import cache from "@/shared/cache";
import router from "@/router";
import { ElMessage } from "element-plus";

class IpcAxios {

    private haveToken() {
        return true; // debug 专用
        return cache.getCache("token")
    }

    get(url: string, body: any) {
        if (!this.haveToken()) {
            router.push("/");
            ElMessage.error("no token");
            return Promise.reject("no token");
        }
        return ipcRenderer
            .invoke("request", {
                method: "GET",
                url: url,
                data: body
            })
    }

    post(url: string, body: any) {
        if (!this.haveToken() && url != "/shared/idm-app/user/login") {
            router.push("/")
            ElMessage.error("no token");
            return Promise.reject("no token");
        }
        return ipcRenderer
            .invoke("request", {
                method: "POST",
                url: url,
                data: body
            })
    }

    put(url: string, body: any) {
        if (!this.haveToken()) {
            router.push("/")
            ElMessage.error("no token");
            return Promise.reject("no token");
        }
        return ipcRenderer
            .invoke("request", {
                method: "PUT",
                url: url,
                data: body
            })
    }

    delete(url: string, body: any) {
        if (!this.haveToken()) {
            router.push("/")
            ElMessage.error("no token");
            return Promise.reject("no token");
        }
        return ipcRenderer
            .invoke("request", {
                method: "DELETE",
                url: url,
                data: body
            })
    }

}

export default new IpcAxios();
