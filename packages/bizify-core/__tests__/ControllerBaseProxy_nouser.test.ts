import { ControllerBaseProxy } from '../src';

type PageData = {
  a: number;
  c: { d: number };
  arr?: string[];
  map?: Map<string, string>;
};

class TestCtrl extends ControllerBaseProxy<PageData> {
  protected $data(): PageData {
    return { a: 1, c: { d: 2 } };
  }

  // 同步 a += n
  plusA = (n: number) => {
    this.data.a += n;
  };

  // 异步 a += n
  plusAsync = (n: number) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.data.a += n;
        resolve(true);
      });
    });
  };
}

describe('ControllerBaseProxy test', () => {
  let vm!: TestCtrl;
  let changeFn;

  beforeEach(async () => {
    changeFn = jest.fn();
    vm = new TestCtrl().__init({});
  });

  test('$subscribe', () => {
    vm!.data.a = 2;
    expect(vm.data.a).toBe(2);
    // 未订阅变更，不会被调用
    expect(changeFn).toHaveBeenCalledTimes(0);
    const unsub = vm.$subscribe(changeFn);
    vm.plusA(1);
    expect(vm.data.a).toBe(3);
    // 订阅变更，changeFn 会被调用
    expect(changeFn).toBeCalledTimes(1);

    unsub();
    vm.plusA(-2);
    expect(vm.data.a).toBe(1);
    // 取消订阅，不触发新的调用
    expect(changeFn).toBeCalledTimes(1);
  });
});
