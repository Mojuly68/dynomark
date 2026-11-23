import { Capacitor } from '@capacitor/core';

/** True inside the iOS/Android app built with Capacitor (TestFlight), false in a browser or Home Screen web app. */
export const isNative = () => Capacitor.isNativePlatform();

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/**
 * In the native app, web downloads and the web share sheet don't work, so files are written to the
 * app's cache folder and handed to the iOS share sheet (Save Image, Messages, Files, AirDrop...).
 */
export async function shareFileNative(name: string, data: Blob | string, title = 'DYNOMARK'): Promise<'shared' | 'cancelled'> {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const res = typeof data === 'string'
    ? await Filesystem.writeFile({ path: name, data, directory: Directory.Cache, encoding: Encoding.UTF8 })
    : await Filesystem.writeFile({ path: name, data: await blobToBase64(data), directory: Directory.Cache });
  try {
    await Share.share({ title, files: [res.uri] });
    return 'shared';
  } catch {
    return 'cancelled';
  }
}

/** Light status-bar text on the dark theme, dark text on the light theme (native app only). */
export async function syncStatusBar(theme: 'dark' | 'light') {
  if (!isNative()) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch(() => undefined);
}

/** A short tap of the phone's haptic engine (native app only; silent elsewhere). */
export async function haptic(kind: 'light' | 'success') {
  if (!isNative()) return;
  const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
  try {
    if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
    else await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* no haptic engine */ }
}
