import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'Jevly',
    description: 'A mark on the draft and a check before you send.',
    permissions: ['storage'],
    host_permissions: ['https://api.typesafe.ai/*', 'http://127.0.0.1/*'],
  },
});
