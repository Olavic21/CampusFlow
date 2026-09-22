let _native = null;

export async function isNativePlatform() {
  if (_native !== null) return _native;
  try {
    const { Capacitor } = await import('@capacitor/core');
    _native = Capacitor.isNativePlatform();
  } catch {
    _native = false;
  }
  return _native;
}

export async function initCapacitor() {
  if (!(await isNativePlatform())) return;

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    const { StatusBar, Style } = await import('@capacitor/status-bar');

    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#2563EB' });
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch {
    /* plugins optionnels */
  }
}

export async function getNetworkStatus() {
  try {
    const { Network } = await import('@capacitor/network');
    return Network.getStatus();
  } catch {
    return { connected: navigator.onLine };
  }
}
