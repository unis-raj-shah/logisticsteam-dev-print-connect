import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';

import Debug from '../views/Debug.vue';
import AutoSortingMain from '../views/auto-sorting/AutoSortingMain.vue';
import AutoSortingConfiguration from '../views/auto-sorting/AutoSortingConfiguration.vue';
import WaveManagement from '../views/auto-sorting/WaveManagement.vue';
import ChuteMonitor from '../views/auto-sorting/ChuteMonitor.vue';
import SortingStrategy from '../views/auto-sorting/SortingStrategy.vue';
import BusinessStrategy from '../views/auto-sorting/BusinessStrategy.vue';
import GroupConfiguration from '../views/auto-sorting/GroupConfiguration.vue';
import PackagesMonitor from '../views/auto-sorting/PackagesMonitor.vue';
import SortingSetup from '../views/auto-sorting/SortingSetup.vue';
import ChuteAllocationManagement from '../views/auto-sorting/ChuteAllocationManagement.vue';
import AdminTools from '../views/auto-sorting/AdminTools.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "Debug",
    component: Debug,
  },
  {
    path: "/autoSortingMain",
    name: "AutoSortingMain",
    component: AutoSortingMain,
    children: [
        {
            path: '',
            name: "ChuteMonitor",
            component: ChuteMonitor
        },
        {
          path: 'autoSortingConfiguration',
          name: "AutoSortingConfiguration",
          component: AutoSortingConfiguration
        },
        {
            path: 'groupConfiguration',
            name: "GroupConfiguration",
            component: GroupConfiguration
        },
        {
            path: 'waveManagement',
            name: "WaveManagement",
            component: WaveManagement
        },
        {
            path: 'sortingStrategy',
            name: "sortingStrategy",
            component: SortingStrategy
        },
        {
            path: 'businessStrategy',
            name: "businessStrategy",
            component: BusinessStrategy
        },
        {
            path: 'packagesMonitor',
            name: "packagesMonitor",
            component: PackagesMonitor
        },
        {
            path: 'sortingSetup',
            name: "sortingSetup",
            component: SortingSetup
        },
        {
            path: 'chuteAllocationManagement',
            name: "chuteAllocationManagement",
            component: ChuteAllocationManagement
        },
        {
            path: 'adminTools',
            name: "AdminTools",
            component: AdminTools
        }
    ]
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
