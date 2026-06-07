import { useCallback, useRef } from 'react';
import { isNativePlatform } from '../utils/capacitor';

function blobToFile(blob, name = 'avatar.jpg') {
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

export async function pickFromCapacitor(source = 'camera') {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const photo = await Camera.getPhoto({
    source: source === 'gallery' ? CameraSource.Photos : CameraSource.Camera,
    resultType: CameraResultType.Blob,
    quality: 90,
    width: 1024,
    height: 1024,
  });
  if (!photo.blob) throw new Error('Photo vide');
  return blobToFile(photo.blob, `avatar.${photo.format || 'jpeg'}`);
}

/**
 * Sélection fichier web + @capacitor/camera sur APK Android.
 */
export function useAvatarPicker() {
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);

  const openGallery = useCallback(() => {
    galleryRef.current?.click();
  }, []);

  const openCamera = useCallback(() => {
    cameraRef.current?.click();
  }, []);

  const openGalleryNative = useCallback(async (onFile) => {
    if (await isNativePlatform()) {
      try {
        const file = await pickFromCapacitor('gallery');
        onFile?.(file);
        return true;
      } catch {
        /* fallback input */
      }
    }
    openGallery();
    return false;
  }, [openGallery]);

  const openCameraNative = useCallback(async (onFile) => {
    if (await isNativePlatform()) {
      try {
        const file = await pickFromCapacitor('camera');
        onFile?.(file);
        return true;
      } catch {
        /* fallback input */
      }
    }
    openCamera();
    return false;
  }, [openCamera]);

  const inputProps = {
    gallery: {
      ref: galleryRef,
      type: 'file',
      accept: 'image/jpeg,image/png,image/webp',
      className: 'hidden',
      'aria-hidden': true,
    },
    camera: {
      ref: cameraRef,
      type: 'file',
      accept: 'image/jpeg,image/png,image/webp',
      capture: 'environment',
      className: 'hidden',
      'aria-hidden': true,
    },
  };

  return {
    openGallery,
    openCamera,
    openGalleryNative,
    openCameraNative,
    inputProps,
    galleryRef,
    cameraRef,
  };
}
