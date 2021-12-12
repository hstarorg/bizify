import { EventEmitter } from 'events';
import { EventTypes } from './EventTypes';
import { internalUtil } from './interalUtil';

export class ServiceWrapper<RT, FN extends (...args: unknown[]) => RT> {
  private notifyFn: () => void;
  private requestQueue: string[] = [];
  private eventBus = new EventEmitter();

  // Service 状态，多次执行以最后为准
  private serviceState: 'none' | 'pending' | 'rejected' | 'fulfilled' = 'none';
  // Service 数据
  private serviceData: any;
  // 服务异常
  private serviceError: any;
  // 首次完成后，后续都是true
  private sreviceLoaded: boolean = false;

  readonly execute: (...args: Parameters<FN>) => Promise<RT>;

  /**
   * 是否处于 loading 状态
   */
  get loading() {
    return this.serviceState === 'pending';
  }

  /**
   * 是否处于失败状态
   */
  get failed() {
    return this.serviceState === 'rejected';
  }

  /**
   * 是否已完成首次执行
   */
  get loaded() {
    return this.sreviceLoaded;
  }

  get data(): RT {
    return this.serviceData;
  }

  /**
   * 异常
   */
  get error(): Error {
    return this.serviceError;
  }

  constructor(asyncFn: FN, notifyFn: () => void, options?: any) {
    this.notifyFn = notifyFn;
    this.execute = (...args: Parameters<FN>) => {
      const reqId = internalUtil.generateRndString();
      this.requestQueue.unshift(reqId);
      this.serviceState = 'pending';
      this.notifyFn();
      return Promise.resolve()
        .then(() => {
          return asyncFn.apply(null, args);
        })
        .then(data => {
          if (reqId === this.requestQueue[this.requestQueue.length - 1]) {
            this.requestQueue.pop();
            return data;
          }
          return new Promise(resolve => {
            const handlerFn = () => {
              if (reqId === this.requestQueue[this.requestQueue.length - 1]) {
                this.requestQueue.pop();
                this.eventBus.off(EventTypes.RequestDone, handlerFn);
                resolve(data);
              }
            };
            this.eventBus.on(EventTypes.RequestDone, handlerFn);
          });
        })
        .then(data => {
          this.serviceData = data;
          this.serviceState = 'fulfilled';
          return data;
        })
        .catch(reason => {
          this.serviceError = reason;
          this.serviceState = 'rejected';
          if (reqId === this.requestQueue[this.requestQueue.length - 1]) {
            this.requestQueue.pop();
          }
          return Promise.reject(reason);
        })
        .finally(() => {
          this.sreviceLoaded = true;
          this.eventBus.emit(EventTypes.RequestDone, {});
          this.notifyFn();
        });
    };
  }
}
