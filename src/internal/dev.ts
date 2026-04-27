declare const process:
  | { env?: { NODE_ENV?: string } | undefined }
  | undefined;

export const isDev: boolean =
  typeof process !== 'undefined' &&
  typeof process?.env !== 'undefined' &&
  process.env?.NODE_ENV !== 'production';
