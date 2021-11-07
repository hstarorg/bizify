import { folio } from 'folio';

const { describe, test, beforeAll, beforeEach, expect } = folio;
import { ControllerBase } from './ControllerBase';
import { DeepReadonly } from './bizify.lib';

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

folio.describe('bizify-core', () => {
  let vm: TestCtrl = null;
  let vmData: DeepReadonly<PageData>;
  beforeEach(async () => {
    vm = new TestCtrl();
    vmData = vm.data;
  });

  folio.test('$updateByPath', () => {
    expect(vmData.a).toBe(1);
    vm.updateDValue(22);
    expect(vmData.c.d).toBe(22);
  });
});
