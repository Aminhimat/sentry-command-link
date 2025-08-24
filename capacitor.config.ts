
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
    BarcodeScanner: {
      permissions: {
        camera: 'Camera access is required for QR code scanning'
      }
    },
    App: {
      launchUrl: 'guard'
    }
  },
  android: {
    iconDensity: "mdpi"
  },
  ios: {
    iconGenerateFor: [
      "iphone-small@2x",
      "iphone-small@3x", 
      "iphone-40@2x",
      "iphone-40@3x",
      "iphone-60@2x",
      "iphone-60@3x",
      "ipad-20",
      "ipad-20@2x",
      "ipad-29",
      "ipad-29@2x",
      "ipad-40",
      "ipad-40@2x",
      "ipad-76",
      "ipad-76@2x",
      "ipad-83.5@2x",
      "ios-marketing"
    ]
  }
};

export default config;
