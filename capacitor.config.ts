
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c930f6666e004b598c5749bac8d85aa0',
  appName: 'GuardHQ Mobile',
  webDir: 'dist',
  // Removed server config for web browser use
  plugins: {
    Camera: {
      permissions: {
        camera: 'Camera access is needed to take photos for security reports'
      }
    },
    BarcodeScanner: {
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
