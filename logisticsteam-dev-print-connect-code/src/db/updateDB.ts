import { getConfig, setConfig } from '@/db/autoSorting';
import { CONFIG_KEY } from '@/constants/autoSortingConstants';

const updateLocalDBByVersion = async (db: any, localDBVersion: number, checkVersion: number, updateSQLList: any) => {
    if (localDBVersion >= checkVersion) return;
    console.log(`Update local db to version ${checkVersion}`, updateSQLList);
    await db.runBySqlArray(db, updateSQLList);
    await updateLocalDBVersion(checkVersion);
};
export const tryUpdateDBIfNeed = async (db: any) => {
    // for local db update
    const localDBVersion = parseInt(await getConfig(CONFIG_KEY.LOCAL_DB_VERSION));
    console.log(CONFIG_KEY.LOCAL_DB_VERSION, localDBVersion);

    await updateLocalDBByVersion(db, localDBVersion, 2, [
        `alter table auto_sorting_user_strategy add column isEnabled integer default 1`,
    ]);
    await updateLocalDBByVersion(db, localDBVersion, 3, [
        `alter table auto_sorting_user_strategy add column customName text`,
        `CREATE TABLE auto_sorting_business_strategy (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business TEXT NOT NULL,
            userStrategyId INTEGER,
            priority INTEGER,
            createdAt BIGINT DEFAULT (strftime('%s', 'now')),
            updatedAt BIGINT
            )`,
        `CREATE INDEX idx_business_strategy ON auto_sorting_business_strategy(business)`,
        `ALTER TABLE auto_sorting_chute_detail add column businessStrategyId INTEGER`,
        `ALTER TABLE auto_sorting_chute_detail add column strategyName text`,
        `ALTER TABLE auto_sorting_chute_detail add column customStrategyName text`,
        `ALTER TABLE auto_sorting_chute_detail_history RENAME COLUMN detailId TO chuteDetailId`,
        `ALTER TABLE auto_sorting_chute_detail_history add column businessStrategyId INTEGER`,
        `ALTER TABLE auto_sorting_chute_detail_history add column strategyName text`,
        `ALTER TABLE auto_sorting_chute_detail_history add column customStrategyName text`,
        `ALTER TABLE auto_sorting_job add column chuteNosHistory text`,
        `ALTER TABLE auto_sorting_user_strategy RENAME COLUMN customName TO strategyType`,
        `ALTER TABLE auto_sorting_chute_detail_history RENAME COLUMN customStrategyName TO strategyType`,
        `ALTER TABLE auto_sorting_chute_detail RENAME COLUMN customStrategyName TO strategyType`,
        `ALTER TABLE auto_sorting_chute add column groupId INTEGER`,
        `CREATE TABLE auto_sorting_group (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    platform TEXT NOT NULL,
                    groupName TEXT NOT NULL,
                    createdAt BIGINT DEFAULT (strftime('%s', 'now')),
                    updatedAt BIGINT
                    )`,
        `CREATE INDEX idx_group_platform ON auto_sorting_group(platform)`,
        `ALTER TABLE auto_sorting_chute add column sequence INTEGER DEFAULT 0`,
    ],
    );
    await updateLocalDBByVersion(db, localDBVersion, 4, [
        `alter table auto_sorting_job add column jobQty NUMERIC`,
        `ALTER TABLE auto_sorting_chute add column assignableCondition TEXT`,
        `ALTER TABLE auto_sorting_chute add column conditionValue TEXT`,
        `ALTER TABLE auto_sorting_job add column parentChuteNo TEXT`,

    ],
    );

    await updateLocalDBByVersion(db, localDBVersion, 5, [
        `CREATE TABLE auto_sorting_packages_monitor (
            trackingNo TEXT PRIMARY KEY,
            platform TEXT NOT NULL,
            status TEXT,
            terminal TEXT,
            waveNo TEXT,
            routeNo TEXT,
            chuteNo TEXT,
            label_Code TEXT,
            createTime TEXT,
            updateTime TEXT
        )`
    ],
    );
    await updateLocalDBByVersion(db, localDBVersion, 6, [
        `ALTER TABLE auto_sorting_chute add column chuteType TEXT`
    ],
    );

    await updateLocalDBByVersion(db, localDBVersion, 7, [
        `ALTER TABLE auto_sorting_group add column dropOffPoints TEXT`,
        `ALTER TABLE auto_sorting_group add column isEnabled number`,
        `ALTER TABLE auto_sorting_business_strategy add column isEnabled number`,
    ],
    );
    await updateLocalDBByVersion(db, localDBVersion, 8, [
        `ALTER TABLE auto_sorting_user_strategy add column description TEXT`
    ],
    );

    await updateLocalDBByVersion(db, localDBVersion, 9, [
       `CREATE TABLE auto_sorting_packages_monitor1 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trackingNo TEXT,
            platform TEXT NOT NULL,
            status TEXT,
            terminal TEXT,
            waveNo TEXT,
            routeNo TEXT,
            chuteNo TEXT,
            label_Code TEXT,
            createTime TEXT,
            updateTime TEXT
        )`,
        `DROP TABLE auto_sorting_packages_monitor`
    ],
    );

    await updateLocalDBByVersion(db, localDBVersion, 10, [
        `ALTER TABLE auto_sorting_packages_monitor1 RENAME TO auto_sorting_packages_monitor`,
    ],
    );

    await updateLocalDBByVersion(db, localDBVersion, 11, [
        `ALTER TABLE auto_sorting_job add column terminal TEXT`
    ],
    );

    await updateLocalDBByVersion(db, localDBVersion, 12, [
        `CREATE TABLE auto_sorting_chute_allocation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT,
            routeName TEXT NOT NULL UNIQUE,
            type TEXT,
            isChuteNeeded INTEGER,
            fixedChuteNos TEXT,
            createdWhen TEXT,
            updatedWhen TEXT
        )`,
    ]);
    await updateLocalDBByVersion(db, localDBVersion, 13, [
        `ALTER TABLE auto_sorting_packages_monitor add column createdAt BIGINT DEFAULT (strftime('%s', 'now'))`,
        `ALTER TABLE auto_sorting_packages_monitor add column updatedAt BIGINT`,
        `ALTER TABLE auto_sorting_chute_allocation add column createdAt BIGINT DEFAULT (strftime('%s', 'now'))`,
        `ALTER TABLE auto_sorting_chute_allocation add column updatedAt BIGINT`,
    ]);
    await updateLocalDBByVersion(db, localDBVersion, 14, [
        `ALTER TABLE auto_sorting_chute_binding add column routeName TEXT`,
        `ALTER TABLE auto_sorting_chute_detail add column routeName TEXT`,
        `ALTER TABLE auto_sorting_chute_detail_history add column routeName TEXT`,
        `CREATE INDEX idx_detail_platform_routeName ON auto_sorting_chute_detail(platform,routeName)`,
        `CREATE INDEX idx_history_platform_routeName ON auto_sorting_chute_detail_history(platform,routeName)`,
        `CREATE INDEX idx_job_terminal ON auto_sorting_job(terminal)`,
        `CREATE INDEX idx_packages_monitor_platform ON auto_sorting_packages_monitor(platform)`,
        `CREATE INDEX idx_packages_monitor_platform_trackingNo ON auto_sorting_packages_monitor(platform,trackingNo)`,
        `CREATE INDEX idx_packages_monitor_platform_waveNo ON auto_sorting_packages_monitor(platform,waveNo)`,
        `CREATE INDEX idx_packages_monitor_platform_terminal ON auto_sorting_packages_monitor(platform,terminal)`,
        `CREATE INDEX idx_packages_monitor_platform_routeNo ON auto_sorting_packages_monitor(platform,routeNo)`,
        `CREATE INDEX idx_packages_monitor_platform_chuteNo ON auto_sorting_packages_monitor(platform,chuteNo)`,
        `CREATE INDEX idx_chute_allocation_platform ON auto_sorting_chute_allocation(platform)`,
        `CREATE INDEX idx_chute_allocation_platform_routeName ON auto_sorting_chute_allocation(platform,routeName)`,
    ]);
    await updateLocalDBByVersion(db, localDBVersion, 15, [
        `CREATE TABLE auto_sorting_chute_allocation1 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT,
            routeName TEXT NOT NULL,
            type TEXT,
            isChuteNeeded INTEGER,
            fixedChuteNos TEXT,
            createdWhen TEXT,
            updatedWhen TEXT,
            createdAt BIGINT DEFAULT (strftime('%s', 'now')),
            updatedAt BIGINT
        )`,
        `INSERT INTO auto_sorting_chute_allocation1 (id, platform, routeName, type, isChuteNeeded, fixedChuteNos, createdWhen, updatedWhen, createdAt, updatedAt) SELECT id, platform, routeName, type, isChuteNeeded, fixedChuteNos, createdWhen, updatedWhen, createdAt, updatedAt FROM auto_sorting_chute_allocation`,
        `DROP TABLE auto_sorting_chute_allocation`,
        `ALTER TABLE auto_sorting_chute_allocation1 RENAME TO auto_sorting_chute_allocation`,
        `CREATE INDEX idx_chute_allocation_platform ON auto_sorting_chute_allocation(platform)`,
        `CREATE INDEX idx_chute_allocation_platform_routeName ON auto_sorting_chute_allocation(platform,routeName)`,
    ]);
    await updateLocalDBByVersion(db, localDBVersion, 16, [
        `ALTER TABLE auto_sorting_job add column sortedQty NUMERIC DEFAULT 0`,
    ]);
    await updateLocalDBByVersion(db, localDBVersion, 17, [
        `ALTER TABLE auto_sorting_packages_monitor add column exceptionReason TEXT`,
    ]);
    await updateLocalDBByVersion(db, localDBVersion, 18, [
        `CREATE TABLE auto_sorting_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT,
            data TEXT,
            platform TEXT,
            config TEXT,
            type TEXT,
            createdWhen TEXT,
            updatedWhen TEXT,
            createdAt BIGINT DEFAULT (strftime('%s', 'now')),
            updatedAt BIGINT
        )`,
        `CREATE INDEX idx_queue_platform_type ON auto_sorting_queue(platform,type)`,
    ]);
    await updateLocalDBByVersion(db, localDBVersion, 19, [
        `CREATE TABLE auto_sorting_label (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag TEXT,
            curId NUMERIC,
            platform TEXT,
            createdWhen TEXT,
            updatedWhen TEXT,
            createdAt BIGINT DEFAULT (strftime('%s', 'now')),
            updatedAt BIGINT
        )`,
        `CREATE INDEX idx_label_platform_tag ON auto_sorting_label(platform,tag)`,
    ]);
    await updateLocalDBByVersion(db, localDBVersion, 20, [
        `ALTER TABLE auto_sorting_job_item add column shipToAddress TEXT`,
        `ALTER TABLE auto_sorting_job_item add column weight NUMERIC`,
        `ALTER TABLE auto_sorting_job_item add column volume NUMERIC`,
        `ALTER TABLE auto_sorting_job_item add column length NUMERIC`,
        `ALTER TABLE auto_sorting_job_item add column height NUMERIC`,
        `ALTER TABLE auto_sorting_job_item add column width NUMERIC`,
        `ALTER TABLE auto_sorting_job_item add column cubicFeet NUMERIC`,
        `ALTER TABLE auto_sorting_job_item add column packageType TEXT`,
        `ALTER TABLE auto_sorting_job_item add column zipcode TEXT`,
    ]);
    await updateLocalDBByVersion(db, localDBVersion, 21, [
        `CREATE TABLE auto_sorting_package_data_pool_today (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT,
            pickupDate TEXT,
            routeName TEXT,
            count NUMERIC,
            packageType TEXT,
            createdWhen TEXT,
            updatedWhen TEXT,
            createdAt BIGINT DEFAULT (strftime('%s', 'now')),
            updatedAt BIGINT
        )`,
        `CREATE INDEX idx_package_data_pool_today_platform_pickupDate ON auto_sorting_package_data_pool_today(platform, pickupDate)`,
        `CREATE INDEX idx_package_data_pool_today_platform_routeName ON auto_sorting_package_data_pool_today(platform, routeName)`,
        `CREATE INDEX idx_package_data_pool_today_platform_packageType ON auto_sorting_package_data_pool_today(platform, packageType)`,
    ]);
};

const updateLocalDBVersion = async (localDBVersion: number) => {
    await setConfig(CONFIG_KEY.LOCAL_DB_VERSION, localDBVersion + '');
};
