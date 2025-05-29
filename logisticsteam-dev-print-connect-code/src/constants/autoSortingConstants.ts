export enum EnabledDisabledEnum {
    ENABLED = 1,
    DISABLED = 0
}

export enum ChuteWorkStatusEnum {
    IDLE = 'Idle',
    ASSIGNED = 'Assigned',
    COLLECT_PACKAGE = 'Collect Package',
    FULL_PACKAGE = 'Full Package',
}

export enum ChuteRevealWorkStatusEnum {
    Idle = 'Idle',
    Assigned = 'Allocated',
    'Collect Package' = 'Require Collect (Not Full)',
    'Full Package' = 'Require Collect (Full)',
}

export enum JobStatusEnum {
    UNASSIGNED = 'Unassigned',
    ASSIGNED = 'Assigned',
    COMPLETED = 'Completed',
    EXCEPTION = 'Exception',
}

export enum WaveStatusEnum {
    STOP = 'Stop',
    RUNNING = 'Running',
    COMPLETED = 'Completed'
}

export enum JobItemStatusEnum {
    UNASSIGNED = 'Unassigned',
    ASSIGNED = 'Assigned',
    COMPLETED = 'Completed',
}

export enum ChuteDetailStatusEnum {
    IN_TRANSIT = 'In transit',
    DONE = 'Done',
}

export enum PackageTypeEnum {
    COLLECT_PACKAGE = 'Collect Package',
    FULL_PACKAGE = 'Full Package',
}

export enum JobItemPackageTypeEnum {
    POLY_BAG = 'Poly Bag',
    BOX = 'Box',
}

export enum OperationTypeEnum {
    INSERT = 'insert',
    UPDATE = 'update',
    DELETE = 'delete',
}

export enum LogNameEnum {
    SOCKET = 'socket',
    ROBOT = 'robot',
    CALLBACK = 'callback',
    EXCEPTION = 'exception',
    SLOW_SQL = 'slowSql'
}

export enum UserStrategyTypeEnum {
    DEFAULT_STRATEGY = 'defaultStrategy',
    MANUAL_CHUTE_STRATEGY = 'manualChuteStrategy',
}

export const USER_DEFAULT_STRATEGY = {
    strategyType: UserStrategyTypeEnum.DEFAULT_STRATEGY,
    description: 'This strategy is used to assign a single chute to a job when other strategy is not matched.',
    parameters: {},
    priority: 99999,
};

export const Constants = {
    USER_STRATEGY_DEFAULT_FOR_BUSINESS_PREFIX: 'Business-',
};

export enum ChuteTypeEnum {
    ROUTE = 'Route',
    EXCEPTION = 'Exception',
    DROP_OFF = 'Drop-off',
    TERMINAL = 'Terminal'
}

export enum ChuteAllocationTypeEnum {
    ROUTE = 'Route',
    TERMINAL = 'Terminal',
}

export enum LogTypeEnum {
    GET_DESTINATION = 'getDestination',
    FALLING_PARTS = 'fallingParts',
    FULL_PACKAGE_INFORMATION = 'fullPackageInformation',
    POST_WAVE_DATA = 'postWaveData',
    RELEASE_CHUTE = 'releaseChute',
    GET_DESTINATION_CALLBACK = 'getDestinationCallback',
    FALLING_PARTS_CALLBACK = 'fallingPartsCallback',
    COLLECT_PACKAGE_CALLBACK = 'collectPackageCallback',
    AUTO_SORTING_MESSAGE = 'autoSortingMessage',
    BIN_CLOSE_CALLBACK = 'binCloseCallback',
    BIN_OPEN_CALLBACK = 'binOpenCallback',
    STRATEGY = 'strategy',
    WISE_REQUEST = 'wiseRequest',
}

export const TABLE = {
    CHUTE: 'auto_sorting_chute',
    CONFIG: 'auto_sorting_config',
    CHUTE_BINDING: 'auto_sorting_chute_binding',
    JOB: 'auto_sorting_job',
    JOB_ITEM: 'auto_sorting_job_item',
    WAVE: 'auto_sorting_wave',
    CHUTE_DETAIL: 'auto_sorting_chute_detail',
    CHUTE_DETAIL_HISTORY: 'auto_sorting_chute_detail_history',
    PACKAGE: 'auto_sorting_package',
    PACKAGE_DETAIL: 'auto_sorting_package_detail',
    LOG: 'auto_sorting_log',
    USER_STRATEGY: 'auto_sorting_user_strategy',
    BUSINESS_STRATEGY: 'auto_sorting_business_strategy',
    GROUP: 'auto_sorting_group',
    packages_monitor: 'auto_sorting_packages_monitor',
    CHUTE_ALLOCATION: 'auto_sorting_chute_allocation',
    QUEUE: 'auto_sorting_queue',
    LABEL: 'auto_sorting_label',
    PACKAGE_DATA_POOL_TODAY: 'auto_sorting_package_data_pool_today',
};

export const CONFIG_KEY = {
    PLATFORM: 'platform',
    LOCAL_DB_VERSION: 'local_db_ver',
    CURRENT_BUSINESS: 'current_business',
    BUSINESS_LIST: 'business_list',
    sortingSetup: 'sorting_setup',
    LABEL_TEMPLATE: 'label_template',
};

export enum PackageMonitorStatusEnum {
    UNSORTED = 'Unsorted',
    SORTING = 'Sorting',
    SORTED = 'Sorted',
    BONDED = 'Bonded',
    NOT_FOUND = 'Not Found',
    OVERWEIGHT = 'Overweight',
    EXCEPTION = 'Exception',
    INCREMENTAL_FOUND = 'Incremental Found',
}

export enum QueueTypeEnum {
    A_SCAN = 'A Scan',
    COLLET_PACKAGE = 'Collect Package',
    PACKAGE_BONDED = 'Package Bonded',
    GET_AMAZONAWS_PACKAGE = 'Get Amazonaws Package',
}

export enum ChuteAssignableConditionEnum {
    KEY_PARENT_EQUAL = 'Key Parent Equal',
}

export enum FullPackageInformationSourceEnum {
    SENSOR = 'sensor',
    ACTIVE = 'active',
}

export const BASE_STRATEGY_PARAM_QUERY_DESCRIPTION = {
    thresholdPackageQty: {
        description: 'Threshold Package Qty',
        type: 'relation-number',
        required: true,
        supperKey: 'multipleChuteForRoute',
    },
    chuteAllocationQty: {
        description: 'Chute Allocation Qty',
        type: 'relation-number',
        required: true,
        supperKey: 'multipleChuteForRoute',
    },
};

export const BASE_STRATEGY_PARAM_DISPATCH_DESCRIPTION = {
    chuteNeededForResortedPkgs: {
        description: 'Chute Needed for resorted Pkgs',
        type: 'switch',
    },
    allocateGroupBy: {
        description: 'Allocate Group By',
        type: 'select',
        options: ['Group ID', 'Group Name', 'Random'],
        default: 'Group ID',
    },
    groupSortBy: {
        description: 'Group Sort By',
        type: 'select',
        options: ['asc', 'desc'],
        default: 'asc',
    },
    chuteNoIn: {
        description: 'Chute No In',
        type: 'chute-search-multiple-select',
    },
    chuteNoNotIn: {
        description: 'Chute No Not In',
        type: 'chute-search-multiple-select',
    },
    allocateChuteBy: {
        description: 'Allocate Chute By',
        type: 'select',
        options: ['Chute ID', 'Chute No', 'Random'],
        default: 'Chute ID',
    },
    chuteSortBy: {
        description: 'Chute Sort By',
        type: 'select',
        options: ['asc', 'desc'],
        default: 'asc',
    },
    multipleChuteForRoute: {
        description: 'Multiple Chute for Route',
        type: 'relation-switch',
        subKeys: ['thresholdPackageQty', 'chuteAllocationQty'],
    },
    // 添加更多的参数及其描述
};

export const AUTO_SORTING_PLATFORM = [
    {
        name: 'LSOWES_CO12793_F1',
        facilityName: 'HUB',
        needToReleaseChute: true,
        chuteKeyName: 'Route',
        binCloseUrl: 'http://10.254.0.146:7790/wms/unislso/binClose',
        binOpenUrl: 'http://10.254.0.146:7790/wms/unislso/binOpen',
        closeWaveUrl: 'http://10.254.0.146:7790/wms/unislso/closeWave',
    },
    {
        name: 'LSOWES_CO12793_F3',
        facilityName: 'PLN',
        needToReleaseChute: true,
        chuteKeyName: 'Route',
        binCloseUrl: 'http://10.254.0.146:7790/wms/unislso/binClose',
        binOpenUrl: 'http://10.254.0.146:7790/wms/unislso/binOpen',
        closeWaveUrl: 'http://10.254.0.146:7790/wms/unislso/closeWave',
    },
    {
        name: 'LSOWES_CO12793_F10',
        facilityName: 'CTR',
        needToReleaseChute: true,
        chuteKeyName: 'Route',
        binCloseUrl: 'http://10.254.0.146:7790/wms/unislso/binClose',
        // binOpenUrl: 'http://10.254.0.146:7790/wms/unislso/binOpen',
        // closeWaveUrl: 'http://10.254.0.146:7790/wms/unislso/closeWave',
    },
];

export const WISE_HEADERS = {
    wise: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: 'Basic d2lzZWJvdDp1aW9wNzg5MA==',
    },
    saas: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: 'Basic bGFzdE1pbGVAaXVicmlkZ2UuY29tOlBhc3MxMjM0NTY=',
        'WISE-Company-Id': 'CO12793',
        application: 'LSO-WES',
    },
};

export const ENVIRONMENTS = [
    {
        label: 'Wise Production',
        requestUrl: 'https://wise.logisticsteam.com/v2',
        socketUrl: 'wss://wise.logisticsteam.com',
    },
    {
        label: 'Wise Stage',
        requestUrl: 'https://stage.logisticsteam.com',
        socketUrl: 'wss://stage.logisticsteam.com',
    },
    {
        label: 'Wise Preview',
        requestUrl: 'https://preview.logisticsteam.com',
        socketUrl: 'wss://preview.logisticsteam.com',
    },
    {
        label: 'Saas Stage',
        requestUrl: 'https://stagesaas.opera8.com',
        socketUrl: 'wss://stagesaas.opera8.com',
    },
];

export const AUTO_SORTING_PLATFORM_PROD = [
    {
        name: 'LSOWES_CO10059_F1',
        facilityName: 'HUB',
        needToReleaseChute: true,
        chuteKeyName: 'Route',
        binCloseUrl: 'http://10.254.0.146:7790/wms/unislso/binClose',
        binOpenUrl: 'http://10.254.0.146:7790/wms/unislso/binOpen',
        closeWaveUrl: 'http://10.254.0.146:7790/wms/unislso/closeWave',
    },
];

export const WISE_HEADERS_PROD = {
    lso: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: 'Basic d2VzbHNvcm9ib3RAdW5pc2NvLmNvbTpIbUFaVEJabnpFZ1F2QDI=',
        'WISE-Company-Id': 'CO10059',
        application: 'LSO-WES',
    },
};

export const ENVIRONMENTS_PROD = [
    {
        label: 'LSO Production',
        requestUrl: 'https://glogistic.opera8.com',
        socketUrl: 'wss://glogistic.opera8.com',
    },
];

export const LSO_TRANSIT_PACKAGE_LABEL =
    '^XA\n' +
    '^MMT\n' +
    '^PW406\n' +
    '^LL0203\n' +
    '^LS0\n' +
    '^LH0,20\n' +
    '^FO10,102^GB365,0,2^FS\n' +
    '^FO200,77^GB0,136,2^FS\n' +
    '^FO10,75^GB365,140,2^FS\n' +
    '^FO10,174^GB365,0,2^FS\n' +
    '\n' +
    '\n' +
    '^FT60,96^A0N,19,24^FH\\^FDTerminal^FS\n' +
    '\n' +
    '\n' +
    '^FT260,98^A0N,19,21^FH\\^FDRoute^FS\n' +
    '^FT58,151^A0N,38,52^FH\\^FD{{terminal}}^FS\n' +
    '^FT244,151^A0N,38,52^FH\\^FD{{route}}^FS\n' +
    '\n' +
    '\n' +
    '^FT220,199^A0N,19,14^FH\\^FD{{{note}}}^FS\n' +
    '^FT41,199^A0N,17,14^FH\\^FD{{time}}^FS\n' +
    '\n' +
    '^BY2,3,41^FT35,48^BCN,,N,N\n' +
    '^FD{{{labelCode}}}^FS\n' +
    '^FT65,67^A0N,17,28^FH\\^FD{{labelCodeText}}^FS\n' +
    '^PQ1,0,1,Y^XZ';
