---
nav: Guide
group:
  title: Basic
  order: 0
order: 0
---

# 安装

```bash
$ pnpm i bizify
```

# 基本使用

## 两步使用 bizify

简单两步即可使用 `bizify`

1. 创建 Controller

```ts
import { ControllerBaseProxy } from 'bizify';

type DemoPageData = {
  val: number;
};

export class DemoCtrl extends ControllerBaseProxy<DemoPageData> {
  $data(): DemoPageData {
    return { val: 1 };
  }

  // 注意用箭头函数
  plus = () => {
    this.data.val += 1;
  };
}
```

2. 绑定到视图

```ts
import React from 'react';
import { useController } from 'bizify';
import { Button } from 'antd';
import { Demo1Ctrl } from './Demo1Ctrl';

export default function Demo1() {
  const vm = useController<Demo1Ctrl>(Demo1Ctrl);
  const vmData = vm.data;
  return (
    <div>
      <span>当前value: {vmData.val}</span>
      <br />
      <Button onClick={vm.plus}>点我加 1</Button>
    </div>
  );
}
```

## 函数式组件中使用

<code src="./demos/demo1/Demo1.tsx" />

## 在类组件中使用

<code src="./demos/demo2/Demo2.tsx" />
