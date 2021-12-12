import React, { PureComponent } from 'react';
import { Button } from 'antd';
import { buildClassController } from 'bizify';
import { Demo2Ctrl } from './Demo2Ctrl';

export default class Demo1 extends PureComponent {
  private vm: Demo2Ctrl;
  constructor(props) {
    super(props);
    this.vm = buildClassController<Demo2Ctrl>(Demo2Ctrl, this);
  }
  render(): React.ReactNode {
    const vm = this.vm;
    const vmData = vm.data;
    return (
      <div>
        <span>当前value: {vmData.val}</span>
        <br />
        <Button type="primary" onClick={vm.plus}>点我加 1</Button>
      </div>
    );
  }
}
