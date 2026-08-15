/**
 * Client-side image compression helper using HTML5 Canvas.
 * Resizes large smartphone camera photos (5-15MB) to max 1200px and JPEG quality 0.75 (~150KB),
 * preventing Vercel 4.5MB request payload limit errors and ensuring fast mobile background upload.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<File> {
  // If file is already small (< 300KB) and is an image, skip canvas compression
  if (file.size <= 300 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file); // Fallback to original if canvas context unavailable
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }

            const fileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            const compressedFile = new File([blob], fileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => {
        console.warn('Image load error during compression, using original file:', err);
        resolve(file);
      };
    };
    reader.onerror = (err) => {
      console.warn('FileReader error during compression, using original file:', err);
      resolve(file);
    };
  });
}
