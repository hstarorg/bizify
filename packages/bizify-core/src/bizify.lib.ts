declare type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | undefined
  | null;

declare type Builtin = Primitive | Function | Date | Error | RegExp;

declare const RefSymbol: unique symbol;

declare interface Ref<T = any> {
  value: T;
  /**
   * Type differentiator only.
   * We need this to be in public d.ts but don't want it to show up in IDE
   * autocomplete, so we use a private Symbol instead.
   */
  [RefSymbol]: true;
  /* Excluded from this release type: _shallow */
}

export declare type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Map<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends ReadonlyMap<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends WeakMap<infer K, infer V>
  ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends Set<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends ReadonlySet<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends WeakSet<infer U>
  ? WeakSet<DeepReadonly<U>>
  : T extends Promise<infer U>
  ? Promise<DeepReadonly<U>>
  : T extends Ref<infer U>
  ? Ref<DeepReadonly<U>>
  : T extends {}
  ? {
      readonly [K in keyof T]: DeepReadonly<T[K]>;
    }
  : Readonly<T>;
