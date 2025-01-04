import lodashSet from 'lodash.set';
import { AbstractController } from '../AbstractController';
import { DeepReadonly } from '../bizify.lib';

export abstract class ControllerBase<
  TData extends Record<string, any> = any,
> extends AbstractController {
  private innerData: any;
  get data(): DeepReadonly<TData> {
    return this.innerData;
  }
  protected abstract $data(): TData;

  protected $update(part: any) {
    this.innerData = part;
  }

  protected $updateByPath(path: string, value: unknown) {
    lodashSet(this.innerData, path, value);
  }
}
