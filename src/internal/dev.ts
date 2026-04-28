declare const process: { env?: { NODE_ENV?: string } } | undefined;

export const isDev: boolean =
  typeof process !== 'undefined' &&
  process.env?.NODE_ENV !== 'production';
