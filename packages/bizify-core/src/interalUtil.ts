const rawToString = Object.prototype.toString;

enum ReactiveObjectTypes {
  Object = 'Object',
  Array = 'Array',
}

export const internalUtil = {
  /**
   * 获取对象的真实类型，其思路是借助 toString 的结果（对比 typeof 更加准确）
   * toString 的结果是 [object RawType]
   * @param value
   * @returns
   */
  getRawType(value: unknown): string {
    return rawToString.call(value).slice(8, -1);
  },

  /**
   * 返回对象是否可以被响应（
   * @param val
   * @returns
   */
  isReactiveObject(val: unknown) {
    const rawType = this.getRawType(val);
    return (
      rawType === ReactiveObjectTypes.Object ||
      rawType === ReactiveObjectTypes.Array
    );
  },

  /**
   * 合并对象，注意：只合并首层
   * @param data1
   * @param data2
   * @returns
   */
  mergeData(data1: Record<string, any>, data2: Record<string, any>) {
    return { ...(data1 || {}), ...(data2 || {}) };
  },

  /**
   * 生成随机字符串
   * @returns
   */
  generateRndString() {
    return Math.random().toString(16).slice(2);
  },
};
