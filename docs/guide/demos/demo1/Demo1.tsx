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
