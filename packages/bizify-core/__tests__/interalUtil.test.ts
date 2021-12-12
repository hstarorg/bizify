import { internalUtil } from '../src/interalUtil';
describe('interalUtil test', () => {
  test('test mergeData', () => {
    let result = internalUtil.mergeData(null, null);
    expect(result).toStrictEqual({});

    result = internalUtil.mergeData(null, { a: 1 });
    expect(result).toStrictEqual({ a: 1 });

    result = internalUtil.mergeData({ a: 1 }, null);
    expect(result).toStrictEqual({ a: 1 });

    result = internalUtil.mergeData({ a: 1 }, { a: '1' });
    expect(result).toStrictEqual({ a: '1' });

    // 不会删除已有属性
    result = internalUtil.mergeData({ a: 1, b: 2 }, { a: '1' });
    expect(result).toStrictEqual({ a: '1', b: 2 });

    // 数组合并，是覆盖而不是追加
    result = internalUtil.mergeData({ arr: [1] }, { arr: [2] });
    expect(result).toStrictEqual({ arr: [2] });

    // 深层合并，只会第一层覆盖
    result = internalUtil.mergeData(
      { user: { name: '1' } },
      { user: { age: 3 } },
    );
    expect(result).toStrictEqual({ user: { age: 3 } });
  });

  test('test getRawType', () => {
    const valArr: { val: any; type: string }[] = [
      { val: {}, type: 'Object' },
      { val: new Object(), type: 'Object' },
      { val: [], type: 'Array' },
      { val: 1, type: 'Number' },
      { val: 'str', type: 'String' },
      { val: new Date(), type: 'Date' },
      { val: BigInt(2), type: 'BigInt' },
      { val: false, type: 'Boolean' },
      { val: undefined, type: 'Undefined' },
      { val: null, type: 'Null' },
      { val: Symbol(), type: 'Symbol' },
      { val: new Number(1), type: 'Number' },
      { val: new String(1), type: 'String' },
      { val: new Map(), type: 'Map' },
      { val: new WeakMap(), type: 'WeakMap' },
      { val: new Set(), type: 'Set' },
      { val: new WeakSet(), type: 'WeakSet' },
    ];
    valArr.forEach(item => {
      const rawType = internalUtil.getRawType(item.val);
      expect(rawType).toBe(item.type);
    });
  });

  test('test isReactiveObject', () => {
    const trueArr: any[] = [{}, [], new Array(), new Object()];
    const falseArr: any[] = [1, 'str', new Set()];
    trueArr.forEach(item => {
      let result = internalUtil.isReactiveObject(item);
      expect(result).toBe(true);
    });
    falseArr.forEach(item => {
      let result = internalUtil.isReactiveObject(item);
      expect(result).toBe(false);
    });
  });
});
