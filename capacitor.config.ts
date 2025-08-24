
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c930f6666e004b598c5749bac8d85aa0',
  appName: 'GuardHQ Mobile',
  webDir: 'dist',
  server: {
    url: "https://c930f666-6e00-4b59-8c57-49bac8d85aa0.lovableproject.com?forceHideBadge=true",
    cleartext: true
  },
  plugins: {
    Camera: {
      permissions: {
        camera: 'Camera access is needed to take photos for security reports'
      }
    },
    BarcodeScanning: {
      permissions: {
        camera: 'Camera access is required for QR code scanning'
      }
    },
    App: {
      launchUrl: 'guard'
    }
  }
};

export default config;
