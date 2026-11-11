import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.carimurah.app',
  appName: 'CariMurah',
  webDir: 'dist',
  "bundledWebRuntime": false,
  "server": {
    "url": "https://carimurah.elpeef.com/",
    "cleartext": true
  }
};

export default config;
