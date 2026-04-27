import { defineConfig } from 'rolldown';

const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'valtio',
  'valtio/vanilla',
  'valtio/utils',
];

const input = {
  index: 'src/index.ts',
  core: 'src/core/index.ts',
};

export default defineConfig([
  {
    input,
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/[name]-[hash].js',
      sourcemap: true,
    },
    external,
  },
  {
    input,
    output: {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      chunkFileNames: 'chunks/[name]-[hash].cjs',
      sourcemap: true,
      exports: 'named',
    },
    external,
  },
]);
