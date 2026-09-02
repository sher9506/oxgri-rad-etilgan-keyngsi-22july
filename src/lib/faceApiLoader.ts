// Singleton Face-api.js preloader
// App yuklanishi bilan fonda yuklaydi, FaceCapture esa shu yuklanganidan foydalanadi

declare global {
  interface Window {
    faceapi: any;
  }
}

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
const SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.min.js';

let _loadingPromise: Promise<void> | null = null;
let _isLoaded = false;
let _loadError: string | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Script yuklanmadi: ${src}`));
    document.head.appendChild(s);
  });
}

/**
 * Face-api.js script + modellarni yuklab olish (singleton).
 * Bir marta chaqirilsa bo'ladi, keyingi chaqiruvlar shu promise'ga qaytadi.
 */
export function preloadFaceApi(): Promise<void> {
  if (_isLoaded) return Promise.resolve();
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
    try {
      // Script yuklash
      await loadScript(SCRIPT_URL);

      // Modellarni parallel yuklash (tinyFaceDetector — 3x tezroq, 190KB vs 5.4MB)
      const faceapi = window.faceapi;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      _isLoaded = true;
      _loadError = null;
      console.log('✅ Face-api.js modellari fonda muvaffaqiyatli yuklandi');
    } catch (e: any) {
      _loadError = e?.message || 'Face-api preload xatosi';
      _loadingPromise = null; // Qayta urinishga ruxsat berish
      console.error('❌ Face-api preload xatosi:', e);
      throw e;
    }
  })();

  return _loadingPromise;
}

/** Modellar to'liq yuklanganmi? */
export function isFaceApiLoaded(): boolean {
  return _isLoaded;
}

/** Yuklash xatosi bo'lganmi? */
export function getFaceApiError(): string | null {
  return _loadError;
}

/** Yuklash jarayoni davom etayaptimi? */
export function isFaceApiLoading(): boolean {
  return _loadingPromise !== null && !_isLoaded;
}

/** Mavjud promise'ga qo'shilish (FaceCapture ishlatadi) */
export function awaitFaceApi(): Promise<void> {
  if (_isLoaded) return Promise.resolve();
  if (_loadingPromise) return _loadingPromise;
  return preloadFaceApi();
}
