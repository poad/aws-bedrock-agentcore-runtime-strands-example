import { defineConfig } from 'vitest/config';
import * as dotenv from '@dotenvx/dotenvx';

export default defineConfig({
  server: {
    fs: {
      // モノレポ内のファイルアクセスを許可
      allow: ['..'],
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      // ESModuleとして出力
      output: {
        format: 'es',
      },
    },
  },
  root: '.',
  test: {
    environment: 'node',
    globals: true,
    isolate: true,
    env: dotenv.config({ path: '.env.test' }).parsed,
    testTimeout: 30000,
  },
  // resolve: {
  //   conditions: ['development'],
  // }
});
