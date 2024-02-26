import 'antd/dist/antd.css';
import React from 'react';
import { Button } from 'antd';
import { useController } from 'bizify';
import { DemoCtrl } from './DemoCtrl';

export default function Demo1() {
  const vm = useController<DemoCtrl>(DemoCtrl);
  const {
    data: vmData,
    services: { testApi },
  } = vm;

  console.log(testApi.data, testApi);

  const user: any = testApi.data;

  return (
    <div>
      <p>
        <span>用户ID： {user?.userId}</span> &nbsp;{' '}
        <span>用户名： {user?.userName}</span>{' '}
      </p>
      <Button
        type="primary"
        onClick={vm.getUserDetail}
        loading={testApi.loading}>
        查询用户信息
      </Button>
    </div>
  );
}
