declare var platform: { [s: string]: any };
declare var config: { [s: string]: any };
declare var chuteList: { [s: string]: any };
declare module 'async-lock';
declare module 'file-saver' {
    export function saveAs(data: Blob | File, filename?: string, options?: any): void;
};
declare var aScanQueue: boolean;
declare var socketConnected: boolean;
declare var packageBondedQueue: boolean;
declare var currentSocket: any;
declare var getAmazonawsPackageQueue: boolean;
