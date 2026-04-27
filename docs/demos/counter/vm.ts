import { ViewModelBase } from 'bizify';

export interface CounterState {
  count: number;
}

export class CounterVM extends ViewModelBase<CounterState> {
  protected $data(): CounterState {
    return { count: 0 };
  }

  plus() {
    this.data.count += 1;
  }

  minus() {
    this.data.count -= 1;
  }

  reset() {
    this.data.count = 0;
  }
}
