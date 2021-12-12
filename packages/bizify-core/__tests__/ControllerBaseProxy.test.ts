import { ControllerBaseProxy } from '../src';

type PageData = {
  a: number;
  c: { d: Number };
  arr?: string[];
  map?: Map<string, string>;
};

class TestCtrl extends ControllerBaseProxy<PageData> {
  $data(): PageData {
    return { a: 1, c: { d: 2 } };
  }

  // 同步 a += n
  plusA = (n: number) => {
    this.data.a += n;
  };

  // 异步 a += n
  plusAsync = (n: number) => {
    return new Promise(resolve => {
      setTimeout(() => {
        this.data.a += n;
        resolve(true);
      });
    });
  };

  updateMore = () => {
    this.$batchUpdate(() => {
      this.data.a = 10;
      this.data.arr = new Array(1000).fill('s');
      this.data.arr.shift();
    });
  };

  updateMoreThrowError = () => {
    this.$batchUpdate(() => {
      this.data.a = 10;
      const a: any = {};
      // 这句会报错
      a.test();
      this.data.arr = new Array(1000).fill('s');
      this.data.arr.shift();
    });
  };
}

describe('ControllerBaseProxy test', () => {
  let vm: TestCtrl = null;
  let vmData: PageData;
  let changeFn;

  beforeEach(async () => {
    changeFn = jest.fn();
    vm = new TestCtrl().__init({});
    vm.$subscribe(changeFn);
    vmData = vm.data;
  });

  test('sync update data', () => {
    vmData.a = 2;
    expect(vm.data.a).toBe(2);
  });

  test('variable address not change', () => {
    var c = { d: 1 };
    vmData.c = c;
    vmData.c.d = 2;
    expect(vm.data.c).toStrictEqual(c);
  });

  test('get data not emit change', () => {
    expect(vmData.a).toBe(1);
    expect(changeFn).toBeCalledTimes(0);
  });

  test('test execute biz function', () => {
    expect(vmData.a).toBe(1);
    vm.plusA(2);
    expect(vmData.a).toBe(3);
    expect(changeFn).toBeCalledTimes(1);
  });

  test('test execute async biz function', async () => {
    expect(vmData.a).toBe(1);
    await vm.plusAsync(2);
    expect(vmData.a).toBe(3);
    expect(changeFn).toBeCalledTimes(1);
  });

  test('test execute async biz function 2', async () => {
    expect(vmData.a).toBe(1);
    const p = vm.plusAsync(2);
    expect(vmData.a).toBe(1);
    await p;
    expect(vmData.a).toBe(3);
    expect(changeFn).toBeCalledTimes(1);
  });

  test('test execute async biz function multiple', async () => {
    expect(vmData.a).toBe(1);
    const p = vm.plusAsync(2);
    expect(vmData.a).toBe(1);
    await p;
    expect(vmData.a).toBe(3);
    await vm.plusAsync(3);
    expect(vmData.a).toBe(6);
    expect(changeFn).toBeCalledTimes(2);
  });

  test('test add property', () => {
    const anyData = vmData as any;
    anyData.d = 1;
    expect(changeFn).toBeCalledTimes(1);
    expect(anyData.d).toBe(1);
    anyData.bcd = 'str';
    expect(anyData.bcd).toBe('str');
    expect(changeFn).toBeCalledTimes(2);
  });

  test('test delete property', () => {
    delete vmData.a;
    expect(vmData.a).toBe(undefined);
    expect(changeFn).toBeCalledTimes(1);
  });

  test('test has', () => {
    expect('arr' in vmData).toBe(false);
    expect(changeFn).toBeCalledTimes(0);
    vmData.arr = [];
    expect('arr' in vmData).toBe(true);
    expect(changeFn).toBeCalledTimes(1);
  });

  // TODO: 数组的变更监控可以优化
  test('test array change: push|unshift', () => {
    vmData.arr = [];
    expect(changeFn).toBeCalledTimes(1);
    vmData.arr.push('s1');
    // // 一次 push 触发了两次变更：set arr[index]=xx， set length=xx
    expect(changeFn).toBeCalledTimes(3);

    vmData.arr.unshift('s0');
    expect(vmData.arr.length).toBe(2);
    expect(vmData.arr[0]).toBe('s0');
    // 此处是 6 次，一次 unshift 变更了三次：先移动 s1, 再设置 s0，再设置length
    expect(changeFn).toBeCalledTimes(6);
  });

  test('test array change: pop|shift', () => {
    vmData.arr = ['s1', 's2', 's3'];
    expect(changeFn).toBeCalledTimes(1);

    vmData.arr.shift();
    // shift 就必须复杂了：是length（移动元素次数） + 2（干掉自己+更新length）
    expect(changeFn).toBeCalledTimes(5);

    vmData.arr.pop();
    // pop 比较好理解，干掉自己，设置长度
    expect(changeFn).toBeCalledTimes(7);
  });

  // TODO：优化数组监控
  test('test array change: max shift', () => {
    vmData.arr = new Array(1000).fill('s1');
    expect(changeFn).toBeCalledTimes(1);

    vmData.arr.shift();
    // shift 就必须复杂了：是length（移动元素次数） + 2（干掉自己+更新length）
    expect(changeFn).toBeCalledTimes(1002);
  });

  test('test set map value not emit change', () => {
    vmData.map = new Map();
    expect(changeFn).toBeCalledTimes(1);
    vmData.map.set('a', 'av');
    expect(changeFn).toBeCalledTimes(1);
  });

  test('test batchUpdate', () => {
    vm.updateMore();
    // updateMore 做了很多事情，但也只会触发一次更新
    expect(changeFn).toBeCalledTimes(1);
  });

  test('test batchUpdate with exception', () => {
    // 会出错
    expect(() => {
      vm.updateMoreThrowError();
    }).toThrowError();

    // 出错前的数据变更有效
    expect(vmData.a).toBe(10);
    // 出错后的数据变更无效
    expect(vmData.arr).toBeUndefined();

    // updateMore 做了很多事情，但也只会触发一次更新
    expect(changeFn).toBeCalledTimes(1);

    // 后续的变更继续有效
    vm.plusA(10);
    expect(vmData.a).toBe(20);
    expect(changeFn).toBeCalledTimes(2);
  });

  test('test reactive data type', () => {
    class T2Ctrl extends ControllerBaseProxy {
      $data() {
        return { a: new Map() };
      }
    }
    const vm = new T2Ctrl().__init({});
    vm.$subscribe(changeFn);
    expect(vm.data.a).toHaveProperty('set');
    vm.data.a.set('a', 1);
    expect(changeFn).toBeCalledTimes(0);
    expect(vm.data.a.get('a')).toBe(1);
  });
});
