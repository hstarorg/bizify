import React, { useEffect, useReducer, useRef } from 'react';
import {
  AbstractController,
  type ControllerBaseOptions,
} from '../../bizify-core/src';

export function useController<T extends AbstractController>(
  Ctrl: T | { new (): T },
  options?: ControllerBaseOptions,
) {
  const unsubscribeRef = React.useRef<() => void>();
  const initialedRef = useRef(false);
  const ctrlRef = useRef<any>();

  const [, forceUpdate] = useReducer((prev) => prev + 1, 1);

  // 组件卸载时，取消订阅
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  if (!initialedRef.current) {
    let ctrl: T | null = null;
    if (Ctrl instanceof Function) {
      ctrl = new Ctrl().__init(options);
    } else {
      ctrl = Ctrl;
    }
    initialedRef.current = true;
    ctrlRef.current = ctrl;
    unsubscribeRef.current = ctrl.$subscribe(() => {
      forceUpdate();
    });
    return ctrl as any;
  }

  return ctrlRef.current!;
}
