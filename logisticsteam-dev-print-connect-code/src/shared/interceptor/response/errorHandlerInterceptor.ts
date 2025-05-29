
// import { useRouter } from "vue-router";
// const router = useRouter();
import cache from "../../../shared/cache";


const errorHandlerInterceptor = (error: any) => {
    // if (error.response.status === 401) {
        // cache.clearCache();
        // console.log("123");
    // }
    // console.log("222222222222");
    // console.log(error);
    // console.log("111111111111");
    console.log(error.response.data.error);
    throw new Error("api:"+error.response.config.url +", Message:"+ error.response.data.error);

    return Promise.reject(error);
};

export default errorHandlerInterceptor;