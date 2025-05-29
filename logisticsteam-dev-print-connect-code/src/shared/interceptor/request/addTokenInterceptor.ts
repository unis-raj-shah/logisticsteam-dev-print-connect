import { AxiosRequestConfig } from 'axios';
import cache from "../../../shared/cache";
const AddWISETokenInterceptor = function(config: AxiosRequestConfig) {
    config.headers = config.headers || {};
    // console.log(cache.getCache("token"));
    
    config.headers.Authorization = cache.getCache("token") || "";
    return config;
};

export default AddWISETokenInterceptor;