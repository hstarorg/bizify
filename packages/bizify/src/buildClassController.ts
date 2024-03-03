import type { ControllerBaseOptions } from 'bizify-core';
import { AbstractController } from 'bizify-core';
import { Component, PureComponent } from 'react';

export function buildClassController<T extends AbstractController>(
  Ctrl: T | { new (): T },
  componentIns: Component | PureComponent,
  options?: ControllerBaseOptions,
) {
  let ctrlIns: T;
  if (Ctrl instanceof Function) {
    ctrlIns = new Ctrl().__init(options);
  } else {
    ctrlIns = Ctrl;
  }

  // 订阅变更
  const unsubscribe = ctrlIns.$subscribe(() => {
    componentIns.setState({ $change_flag: {} });
  });

  // 组件卸载时需要取消订阅
  const userComponentWillUnmount = componentIns.componentWillUnmount;
  componentIns.componentWillUnmount = function (...args: any[]) {
    if (typeof userComponentWillUnmount === 'function') {
      // @ts-ignore
      userComponentWillUnmount.call(componentIns, ...args);
    }
    // 取消订阅
    unsubscribe();
  };
  // 返回控制器实例
  return ctrlIns;
}
