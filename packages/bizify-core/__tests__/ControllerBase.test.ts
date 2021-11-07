import { folio } from 'folio';

const { describe, test, beforeEach, expect } = folio;
import { ControllerBase } from '../src';
import { DeepReadonly } from '../src/bizify.lib';

type PageData = { a: number; c: { d: Number } };
class TestCtrl extends ControllerBase<PageData> {
  $data(): PageData {
    return { a: 1, c: { d: 2 } };
  }

  updateDValue(n) {
    this.$updateByPath('c.d', n);
    this.data.c.d;
    this.$update({ a: 1 });
  }
}

describe('bizify-core', () => {
  let vm: TestCtrl = null;
  let vmData: DeepReadonly<PageData>;
  beforeEach(async () => {
    vm = new TestCtrl();
    vmData = vm.data;
  });

  test('$updateByPath', () => {
    expect(vmData.a).toBe(1);
    vm.updateDValue(22);
    expect(vmData.c.d).toBe(22);
  });
});
