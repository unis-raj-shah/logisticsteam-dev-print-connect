class TimerManager {
  private static instance: TimerManager;
  private timers: { [key: string]: number } = {};
  private timerFunctions: { [key: string]: () => void } = {};
  private constructor() {
    console.log("constructor");
  }

  // 获取 TimerManager 的单例实例
  public static getInstance(): TimerManager {
    if (!TimerManager.instance) {
      TimerManager.instance = new TimerManager();
    }
    return TimerManager.instance;
  }

  // 添加一个定时器
  public addTimer(id: string, callback: () => void, interval: number): void {
    if (!this.timers[id]) {
      this.timerFunctions[id] = callback;
      const timerId = window.setInterval(this.timerFunctions[id], interval);
      this.timers[id] = timerId;
    }
  }

  // 清除一个定时器
  public clearTimer(id: string): void {
    if (this.timers[id]) {
      window.clearInterval(this.timers[id]);
      delete this.timers[id];
    }
  }

  // 清除所有定时器
  public clearAllTimers(): void {
    for (const id in this.timers) {
      window.clearInterval(this.timers[id]);
      delete this.timers[id];
    }
  }
}

export default TimerManager;
