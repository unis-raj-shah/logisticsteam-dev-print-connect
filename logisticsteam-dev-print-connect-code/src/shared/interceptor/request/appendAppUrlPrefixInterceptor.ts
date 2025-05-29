
import cache from "../../../shared/cache";
import { AxiosRequestConfig } from 'axios';

const appendAppUrlPrefixInterceptor = function appendAppUrlPrefix(config: AxiosRequestConfig): AxiosRequestConfig {
    const currentCF = cache.getCache("companyFacility");
    let url = config.url;
    // console.log(config);
    // console.log(currentCF);

    if (url) {
        if (url.startsWith("/fd-app/") || url.startsWith("/idm-app/") || url.startsWith("/print-app/") || url.startsWith("/file-app/") || url.startsWith("/push-app/")) {
            url = "/shared" + url;
        } else if (url.startsWith("/bam/") || url.startsWith("/report-center/") || url.startsWith("/base-app/") || url.startsWith("/wms-app/") || url.startsWith("/yms-app/") || url.startsWith("/inventory-app/")) {
        //    console.log(currentCF);
           
            if (currentCF) {
                url = "/" + currentCF.facility.accessUrl + url;
            } else {
                throw {
                    response: {
                        data: { error: 'Can not find activity facility for current customer.' },
                        headers: {}
                    }
                };
            }
        }
    }
    config.url = url;
    return config;
};

export default appendAppUrlPrefixInterceptor;