class UtilService {
    waitBySeconds(seconds: number) {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, seconds * 1000);
        });
    }

    stringify(msg: any) {
        if (typeof msg === 'object') {
            try {
                return JSON.stringify(msg);
            } catch (e) {
                return msg;
            }
        }
        return msg;
    }

    generateTraceId(): string {
        const timestamp = Date.now(); // 获取当前时间戳
        const randomPart = Math.floor(Math.random() * 10000).toString(16).toUpperCase().padStart(4, '0'); // 生成随机的 4 位 16 进制数
        return `${timestamp}-${randomPart}`;
    }

}

export default new UtilService();
