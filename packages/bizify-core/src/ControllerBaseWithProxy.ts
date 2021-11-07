import { AbstractController } from './AbstractController';

export abstract class ControllerBaseWithProxy<
  TData extends Record<string, any> = any,
> extends AbstractController {}
