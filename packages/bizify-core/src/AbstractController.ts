import { ControllerBaseOptions } from './bizify.lib';

export abstract class AbstractController {
  /**
   * 这是业务逻辑和视图桥接的核心接口
   * 当业务逻辑执行触发了数据（状态）变化时，就会触发一次变更事件，那么订阅函数就需要根据不同的 view 实现来触发重绘
   * @param subFn
   */
  public abstract $subscribe(subFn: (...args: any[]) => void): () => void;

  public abstract __init(options?: ControllerBaseOptions): AbstractController;
}
