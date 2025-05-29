import HID from 'node-hid';
import cache from './shared/cache';
import _ from 'lodash';

const weightUnits = [
    'mg',
    'g',
    'kg',
    'Ct',
    'Tales',
    'Grains',
    'Pennyweights',
    'Metric Ton',
    'Avoir Ton',
    'Troy Ounce',
    'Ounce',
    'LB',
];
let scale: any = {};
let device: any = {};

function findScaleDevice() {
    return HID.devices().filter(function (d) {
        const isMettler = d.vendorId === 3768 && d.productId === 61440;
        return isMettler && d.usagePage === 0x8d && d.usage === 1;
    });
}

function connectScale(deviceInfo: any) {
    device = new HID.HID(deviceInfo.path);
    device.on('data', function (data: any) {
        const weighData = parseInt(data[5].toString(16) + data[4].toString(16), 16);
        scale.status =
            data[1] === 0x04
                ? 'Weighting'
                : data[1] === 0x02
                ? 'Nothing on scale'
                : data[1] === 0x05
                ? 'Negative weight'
                : 'UNKNOWN';
        scale.weight = weighData / 100;
        scale.weightUnit = weightUnits[data[2] - 1] ? weightUnits[data[2] - 1] : 'UNKNOWN';
    });
    device.on('error', function (err: any) {
        device.close();
        scale = {};
        console.log('电子秤连接已断开，尝试重连中。。。');
        initScaleConnect();
    });
}

const changeDefaultScale = (path: string): void => {
    const deviceList = cache.getCache('scales');
    const deviceInfo = deviceList.find((item: any) => item.path === path);
    device.close();
    connectScale(deviceInfo);
};

const findScale = () => {
    const deviceList = findScaleDevice();
    if (!_.isEmpty(deviceList) && deviceList.length > 0) {
        const deviceInfo: any = deviceList[0];
        deviceInfo.isDefault = true;
        connectScale(deviceInfo);
        return deviceList;
    } else {
        console.log('connect error: No find scale!');
        return [];
    }
};

const initScaleConnect = (): void => {
    let timer: any = null;
    cache.setCache('scales', []);
    timer = setInterval(() => {
        const scaleList = findScale();
        if (scaleList.length > 0) {
            console.log('当前连接的USB电子秤设备:', scaleList);
            cache.setCache('scales', scaleList);
            clearInterval(timer);
        }
    }, 1000);
};

const getScaleData = (): any => {
    return scale;
};

export { getScaleData, initScaleConnect, changeDefaultScale };
