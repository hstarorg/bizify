import { folio } from 'folio';
import { reactive, effect } from '@vue/reactivity';

const { describe, test, beforeAll, beforeEach, expect } = folio;

folio.describe('bizify-core', () => {
  folio.test('testssss', () => {
    const p = reactive({});
    effect(() => {
      console.log('abc');
    });
    p.a = 1;
  });
});
