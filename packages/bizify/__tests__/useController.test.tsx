import '@testing-library/jest-dom';
import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { useController, ControllerBaseProxy } from '../src';

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

const CompA = () => {
  const vm = useController<DemoCtrl>(DemoCtrl);
  const vmData = vm.data;
  return (
    <div>
      <span>{vmData.val}</span>
      <button onClick={vm.plus}>plus</button>
    </div>
  );
};

describe('useController test', () => {
  it('basic test', () => {
    render(<CompA />);
    expect(screen.queryByText('1')).toBeInTheDocument();
    fireEvent.click(screen.queryByText('plus'));
    expect(screen.queryByText('2')).toBeInTheDocument();
  });
});
