import '@testing-library/jest-dom';
import React, { Component } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ControllerBaseProxy, buildClassController } from '../src';

type DemoData = {
  val: number;
};

class DemoCtrl extends ControllerBaseProxy<DemoData> {
  $data(): DemoData {
    return { val: 1 };
  }

  plus = () => {
    this.data.val += 1;
  };
}

class CompA extends Component {
  vm: DemoCtrl;
  constructor(props: any) {
    super(props);
    this.vm = buildClassController<DemoCtrl>(DemoCtrl, this);
  }
  render(): React.ReactNode {
    const vm = this.vm;
    const vmData = vm.data;

    return (
      <div>
        <span>{vmData.val}</span>
        <button type="button" onClick={vm.plus}>
          plus
        </button>
      </div>
    );
  }
}

describe('buildClassController test', () => {
  it.skip('basic test for class controller', () => {
    render(<CompA />);
    expect(screen.queryByText('1')).toBeInTheDocument();
    fireEvent.click(screen.queryByText('plus')!);
    expect(screen.queryByText('2')).toBeInTheDocument();
  });
});
