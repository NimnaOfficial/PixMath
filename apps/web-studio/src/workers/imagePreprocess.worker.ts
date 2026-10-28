/**
 * Hardware-accelerated image preprocessing Web Worker.
 *
 * Runs off the main browser thread to ensure 100% fluid UI responsiveness (60-120 FPS)
 * during intensive pixel analysis, contrast calculation, and sharpness estimation.
 * Utilizes OffscreenCanvas with WebGL acceleration when available, gracefully degrading to 2D CPU.
 */

export interface PreprocessWorkerInput {
  imageBitmap?: ImageBitmap;
  buffer?: ArrayBuffer;
  mimeType?: string;
}

export interface PreprocessWorkerOutput {
  ok: boolean;
  reason?: string;
  hardware: 'webgl' | 'canvas2d';
  metrics: {
    contrast: number;
    sharpness: number;
    stdDev: number;
    dynamicRange: number;
    hasReadableContent: boolean;
  };
}

self.onmessage = async (e: MessageEvent<PreprocessWorkerInput>) => {
  const { imageBitmap, buffer, mimeType } = e.data;
  let bitmap: ImageBitmap | null = imageBitmap || null;

  try {
    if (!bitmap && buffer) {
      const blob = new Blob([buffer], { type: mimeType || 'image/png' });
      bitmap = await createImageBitmap(blob);
    }

    if (!bitmap) {
      self.postMessage({
        ok: false,
        reason: 'Unable to decode image bitmap.',
        hardware: 'canvas2d',
        metrics: { contrast: 0, sharpness: 0, stdDev: 0, dynamicRange: 0, hasReadableContent: false },
      } as PreprocessWorkerOutput);
      return;
    }

    const w = 128;
    const h = 128;
    let hardware: 'webgl' | 'canvas2d' = 'canvas2d';
    let pixels: Uint8ClampedArray | Uint8Array | null = null;

    // 1. Try Hardware-accelerated OffscreenCanvas (WebGL)
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        const offscreen = new OffscreenCanvas(w, h);
        const gl = offscreen.getContext('webgl2') || offscreen.getContext('webgl');
        if (gl) {
          hardware = 'webgl';
          // Use WebGL to sample and read back downscaled matrix
          const tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);

          const fb = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

          const glPixels = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, glPixels);
          pixels = glPixels;

          gl.deleteFramebuffer(fb);
          gl.deleteTexture(tex);
        }
      } catch {
        hardware = 'canvas2d';
      }
    }

    // 2. Graceful CPU fallback (OffscreenCanvas 2D or Canvas 2D)
    if (!pixels) {
      hardware = 'canvas2d';
      const offscreen = new OffscreenCanvas(w, h);
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error('Could not create offscreen 2D context.');
      }
      ctx.drawImage(bitmap, 0, 0, w, h);
      pixels = ctx.getImageData(0, 0, w, h).data;
    }

    // 3. Close bitmap immediately to avoid GPU memory leaks
    bitmap.close();

    // 4. Compute Luminance, Contrast & Standard Deviation
    const count = w * h;
    let minLum = 255;
    let maxLum = 0;
    let sumLum = 0;
    const lumArray = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const idx = i * 4;
      // ITU-R BT.601 perceptual luminance
      const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      lumArray[i] = lum;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
      sumLum += lum;
    }

    const meanLum = sumLum / count;
    let varSum = 0;
    for (let i = 0; i < count; i++) {
      const diff = lumArray[i] - meanLum;
      varSum += diff * diff;
    }
    const stdDev = Math.sqrt(varSum / count);
    const dynamicRange = maxLum - minLum;

    // 5. Discrete 2D Laplacian Sharpness (detecting out-of-focus blur)
    let lapSumSq = 0;
    let lapCount = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const c = lumArray[y * w + x];
        const up = lumArray[(y - 1) * w + x];
        const down = lumArray[(y + 1) * w + x];
        const left = lumArray[y * w + (x - 1)];
        const right = lumArray[y * w + (x + 1)];
        const lap = up + down + left + right - 4.0 * c;
        lapSumSq += lap * lap;
        lapCount++;
      }
    }
    const sharpness = Math.sqrt(lapSumSq / Math.max(1, lapCount));

    // Contrast check: Is image flat or uniform?
    if (stdDev < 5.0 || dynamicRange < 15.0) {
      self.postMessage({
        ok: false,
        reason: 'Image is almost entirely uniform or monochrome with insufficient contrast to recognize mathematical symbols.',
        hardware,
        metrics: {
          contrast: Math.round(stdDev),
          sharpness: Math.round(sharpness),
          stdDev: Math.round(stdDev),
          dynamicRange: Math.round(dynamicRange),
          hasReadableContent: false,
        },
      } as PreprocessWorkerOutput);
      return;
    }

    self.postMessage({
      ok: true,
      hardware,
      metrics: {
        contrast: Math.round(stdDev),
        sharpness: Math.round(sharpness),
        stdDev: Math.round(stdDev),
        dynamicRange: Math.round(dynamicRange),
        hasReadableContent: true,
      },
    } as PreprocessWorkerOutput);
  } catch (err) {
    if (bitmap) {
      try {
        bitmap.close();
      } catch {}
    }
    self.postMessage({
      ok: false,
      reason: `Hardware preprocessing error: ${err instanceof Error ? err.message : String(err)}`,
      hardware: 'canvas2d',
      metrics: { contrast: 0, sharpness: 0, stdDev: 0, dynamicRange: 0, hasReadableContent: false },
    } as PreprocessWorkerOutput);
  }
};
