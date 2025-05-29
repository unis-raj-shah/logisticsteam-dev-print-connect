import AsyncLock from 'async-lock';

const lock = new AsyncLock();


class LockService {
    async acquire(keyName: string, fn: any) {
        return new Promise((resolve, reject) => {
            lock.acquire(keyName, async () => {
                try {
                    const result = await fn();
                    resolve(result);
                } catch (err: any) {
                    console.log('acquire fn err', err.message); // 输出错误信息
                    reject(err);
                }
            }).catch((err: any) => {
                console.log('acquire err', err.message); // 输出错误信息
                reject(err);
            });
        });
    }
}

export default new LockService();
