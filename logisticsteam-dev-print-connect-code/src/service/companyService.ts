import ipcAxios from "@/shared/ipcAxios"

class loginService {

    searchCompany(param: any) {
        return ipcAxios.post("/shared/idm-app/company/search", param)
    }

    searchFacility(param: any) {
        return ipcAxios.post("/shared/bam/fd-app/facility/search", param)
    }

}

export default new loginService();
