import ipcAxios from "@/shared/ipcAxios"

class loginService {

    login(loginParam: any) {
        return ipcAxios.post("/shared/idm-app/user/login", loginParam)
    }

}

export default new loginService();
