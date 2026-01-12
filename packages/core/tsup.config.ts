import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'types/index': 'src/types/index.ts',
    'ipc/index': 'src/ipc/index.ts',
    'playbook/index': 'src/playbook/index.ts',
    'self-healing/index': 'src/self-healing/index.ts',
    'security/index': 'src/security/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['playwright'],
});
