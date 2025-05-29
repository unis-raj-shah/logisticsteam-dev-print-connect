import ipcAxios from "@/shared/ipcAxios"

class loginService {

    searchRobotForklift(param: any) {
        return ipcAxios.post("/bam/wms-app/robot-forklift/search", param)
    }

    closeRobotForklift(robotForkliftId: any) {
        return ipcAxios.put(`/wms-app/robot-forklift/${robotForkliftId}/close`, {})
    }

    executeTask(param: any) {
        return ipcAxios.post(`http://127.0.0.1:8110/sendOrder1`, param)
    }

}

export default new loginService();
