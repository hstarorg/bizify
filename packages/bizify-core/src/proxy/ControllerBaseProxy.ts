import { AbstractController } from '../AbstractController';
import {
  ControllerBaseOptions,
  DeepReadonly,
  ServiceOptions,
} from '../bizify.lib';
import { internalUtil } from '../interalUtil';
import { ProxyTargetType } from './ProxyTargetType';
import { EventEmitter } from 'events';
import { EventTypes } from '../EventTypes';
import { ServiceWrapper } from '../ServiceWrapper';

export abstract class ControllerBaseProxy<
  TData extends Record<string, any> = any,
> extends AbstractController {
  /**
   * 利用函数来返回数据值，（对比属性 data）可以做更多的校验
   */
  protected abstract $data(): DeepReadonly<TData>;

  public readonly data!: TData;

  private proxyMap = new WeakMap<any, any>();
  // 标记是否是批量更新中，如果是批量更新，则中途不需要触发变更
  private isBatching = false;
  // 作为实例属性而不是直接继承，是为了保证用户访问接口的纯粹性
  private eventBus = new EventEmitter();

  public $subscribe(subFn: (...args: any[]) => void): () => void {
    this.eventBus.on(EventTypes.Change, subFn);
    // 返回 unsubscribe 函数
    return () => {
      this.eventBus.off(EventTypes.Change, subFn);
    };
  }

  __init(options: ControllerBaseOptions) {
    const realData = internalUtil.mergeData(this.$data(), {});
    // 此处要绕开一下 readonly
    (this as any).data = this.reactive(realData);
    return this;
  }

  /**
   * 批量更新
   * @param updateFn
   */
  protected $batchUpdate(updateFn: () => void) {
    this.isBatching = true;
    try {
      updateFn();
      this.isBatching = false;
      this.emitChange();
    } catch (ex) {
      this.isBatching = false;
      this.emitChange();
      // 不处理错误，扔给业务层
      throw ex;
    }
  }

  protected $buildService<RT, FN extends (...args: any[]) => RT = any>(
    asyncFn: FN,
    serviceOptions?: ServiceOptions,
  ): ServiceWrapper<RT, FN> {
    return new ServiceWrapper(asyncFn, this.emitChange, serviceOptions);
  }

  /**
   * 注意此处用箭头函数锁定下 this，不然 ServiceWrapper 那里会出现 this 异常
   * @returns
   */
  private emitChange = () => {
    if (this.isBatching) {
      return;
    }
    this.eventBus.emit(EventTypes.Change);
  };

  /**
   * 将数据转换为可响应对象
   * @param obj
   * @returns
   */
  private reactive(obj: Record<string, any>): any {
    const targetType = this.getProxyTargetType(obj);
    // 暂时先放着，实际是执行不到的
    if (targetType !== ProxyTargetType.COMMON) {
      console.warn('value must be an array or an object.');
    }
    const self = this;
    return new Proxy(obj, {
      // 拦截（代理） set 操作
      set(target, p: string | symbol, value: any, receiver: any) {
        const result = Reflect.set(target, p, value, receiver);
        // 触发变更
        self.emitChange();
        return result;
      },

      // 拦截 get 操作
      get(target, p: string | symbol, receiver: any) {
        // 先找到 value
        const value = Reflect.get(target, p, receiver);
        // 如果这个值是一个可响应对象，那就需要再代理一次
        if (internalUtil.isReactiveObject(value)) {
          // 通过缓存代理对象避免深度代理
          if (self.proxyMap.has(value)) {
            return self.proxyMap.get(value);
          }
          const proxyedValue = self.reactive(value);
          self.proxyMap.set(value, proxyedValue);
          return proxyedValue;
        }
        return value;
      },

      // 拦截 delete 操作
      deleteProperty(target, p: string | symbol) {
        const result = Reflect.deleteProperty(target, p);
        self.emitChange();
        return result;
      },

      // 没太多拦截的必要，先写着
      has(target, p: string | symbol) {
        return Reflect.has(target, p);
      },
    });
  }

  /**
   * 获取代理目标类型
   * @param obj
   * @returns
   */
  private getProxyTargetType(obj): ProxyTargetType {
    const rawType = internalUtil.getRawType(obj);
    switch (rawType) {
      case 'Object':
      case 'Array':
        return ProxyTargetType.COMMON;
      case 'Map':
      case 'Set':
      case 'WeakMap':
      case 'WeakSet':
        return ProxyTargetType.COLLECTION;
      default:
        return ProxyTargetType.INVALID;
    }
  }
}
