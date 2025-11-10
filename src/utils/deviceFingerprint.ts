/**
 * Device fingerprinting utility for tracking guard devices
 * Generates a unique identifier based on device characteristics
 */

interface DeviceInfo {
  deviceId: string;
  deviceModel: string;
  deviceOs: string;
  userAgent: string;
}

/**
 * Generate a device fingerprint based on browser/device characteristics
 */
export function generateDeviceFingerprint(): string {
  const nav = window.navigator;
  const screen = window.screen;
  
  const components = [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
  ];
  
  const fingerprint = components.join('|||');
  
  // Create a simple hash
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return 'device_' + Math.abs(hash).toString(36);
}

/**
 * Get detailed device information
 */
export function getDeviceInfo(): DeviceInfo {
  const nav = window.navigator;
  const userAgent = nav.userAgent;
  
  // Detect device model
  let deviceModel = 'Unknown Device';
  if (/iPhone/.test(userAgent)) {
    deviceModel = 'iPhone';
  } else if (/iPad/.test(userAgent)) {
    deviceModel = 'iPad';
  } else if (/Android/.test(userAgent)) {
    const match = userAgent.match(/Android.*?([A-Za-z0-9\s]+);/);
    deviceModel = match ? match[1].trim() : 'Android Device';
  } else if (/Windows/.test(userAgent)) {
    deviceModel = 'Windows PC';
  } else if (/Mac/.test(userAgent)) {
    deviceModel = 'Mac';
  } else if (/Linux/.test(userAgent)) {
    deviceModel = 'Linux PC';
  }
  
  // Detect OS
  let deviceOs = 'Unknown OS';
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    const match = userAgent.match(/OS (\d+_\d+)/);
    deviceOs = match ? `iOS ${match[1].replace('_', '.')}` : 'iOS';
  } else if (/Android/.test(userAgent)) {
    const match = userAgent.match(/Android (\d+\.?\d*)/);
    deviceOs = match ? `Android ${match[1]}` : 'Android';
  } else if (/Windows NT/.test(userAgent)) {
    const match = userAgent.match(/Windows NT (\d+\.\d+)/);
    deviceOs = match ? `Windows ${match[1]}` : 'Windows';
  } else if (/Mac OS X/.test(userAgent)) {
    const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    deviceOs = match ? `macOS ${match[1].replace('_', '.')}` : 'macOS';
  } else if (/Linux/.test(userAgent)) {
    deviceOs = 'Linux';
  }
  
  return {
    deviceId: generateDeviceFingerprint(),
    deviceModel,
    deviceOs,
    userAgent,
  };
}
