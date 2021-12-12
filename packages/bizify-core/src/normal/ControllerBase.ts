import { AbstractController } from '../AbstractController';
import lodashSet from 'lodash.set';
import { DeepReadonly } from '../bizify.lib';

export abstract class ControllerBase<
  TData extends Record<string, any> = any,
> extends AbstractController {
  private innerData: any;
  get data(): DeepReadonly<TData> {
    return this.innerData;
  }
  abstract $data(): TData;

  protected $update(part) {}

  protected $updateByPath(path: string, value: unknown) {
    lodashSet(this.innerData, path, value);
  }
}
