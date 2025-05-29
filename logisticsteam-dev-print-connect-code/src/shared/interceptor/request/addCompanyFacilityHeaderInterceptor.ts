
import { AxiosRequestConfig } from 'axios';
import cache from "../../../shared/cache";

const AddCompanyAndFacilityIdToHeaderInterceptor = async function (config: AxiosRequestConfig) {
    const currentCF = cache.getCache("companyFacility");
    const user = cache.getCache("userInfo");
    config.headers = config.headers || {};
    if (!config.headers["WISE-Company-Id"]) {
        if (config.data && config.data.wiseCompanyId) {
            config.headers["WISE-Company-Id"] = config.data.wiseCompanyId;
        } else {
            if (currentCF) {
                config.headers["WISE-Company-Id"] = currentCF.companyId;
            }
        }
    }

    if (currentCF) {
        config.headers["WISE-Facility-Id"] = currentCF.facilityId;
        if (config.data && config.data['excludeFacility']) {
            delete config.headers["WISE-Facility-Id"];
        }
    }
    if (config.data && config.data.facilityId) {
        config.headers["WISE-Facility-Id"] = config.data.facilityId;
    }
    if (user && config && config.headers) {        
        config.headers["x-login-username"] = user.username;
    }
    return config;
};

export default AddCompanyAndFacilityIdToHeaderInterceptor;