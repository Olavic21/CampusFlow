import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, ImageIcon, ZoomIn, Trash2 } from 'lucide-react';
import { useAvatarPicker } from '../../hooks/useAvatarPicker';
import { validateAvatarFile } from '../../utils/avatar';
import { getCroppedImageBlob } from '../../utils/cropImage';
import UserAvatar from './UserAvatar';

const CROP_SIZE = 280;

export default function AvatarEditorModal({
  open,
  onClose,
  user,
  onConfirmUpload,
  onDelete,
  uploading = false,
}) {
  const [step, setStep] = useState('menu');
  const [previewSrc, setPreviewSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, cropX: 0, cropY: 0 });
  const { openGallery, openCamera, inputProps, galleryRef, cameraRef } = useAvatarPicker();

  const reset = useCallback(() => {
    setStep('menu');
    setPreviewSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setError('');
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleFile = useCallback((file, source) => {
    const err = validateAvatarFile(file);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setStep('crop');
  }, []);

  const onGalleryChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file, 'gallery');
    e.target.value = '';
  };

  const onCameraChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file, 'camera');
    e.target.value = '';
  };

  const handlePointerDown = (e) => {
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      cropX: crop.x,
      cropY: crop.y,
    };
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setCrop({
      x: dragStart.current.cropX + dx,
      y: dragStart.current.cropY + dy,
    });
  };

  const handlePointerUp = () => setDragging(false);

  const handleConfirmCrop = async () => {
    if (!previewSrc) return;
    setError('');
    setStep('uploading');
    try {
      const blob = await getCroppedImageBlob(
        previewSrc,
        { crop, zoom, containerSize: CROP_SIZE },
        512,
      );
      await onConfirmUpload(blob);
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'envoi');
      setStep('crop');
    }
  };

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[700] flex items-end md:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 md:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-editor-title"
          className="cf-menu-card w-full max-w-md max-h-[92dvh] overflow-hidden flex flex-col md:rounded-[24px] rounded-t-[24px]"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/50">
            <h2 id="avatar-editor-title" className="font-bold text-slate-800 dark:text-white">
              Photo de profil
            </h2>
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fermer">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 overflow-y-auto sidebar-scroll flex-1">
            {step === 'menu' && (
              <div className="flex flex-col items-center gap-4">
                <UserAvatar user={user} size={96} animate />
                <p className="font-semibold text-slate-800 dark:text-white">{user?.full_name}</p>
                <p className="text-sm text-slate-500">{user?.email}</p>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2 w-full" role="alert">
                    {error}
                  </p>
                )}

                <input {...inputProps.gallery} ref={galleryRef} onChange={onGalleryChange} />
                <input {...inputProps.camera} ref={cameraRef} onChange={onCameraChange} />

                <div className="w-full space-y-2">
                  {isMobile ? (
                    <>
                      <button type="button" onClick={openCamera} className="cf-btn-primary w-full flex items-center justify-center gap-2">
                        <Camera size={18} />
                        Prendre une photo
                      </button>
                      <button type="button" onClick={openGallery} className="cf-btn-secondary w-full flex items-center justify-center gap-2">
                        <ImageIcon size={18} />
                        Choisir depuis la galerie
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={openGallery} className="cf-btn-primary w-full">
                      Modifier l&apos;avatar
                    </button>
                  )}
                  {user?.avatar && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await onDelete?.();
                          onClose();
                        } catch (err) {
                          setError(err.message || 'Erreur');
                        }
                      }}
                      className="cf-btn-danger w-full flex items-center justify-center gap-2"
                      disabled={uploading}
                    >
                      <Trash2 size={16} />
                      Supprimer la photo
                    </button>
                  )}
                  <button type="button" onClick={onClose} className="w-full text-sm text-slate-500 py-2">
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {(step === 'crop' || step === 'uploading') && previewSrc && (
              <div className="space-y-4">
                <div
                  className="relative mx-auto rounded-full overflow-hidden bg-slate-900 touch-none select-none"
                  style={{ width: CROP_SIZE, height: CROP_SIZE }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                >
                  <img
                    src={previewSrc}
                    alt="Aperçu"
                    draggable={false}
                    className="absolute max-w-none origin-top-left pointer-events-none"
                    style={{
                      transform: `translate(${crop.x}px, ${crop.y}px) scale(${zoom})`,
                      width: CROP_SIZE,
                      height: 'auto',
                    }}
                  />
                  <div className="absolute inset-0 ring-4 ring-white/40 rounded-full pointer-events-none" />
                </div>

                <div className="flex items-center gap-2 px-2">
                  <ZoomIn size={16} className="text-slate-400 shrink-0" />
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1"
                    aria-label="Zoom"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="cf-btn-secondary flex-1"
                    onClick={() => {
                      URL.revokeObjectURL(previewSrc);
                      setStep('menu');
                    }}
                    disabled={step === 'uploading'}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="cf-btn-primary flex-1"
                    onClick={handleConfirmCrop}
                    disabled={step === 'uploading' || uploading}
                  >
                    {step === 'uploading' || uploading ? 'Envoi…' : 'Confirmer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
