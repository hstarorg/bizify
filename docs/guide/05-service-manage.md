---
nav: Guide
group:
  title: Basic
  order: 0
order: 5
---

# 服务管理

使用 bizify 的 Service 特性可以非常方便的管理页面上的异步服务（以请求请求为主）

```ts
import { ControllerBaseProxy } from 'bizify';

type DemoPageData = {
  val: number;
};

function mockRequest(userId: string): any {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ userId: userId, userName: 'Hi' });
    }, 500);
  });
}

export class DemoCtrl extends ControllerBaseProxy<DemoPageData> {
  $data(): DemoPageData {
    return { val: 1 };
  }

  getUserDetail = () => {
    const { testApi } = this.services;
    testApi.execute('001');
  };

  services = {
    testApi: this.$buildService(mockRequest),
  };
}

```

## 直接使用

<code src="./demos/demo-service-manage/index.tsx" />

