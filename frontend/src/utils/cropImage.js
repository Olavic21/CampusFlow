/**
 * Recadre une image en carré via canvas (zoom + position).
 * @param {string} imageSrc - data URL ou blob URL
 * @param {{ x: number, y: number }} crop - position en px dans le conteneur
 * @param {number} zoom - 1 = 100%
 * @param {number} containerSize - taille du viewport de crop
 * @param {number} outputSize - taille finale (px)
 */
export async function getCroppedImageBlob(
  imageSrc,
  { crop, zoom, containerSize },
  outputSize = 512,
) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');

  const scale = (image.width / containerSize) * zoom;
  const sw = containerSize * scale;
  const sh = containerSize * scale;
  const sx = -crop.x * scale;
  const sy = -crop.y * scale;

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outputSize, outputSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Impossible de générer l\'image'));
      },
      'image/webp',
      0.9,
    );
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
