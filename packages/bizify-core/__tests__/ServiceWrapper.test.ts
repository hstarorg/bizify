import { ServiceWrapper } from '../src/ServiceWrapper';

/**
 * 构建一个异步函数
 * @param ms
 * @param failed
 * @returns
 */
function buildAsyncFn(ms: number, failed: boolean = false) {
  return (val: string) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (failed) {
          reject(val);
          return;
        }
        resolve(val);
      }, ms);
    });
  };
}

describe('ServiceWrapper test', () => {
  let sw: ServiceWrapper<unknown, (...args: unknown[]) => unknown>;
  let notifyFn: () => void;
  beforeEach(() => {
    notifyFn = jest.fn();
  });

  test('service will succeed', async () => {
    sw = new ServiceWrapper(buildAsyncFn(500), notifyFn);
    expect(sw.loaded).toBe(false);
    expect(sw.loading).toBe(false);
    const p = sw.execute('hi');
    expect(sw.loading).toBe(true);
    await p;
    expect(sw.loaded).toBe(true);
    expect(sw.loading).toBe(false);
    expect(sw.failed).toBe(false);
    expect(sw.data).toBe('hi');
    expect(notifyFn).toBeCalledTimes(2);
  });

  test('service will failed', async () => {
    sw = new ServiceWrapper(buildAsyncFn(500, true), notifyFn);
    expect(sw.loaded).toBe(false);
    expect(sw.loading).toBe(false);
    const p = sw.execute('error');
    expect(sw.loading).toBe(true);

    await expect(p).rejects.toBeTruthy();

    expect(sw.loaded).toBe(true);
    expect(sw.loading).toBe(false);
    expect(sw.failed).toBe(true);
    expect(sw.error).toBe('error');
    expect(notifyFn).toHaveBeenCalledTimes(2);
  });
});
