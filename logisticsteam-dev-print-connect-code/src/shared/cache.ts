import Store from 'electron-store'
const store = new Store();


class LocalCache {
  setCache(key: string, value: any) {
    store.set(key, JSON.stringify(value));
  }
  getCache(key: string) {
    const value : any = store.get(key);
    try {
      return JSON.parse(value);
    } catch (error) {
      return value
    }
    // if (value && value !="undefined") {
    //   return JSON.parse(value);
    // }else{
      return value
    // }
  }
  deleteCache(key: string) {
    store.delete(key);
  }
  clearCache() {
    store.clear();
  }
}

export default new LocalCache();
