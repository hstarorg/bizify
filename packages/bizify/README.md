# `bizify`

> 一个实践 OOP 的业务框架，分离前端业务逻辑与 UI。让不同的同学写更一致的代码。

文档可见：https://hstarorg.github.io/bizify

## Usage

在控制类中以 OOP 的风格编写业务逻辑

```ts
// Demo1Ctrl.ts
import { ControllerBaseProxy } from 'bizify';

type DemoPageData = {
  val: number;
};

export class Demo1Ctrl extends ControllerBaseProxy<DemoPageData> {
  $data(): DemoPageData {
    return { val: 1 };
  }

  // 注意用箭头函数
  plus = () => {
    this.data.val += 1;
  };
}

```

使用 `useController` 连接控制类和 UI（React）

```ts
import React from 'react';
import { Button } from 'antd';
import { useController } from 'bizify';
import { Demo1Ctrl } from './Demo1Ctrl';

export default function Demo1() {
  const vm = useController<Demo1Ctrl>(Demo1Ctrl);
  const vmData = vm.data;
  return (
    <div>
      <span>当前value: {vmData.val}</span>
      <br />
      <Button type="primary" onClick={vm.plus}>点我加 1</Button>
    </div>
  );
}

```
