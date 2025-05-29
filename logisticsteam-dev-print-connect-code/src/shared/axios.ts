import axios from 'axios';
import appendAppUrlPrefixInterceptor from "./interceptor/request/appendAppUrlPrefixInterceptor";
import addCompanyFacilityHeaderInterceptor from "./interceptor/request/addCompanyFacilityHeaderInterceptor";
import addTokenToHeader from "./interceptor/request/addTokenInterceptor";
import errorHandlerInterceptor from "./interceptor/response/errorHandlerInterceptor";

axios.defaults.baseURL = "https://stage.logisticsteam.com";
const ax = axios.create();

ax.interceptors.request.use(appendAppUrlPrefixInterceptor);
ax.interceptors.request.use(addCompanyFacilityHeaderInterceptor);
ax.interceptors.request.use(addTokenToHeader);
ax.interceptors.response.use(response => response, errorHandlerInterceptor);

export default ax;

