// 动态字典接口

import ax from "@/shared/axios";

export const getCarrierList = (params: any) => {
	return ax.post('/api/bam/carrier/search', params);
};
export const getRoleList = (applicationId: any) => {
	return ax.get(`/api/idm-app/role/application/${applicationId}`);
};
