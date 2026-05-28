import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.carimurah.app',
  appName: 'CariMurah',
  webDir: 'dist',
  "bundledWebRuntime": false,
  "server": {
    "url": "https://carimurah-ai-362566137704.asia-southeast1.run.app",
    "cleartext": true
  }
};

export default config;
