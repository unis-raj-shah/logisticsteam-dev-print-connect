import dayjs from 'dayjs';
import {getUserHome} from '@/db/autoSorting';

function getCurrentTime() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

class AutoSortingService {
  get logger() {
    return {
      info(msg: any) {
        console.log(`${getCurrentTime()} ${JSON.stringify(msg)}`);
      },
      error(msg: any) {
        console.log(`${getCurrentTime()} Error: ${JSON.stringify(msg)}`);
      },
    };
  }
}
const singleton = new AutoSortingService();

export default singleton;
