// 静态字典数据

import {
    ChuteAssignableConditionEnum,
    WaveStatusEnum,
    ChuteTypeEnum,
    ChuteAllocationTypeEnum
} from '@/constants/autoSortingConstants';

const selectStaticCode: Record<string, any> = {
    waveStatus: WaveStatusEnum,
    chuteAssignableConditionEnum: ChuteAssignableConditionEnum,
    category: ['WEB', 'ANDROID', 'API', 'ALL', 'MOBILE'],
    status: ['ACTIVE', 'PENDING', 'INACTIVE'],
    chuteTypeEnum: ChuteTypeEnum,
    chuteAllocationTypeEnum: ChuteAllocationTypeEnum
};

export default selectStaticCode;
