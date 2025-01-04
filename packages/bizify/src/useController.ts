import { AbstractController, type ControllerBaseOptions } from 'bizify-core';
import { useEffect, useReducer, useRef } from 'react';

export function useController<T extends AbstractController>(
  Ctrl: T | { new (): T },
  options?: ControllerBaseOptions,
) {
  const ctrlRef = useRef<T | null>(null);
  const [, forceUpdate] = useReducer((prev) => prev + 1, 0);

  // 初始化 Controller
  if (!ctrlRef.current) {
    let ctrl: T;
    if (Ctrl instanceof Function) {
      ctrl = new Ctrl().__init(options);
    } else {
      ctrl = Ctrl;
    }
    ctrlRef.current = ctrl;
  }

  // 设置订阅和清理逻辑
  useEffect(() => {
    const ctrl = ctrlRef.current!;
    const unsubscribe = ctrl.$subscribe(() => {
      forceUpdate();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return ctrlRef.current!;
}
