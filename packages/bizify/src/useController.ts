import { useEffect, useMemo, useRef, useReducer } from 'react';
import { AbstractController } from 'bizify-core';
import type { ControllerBaseOptions } from 'bizify-core';

export function useController<T extends AbstractController>(
  Ctrl: T | { new (): T },
  options?: ControllerBaseOptions,
) {
  const unsubscribeRef = useRef<() => void>();
  const [_, forceUpdate] = useReducer(prev => prev + 1, 1);
  // 控制器实例
  const ctrlIns = useMemo(() => {
    let ctrl: T;
    if (Ctrl instanceof Function) {
      ctrl = new Ctrl().__init(options);
    } else {
      ctrl = Ctrl;
    }
    unsubscribeRef.current = ctrl.$subscribe(() => {
      forceUpdate();
    });
    return ctrl;
  }, []);

  // 组件卸载时，取消订阅
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return ctrlIns;
}
