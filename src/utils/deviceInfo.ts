// Utility to get device information
export const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  
  // Get device model/name
  let deviceModel = 'Unknown Device';
  if (/iPhone/.test(userAgent)) {
    deviceModel = 'iPhone';
  } else if (/iPad/.test(userAgent)) {
    deviceModel = 'iPad';
  } else if (/Android/.test(userAgent)) {
    const match = userAgent.match(/Android[^;]+;[^;]+;[^;]+?([^;)]+)/);
    deviceModel = match ? match[1].trim() : 'Android Device';
  } else if (/Windows/.test(userAgent)) {
    deviceModel = 'Windows Device';
  } else if (/Macintosh/.test(userAgent)) {
    deviceModel = 'Mac';
  }
  
  // Get OS
  let deviceOS = 'Unknown OS';
  if (/iPhone|iPad/.test(userAgent)) {
    const match = userAgent.match(/OS (\d+_\d+)/);
    deviceOS = match ? `iOS ${match[1].replace('_', '.')}` : 'iOS';
  } else if (/Android/.test(userAgent)) {
    const match = userAgent.match(/Android ([\d.]+)/);
    deviceOS = match ? `Android ${match[1]}` : 'Android';
  } else if (/Windows NT/.test(userAgent)) {
    const match = userAgent.match(/Windows NT ([\d.]+)/);
    deviceOS = match ? `Windows ${match[1]}` : 'Windows';
  } else if (/Mac OS X/.test(userAgent)) {
    const match = userAgent.match(/Mac OS X ([\d_]+)/);
    deviceOS = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  }
  
  // Generate a unique device ID based on browser fingerprint
  const deviceId = generateDeviceId();
  
  return {
    deviceId,
    deviceModel,
    deviceOS
  };
};

// Generate a consistent device ID using available browser data
const generateDeviceId = (): string => {
  // Try to get from localStorage first
  const storedId = localStorage.getItem('device_id');
  if (storedId) return storedId;
  
  // Create fingerprint from available data
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let fingerprint = '';
  
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('DeviceID', 2, 2);
    fingerprint = canvas.toDataURL();
  }
  
  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    fingerprint
  ].join('|');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const deviceId = 'device_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
  localStorage.setItem('device_id', deviceId);
  
  return deviceId;
};
