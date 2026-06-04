import { useCallback, useRef } from 'react';

/**
 * Sélection fichier web + prêt pour @capacitor/camera (APK).
 * Retourne un File ou null ; source indique 'gallery' | 'camera' | 'file'.
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

  /**
   * Future intégration Capacitor :
   * import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
   * const photo = await Camera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.Blob });
   */
  const pickFromCapacitor = useCallback(async (_source) => {
    throw new Error('Capacitor Camera non configuré — utilisez le navigateur');
  }, []);

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

  return { openGallery, openCamera, pickFromCapacitor, inputProps, galleryRef, cameraRef };
}
