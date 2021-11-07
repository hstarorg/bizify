import { folio } from 'folio';
import { reactive, effect, stop } from '@vue/reactivity';

const { describe, test, beforeAll, beforeEach, expect } = folio;

folio.describe('bizify-core', () => {
  folio.test('testssss', () => {
    const p = reactive<any>({});

    let aaa;
    const run = effect(() => {
      aaa = p;
    });
    stop(run);

    p.a = 1;
    p.b = 2;

    expect(p.a).toBe(1);
  });
});
