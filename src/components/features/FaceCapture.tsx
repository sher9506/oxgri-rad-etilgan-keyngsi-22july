
import { useEffect, useRef, useState } from 'react';
import {
  Camera, CheckCircle, AlertCircle, Loader2, ShieldAlert,
  ArrowRight, ArrowLeft, Eye, Sun, UserCheck, RefreshCw,
  PhoneCall, GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { awaitFaceApi, isFaceApiLoaded } from '@/lib/faceApiLoader';

interface FaceCaptureProps {
  mode: 'register' | 'login';
  onCaptureComplete: (descriptor: number[], faceImageBase64?: string, fraudInfo?: FraudResult) => void;
  onCancel: () => void;
  targetDescriptor?: number[] | null;
  // Ustoz login: { ustoz, descriptor }[] formatida
  // Yagona kirish (unified): bo'sh array [] — barcha descriptorlar tashqarida taqqoslanadi
  allDescriptors?: { ustoz?: any; id?: string; descriptor: number[] }[];
  captureImage?: boolean;
  registerInfo?: {
    ism: string;
    familiya: string;
    kurs: string;
    guruh: string;
  };
  loginInfo?: {
    ism: string;
    familiya: string;
    kurs: string;
    guruh: string;
  };
}

interface FraudResult {
  detected: boolean;
  mosTalaba?: any;
  distance?: number;
  frameBase64?: string;
}

declare global {
  interface Window {
    faceapi: any;
  }
}

type ScanStep = 'center' | 'right' | 'left' | 'done';
type StatusType = 'loading' | 'ready' | 'detecting' | 'success' | 'error' | 'fraud';
type YawDir = 'center' | 'right' | 'left';

function faceDistance(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 1;
  const faceapi = window.faceapi;
  if (faceapi?.euclideanDistance) {
    return faceapi.euclideanDistance(new Float32Array(a), new Float32Array(b));
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

function calculateFaceYaw(landmarks: any): YawDir {
  try {
    const pts = landmarks.positions;
    const noseTip = pts[30];
    const leftEdge = pts[0];
    const rightEdge = pts[16];
    const faceWidth = rightEdge.x - leftEdge.x;
    if (faceWidth < 10) return 'center';
    const noseRatio = (noseTip.x - leftEdge.x) / faceWidth;
    if (noseRatio < 0.42) return 'right';
    if (noseRatio > 0.58) return 'left';
    return 'center';
  } catch {
    return 'center';
  }
}

const STEP_INFO: Record<ScanStep, { label: string; color: string }> = {
  center: { label: "Kameraga to'g'ri qarang", color: 'text-blue-600' },
  right: { label: "Iltimos, o'ngga qarang →", color: 'text-amber-600' },
  left: { label: '← Iltimos, chapga qarang', color: 'text-purple-600' },
  done: { label: 'Identifikatsiya yakunlandi ✓', color: 'text-green-600' },
};

function getThreshold(retryCount: number): number {
  return retryCount === 0 ? 0.50 : 0.60;
}

export default function FaceCapture({
  mode,
  onCaptureComplete,
  onCancel,
  targetDescriptor,
  allDescriptors,
  captureImage = false,
  registerInfo,
  loginInfo,
}: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusType>('loading');
  const [message, setMessage] = useState('Face-api.js yuklanmoqda...');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  const [showNoFaceHint, setShowNoFaceHint] = useState(false);
  const noFaceTimerRef = useRef<number | null>(null);
  const faceDetectedAtLeastOnceRef = useRef(false);

  const retryCountRef = useRef(0);
  const [retryCount, setRetryCount] = useState(0);

  // Ustoz override
  const [showUstozOverride, setShowUstozOverride] = useState(false);
  const [ustozOverrideScanning, setUstozOverrideScanning] = useState(false);
  const [ustozOverrideMessage, setUstozOverrideMessage] = useState('');
  const ustozOverrideModeRef = useRef(false);

  // 3 sekund ichida yuz mos kelmaganida chiqadigan xabar
  const [showNoMatchWarning, setShowNoMatchWarning] = useState(false);
  const noMatchStartRef = useRef<number | null>(null); // yuz aniqlandi, lekin mos kelmagan vaqt boshladi
  const noMatchTriggeredRef = useRef(false);

  const detectionIntervalRef = useRef<number | null>(null);
  const successfulMatchesRef = useRef<number>(0);
  const fraudCheckDoneRef = useRef(false);
  const descriptorHistoryRef = useRef<number[][]>([]);

  const [scanStep, setScanStep] = useState<ScanStep>('center');
  const scanStepRef = useRef<ScanStep>('center');
  const completedStepsRef = useRef<Set<ScanStep>>(new Set());
  const centerFramesRef = useRef(0);
  const [centerProgress, setCenterProgress] = useState(0);
  const stepCooldownRef = useRef(false);

  const [foundUstoz, setFoundUstoz] = useState<{ name: string; confidence: number } | null>(null);
  // allDescriptors=[] bo'lsa unified login (descriptor tashqarida taqqoslanadi)
  // allDescriptors=[...] bo'lsa ustoz login
  const isUnifiedLogin = mode === 'login' && Array.isArray(allDescriptors) && allDescriptors.length === 0;
  const isUstozLogin = !!allDescriptors && allDescriptors.length > 0;

  const [fraudInfo, setFraudInfo] = useState<{
    mosTalaba: string; mosTalabaGuruh: string; oxshashlik: number;
  } | null>(null);
  const [fraudDetectedResult, setFraudDetectedResult] = useState<FraudResult | null>(null);
  const [showFraudWarning, setShowFraudWarning] = useState(false);
  const fraudWarningTimerRef = useRef<number | null>(null);

  useEffect(() => {
    loadFaceAPI();
    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (detectionIntervalRef.current) { clearInterval(detectionIntervalRef.current); detectionIntervalRef.current = null; }
    if (fraudWarningTimerRef.current) { clearTimeout(fraudWarningTimerRef.current); fraudWarningTimerRef.current = null; }
    if (noFaceTimerRef.current) { clearTimeout(noFaceTimerRef.current); noFaceTimerRef.current = null; }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    successfulMatchesRef.current = 0;
    descriptorHistoryRef.current = [];
    centerFramesRef.current = 0;
    completedStepsRef.current = new Set();
    scanStepRef.current = 'center';
    faceDetectedAtLeastOnceRef.current = false;
    noMatchStartRef.current = null;
    noMatchTriggeredRef.current = false;
  };

  const setScanStepSynced = (step: ScanStep) => {
    scanStepRef.current = step;
    setScanStep(step);
  };

  const averageDescriptors = (descriptors: number[][]): number[] => {
    if (descriptors.length === 0) return [];
    const len = descriptors[0].length;
    const avg = new Array(len).fill(0);
    for (const d of descriptors) for (let i = 0; i < len; i++) avg[i] += d[i];
    return avg.map((v) => v / descriptors.length);
  };

  // ── NO-FACE TIMER (yuz umuman ko'rinmasa) ──────────────────────────────
  const resetNoFaceTimer = () => {
    if (noFaceTimerRef.current) clearTimeout(noFaceTimerRef.current);
    noFaceTimerRef.current = window.setTimeout(() => {
      if (!faceDetectedAtLeastOnceRef.current) {
        setShowNoFaceHint(true);
      }
    }, 3000);
  };

  // ── LOGIN REJIMIDA 3 SEKUND YUZ MOS KELMAGANDA ──────────────────────────
  const checkNoMatchTimeout = (matched: boolean) => {
    // Faqat login rejimida (o'quvchi) ishlaydi
    if (mode !== 'login' || isUstozLogin || noMatchTriggeredRef.current) return;

    if (!matched) {
      // Mos kelmadi — timer boshlanadi
      if (noMatchStartRef.current === null) {
        noMatchStartRef.current = Date.now();
      } else {
        const elapsed = Date.now() - noMatchStartRef.current;
        if (elapsed >= 3000) {
          // 3 soniya o'tdi — ustoz override ekranini ko'rsat
          noMatchTriggeredRef.current = true;
          noMatchStartRef.current = null;
          if (detectionIntervalRef.current) { clearInterval(detectionIntervalRef.current); detectionIntervalRef.current = null; }
          setShowNoMatchWarning(true);
          setShowUstozOverride(true);
        }
      }
    } else {
      // Mos keldi — timerni reset
      noMatchStartRef.current = null;
    }
  };

  const handleRetry = () => {
    const newRetry = retryCountRef.current + 1;
    retryCountRef.current = newRetry;
    setRetryCount(newRetry);

    if (newRetry >= 3) {
      setShowNoFaceHint(false);
      setShowUstozOverride(true);
      return;
    }

    const newBrightness = Math.min(200, 100 + newRetry * 20);
    const newContrast = Math.min(200, 100 + newRetry * 20);
    setBrightness(newBrightness);
    setContrast(newContrast);

    setShowNoFaceHint(false);
    faceDetectedAtLeastOnceRef.current = false;
    resetNoFaceTimer();
    setMessage('Yuz kutilmoqda... (threshold: ' + getThreshold(newRetry).toFixed(1) + ')');
  };

  // ── USTOZ OVERRIDE SCAN ───────────────────────────────────────────────
  const startUstozOverrideScan = async () => {
    setUstozOverrideScanning(true);
    setUstozOverrideMessage('Ustozning yuzini skanlamoqda...');
    ustozOverrideModeRef.current = true;

    try {
      const { data: ustozlar } = await supabase
        .from('ustoz')
        .select('id, full_name, face_descriptor')
        .eq('status', 'approved')
        .not('face_descriptor', 'is', null);

      if (!ustozlar || ustozlar.length === 0) {
        setUstozOverrideMessage("Tasdiqlangan ustoz topilmadi. Admin bilan bog'laning.");
        setUstozOverrideScanning(false);
        ustozOverrideModeRef.current = false;
        return;
      }

      let attempts = 0;
      const maxAttempts = 25; // ~10 sekund
      const faceapi = window.faceapi;
      const tinyOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 });

      const scanInterval = window.setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(scanInterval);
          setUstozOverrideMessage("Ustoz yuz aniqlanmadi. Qayta urinib ko'ring.");
          setUstozOverrideScanning(false);
          ustozOverrideModeRef.current = false;
          return;
        }

        try {
          const video = videoRef.current;
          if (!video) return;
          const detection = await faceapi
            .detectSingleFace(video, tinyOpts)
            .withFaceLandmarks(true)
            .withFaceDescriptor();

          if (!detection) {
            setUstozOverrideMessage(`Yuz kutilmoqda... (${attempts}/${maxAttempts})`);
            return;
          }

          const desc = Array.from(detection.descriptor) as number[];
          let bestMatch: { ustoz: any; dist: number } | null = null;

          for (const u of ustozlar) {
            const uDesc = Array.isArray(u.face_descriptor) ? u.face_descriptor : null;
            if (!uDesc || uDesc.length !== 128) continue;
            const d = faceDistance(desc, uDesc);
            if (!bestMatch || d < bestMatch.dist) bestMatch = { ustoz: u, dist: d };
          }

          if (bestMatch && bestMatch.dist < 0.55) {
            clearInterval(scanInterval);
            setUstozOverrideMessage(`✅ ${bestMatch.ustoz.full_name} — tasdiqlandi! O'quvchi profili ochilmoqda...`);
            setUstozOverrideScanning(false);
            ustozOverrideModeRef.current = false;
            setTimeout(() => {
              cleanup();
              onCaptureComplete(desc, undefined, undefined);
            }, 1200);
          } else {
            const conf = bestMatch ? Math.round((1 - bestMatch.dist) * 100) : 0;
            setUstozOverrideMessage(`Yuz skanlanmoqda... (mos: ${conf}%)`);
          }
        } catch (e) {
          console.error('Ustoz override scan xatosi:', e);
        }
      }, 400);
    } catch (e) {
      setUstozOverrideMessage('Xatolik yuz berdi. Qayta urinib ko\'ring.');
      setUstozOverrideScanning(false);
      ustozOverrideModeRef.current = false;
    }
  };

  const loadFaceAPI = async () => {
    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isHTTPS = window.location.protocol === 'https:';
      if (!isLocalhost && !isHTTPS) {
        setStatus('error');
        setMessage('⚠️ HTTPS talab qilinadi! https:// orqali kiring');
        setLoading(false);
        return;
      }
      if (!isFaceApiLoaded()) {
        setMessage('AI modellar yuklanmoqda...');
        await awaitFaceApi();
      }
      setMessage('Kamera ochilmoqda...');
      await startCamera();
      setStatus('ready');
      setMessage('Yuzingizni kameraga qarating');
      setLoading(false);
      resetNoFaceTimer();
      startFaceDetection();
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Yuz tanish tizimini yuklashda xatolik');
      setLoading(false);
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Brauzeringiz kamerani qo'llab-quvvatlamaydi.");
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await new Promise<void>((resolve) => {
          videoRef.current!.onloadedmetadata = () => { videoRef.current!.play(); resolve(); };
        });
      }
      setStream(mediaStream);
    } catch (err: any) {
      let msg = 'Kamera ochishda xatolik';
      if (err.name === 'NotAllowedError') msg = '❌ Kameraga ruxsat berilmadi.';
      else if (err.name === 'NotFoundError') msg = '📷 Kamera topilmadi.';
      else if (err.name === 'NotReadableError') msg = '⚠️ Kamera band.';
      throw new Error(msg);
    }
  };

  const captureFrameBase64 = (): string => {
    try {
      const v = videoRef.current;
      if (!v) return '';
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d')?.drawImage(v, 0, 0);
      return c.toDataURL('image/jpeg', 0.7);
    } catch { return ''; }
  };

  const drawCroppedFace = (
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number,
    video: HTMLVideoElement, color: string,
  ) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 8, 0, 2 * Math.PI);
    ctx.clip();
    ctx.drawImage(
      video,
      Math.max(0, cx - radius - 8), Math.max(0, cy - radius - 8),
      (radius + 8) * 2, (radius + 8) * 2,
      Math.max(0, cx - radius - 8), Math.max(0, cy - radius - 8),
      (radius + 8) * 2, (radius + 8) * 2,
    );
    ctx.restore();
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, 2 * Math.PI);
    ctx.stroke();
  };

  const checkFraudAgainstAllFaces = async (newDesc: number[]) => {
    if (registerInfo?.kurs === 'ustoz') return { fraud: false };
    try {
      const { data: talabalar, error } = await supabase
        .from('talabalar')
        .select('id, ism, familiya, kurs, guruh, face_descriptor')
        .not('face_descriptor', 'is', null);
      if (error || !talabalar?.length) return { fraud: false };
      let minDist = 1;
      let mosTalaba: any = null;
      for (const t of talabalar) {
        const desc = Array.isArray(t.face_descriptor) ? t.face_descriptor : null;
        if (!desc || desc.length !== 128) continue;
        if (
          registerInfo &&
          t.ism === registerInfo.ism &&
          t.familiya === registerInfo.familiya &&
          t.guruh === registerInfo.guruh &&
          t.kurs === registerInfo.kurs
        ) continue;
        const d = faceDistance(newDesc, desc);
        if (d < minDist) { minDist = d; mosTalaba = t; }
      }
      if (minDist < 0.40 && mosTalaba) {
        return { fraud: true, mosTalaba, distance: minDist, frameBase64: captureFrameBase64() };
      }
      return { fraud: false };
    } catch { return { fraud: false }; }
  };

  const startFaceDetection = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const faceapi = window.faceapi;
    const displaySize = { width: video.videoWidth || 320, height: video.videoHeight || 240 };
    faceapi.matchDimensions(canvas, displaySize);

    const tinyOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 });

    detectionIntervalRef.current = window.setInterval(async () => {
      if (!video || !canvas) return;
      if (fraudCheckDoneRef.current) return;
      if (ustozOverrideModeRef.current) return;

      try {
        const detection = await faceapi
          .detectSingleFace(video, tinyOpts)
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        const ctx = canvas.getContext('2d');

        if (!detection) {
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          successfulMatchesRef.current = 0;
          centerFramesRef.current = 0;
          setFoundUstoz(null);
          setStatus('ready');
          setMessage('Yuzingizni kameraga qarating');
          return;
        }

        faceDetectedAtLeastOnceRef.current = true;
        resetNoFaceTimer();
        setShowNoFaceHint(false);

        const resized = faceapi.resizeResults(detection, displaySize);
        const box = resized.detection.box;
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const radius = Math.max(box.width, box.height) / 1.8;
        const yawDir = calculateFaceYaw(detection.landmarks);
        const currentStep = scanStepRef.current;

        let ringColor = '#3b82f6';
        if (currentStep === 'right') ringColor = '#f59e0b';
        else if (currentStep === 'left') ringColor = '#8b5cf6';
        else if (status === 'success') ringColor = '#22c55e';

        if (ctx) {
          drawCroppedFace(ctx, cx, cy, radius, video, ringColor);
          ctx.fillStyle = ringColor;
          ctx.font = 'bold 22px Arial';
          ctx.textAlign = 'center';
          const dir = yawDir === 'right' ? '→' : yawDir === 'left' ? '←' : '●';
          ctx.fillText(dir, cx, cy - radius - 12);
        }

        const faceArea = box.width * box.height;
        const videoArea = video.videoWidth * video.videoHeight;
        if (faceArea / videoArea > 0.75) { setMessage('📏 Biroz uzoqlashing'); return; }

        setStatus('detecting');
        const descriptor = Array.from(detection.descriptor) as number[];
        const threshold = getThreshold(retryCountRef.current);

        // ── UNIFIED LOGIN (allDescriptors bo'sh array) — descriptor capture qilib qaytaramiz ──
        if (isUnifiedLogin) {
          if (currentStep === 'center') {
            const distX = Math.abs(cx - video.videoWidth / 2);
            const distY = Math.abs(cy - video.videoHeight / 2);
            if (yawDir === 'center' && distX < video.videoWidth * 0.28 && distY < video.videoHeight * 0.28) {
              centerFramesRef.current += 1;
              descriptorHistoryRef.current.push(descriptor);
              const prog = Math.min(100, Math.round((centerFramesRef.current / 5) * 100));
              setCenterProgress(prog);
              setMessage(`Yuz skanlanmoqda... (${centerFramesRef.current}/5)`);
              if (centerFramesRef.current >= 5) {
                completedStepsRef.current.add('center');
                setScanStepSynced('right');
                stepCooldownRef.current = false;
                setMessage("Endi o'ngga qarang →");
              }
            } else {
              centerFramesRef.current = Math.max(0, centerFramesRef.current - 1);
              setCenterProgress(Math.min(100, Math.round((centerFramesRef.current / 5) * 100)));
              setMessage("⬅️➡️ Yuzingizni markazga qo'ying");
            }
          } else if (currentStep === 'right') {
            if (yawDir === 'right' && !stepCooldownRef.current) {
              stepCooldownRef.current = true;
              completedStepsRef.current.add('right');
              setMessage("✓ O'ng taraf! Chapga qarang");
              setTimeout(() => { setScanStepSynced('left'); stepCooldownRef.current = false; }, 400);
            } else if (!stepCooldownRef.current) setMessage("O'ngga qarang →");
          } else if (currentStep === 'left') {
            if (yawDir === 'left' && !stepCooldownRef.current) {
              stepCooldownRef.current = true;
              completedStepsRef.current.add('left');
              setScanStepSynced('done');
              if (detectionIntervalRef.current) { clearInterval(detectionIntervalRef.current); detectionIntervalRef.current = null; }
              setStatus('success');
              setMessage('Yuz aniqlandi! Tekshirilmoqda...');
              const avgDesc = averageDescriptors(descriptorHistoryRef.current);
              const imageBase64 = captureImage ? captureFrameBase64() : undefined;
              setTimeout(() => { cleanup(); onCaptureComplete(avgDesc.length ? avgDesc : descriptor, imageBase64); }, 600);
            } else if (!stepCooldownRef.current) setMessage('← Chapga qarang');
          }
          return;
        }

        // ── USTOZ LOGIN ──────────────────────────────────────────────────
        if (isUstozLogin && mode === 'login') {
          if (currentStep === 'center') {
            let bestMatch: { ustoz: any; distance: number } | null = null;
            for (const { ustoz, descriptor: d } of allDescriptors!) {
              const dist = faceDistance(descriptor, d);
              if (!bestMatch || dist < bestMatch.distance) bestMatch = { ustoz, distance: dist };
            }
            if (bestMatch && bestMatch.distance < threshold) {
              successfulMatchesRef.current += 1;
              descriptorHistoryRef.current.push(descriptor);
              setCenterProgress(Math.min(100, Math.round((successfulMatchesRef.current / 3) * 100)));
              setMessage(`${bestMatch.ustoz.full_name} aniqlandi (${successfulMatchesRef.current}/3)`);
              if (successfulMatchesRef.current >= 3) {
                completedStepsRef.current.add('center');
                setScanStepSynced('right');
                stepCooldownRef.current = false;
                setMessage("Endi o'ngga qarang →");
              }
            } else {
              successfulMatchesRef.current = Math.max(0, successfulMatchesRef.current - 1);
              setCenterProgress(Math.min(100, Math.round((successfulMatchesRef.current / 3) * 100)));
              setFoundUstoz(null);
              const conf = bestMatch ? Math.round((1 - bestMatch.distance) * 100) : 0;
              setMessage(`Yuz mos kelmadi (${conf}%) — yaqinroq keling`);
            }
          } else if (currentStep === 'right') {
            if (yawDir === 'right' && !stepCooldownRef.current) {
              stepCooldownRef.current = true;
              completedStepsRef.current.add('right');
              setMessage("✓ O'ng taraf aniqlandi! Chapga qarang");
              setTimeout(() => { setScanStepSynced('left'); stepCooldownRef.current = false; }, 400);
            } else if (!stepCooldownRef.current) setMessage("O'ngga qarang →");
          } else if (currentStep === 'left') {
            if (yawDir === 'left' && !stepCooldownRef.current) {
              stepCooldownRef.current = true;
              completedStepsRef.current.add('left');
              setScanStepSynced('done');
              if (detectionIntervalRef.current) { clearInterval(detectionIntervalRef.current); detectionIntervalRef.current = null; }
              setStatus('success');
              const avgDesc = averageDescriptors(descriptorHistoryRef.current);
              let bestFinal: { ustoz: any; distance: number } | null = null;
              for (const { ustoz, descriptor: d } of allDescriptors!) {
                const dist = faceDistance(avgDesc.length ? avgDesc : descriptor, d);
                if (!bestFinal || dist < bestFinal.distance) bestFinal = { ustoz, distance: dist };
              }
              setMessage(`${bestFinal?.ustoz?.full_name || 'Ustoz'} — muvaffaqiyatli tasdiqlandi ✓`);
              setTimeout(() => { cleanup(); onCaptureComplete(avgDesc.length ? avgDesc : descriptor); }, 600);
            } else if (!stepCooldownRef.current) setMessage('← Chapga qarang');
          }
          return;
        }

        // ── RO'YXATDAN O'TISH ────────────────────────────────────────────
        if (mode === 'register') {
          if (currentStep === 'center') {
            const distX = Math.abs(cx - video.videoWidth / 2);
            const distY = Math.abs(cy - video.videoHeight / 2);
            if (yawDir === 'center' && distX < video.videoWidth * 0.28 && distY < video.videoHeight * 0.28) {
              centerFramesRef.current += 1;
              descriptorHistoryRef.current.push(descriptor);
              const prog = Math.min(100, Math.round((centerFramesRef.current / 5) * 100));
              setCenterProgress(prog);
              setMessage(`Yuz skanlanmoqda... (${centerFramesRef.current}/5)`);
              if (centerFramesRef.current >= 5) {
                completedStepsRef.current.add('center');
                setScanStepSynced('right');
                stepCooldownRef.current = false;
                setMessage("Endi o'ngga qarang →");
              }
            } else {
              centerFramesRef.current = Math.max(0, centerFramesRef.current - 1);
              setCenterProgress(Math.min(100, Math.round((centerFramesRef.current / 5) * 100)));
              setMessage("⬅️➡️ Yuzingizni markazga qo'ying");
            }
          } else if (currentStep === 'right') {
            if (yawDir === 'right' && !stepCooldownRef.current) {
              stepCooldownRef.current = true;
              completedStepsRef.current.add('right');
              setMessage("✓ O'ng taraf aniqlandi! Chapga qarang");
              setTimeout(() => { setScanStepSynced('left'); stepCooldownRef.current = false; }, 400);
            } else if (!stepCooldownRef.current) setMessage("O'ngga qarang →");
          } else if (currentStep === 'left') {
            if (yawDir === 'left' && !stepCooldownRef.current) {
              stepCooldownRef.current = true;
              fraudCheckDoneRef.current = true;
              completedStepsRef.current.add('left');
              setScanStepSynced('done');
              if (detectionIntervalRef.current) { clearInterval(detectionIntervalRef.current); detectionIntervalRef.current = null; }
              setMessage('Fraud tekshiruvi...');
              const avgDescriptor = averageDescriptors(descriptorHistoryRef.current);
              const fraudResult = await checkFraudAgainstAllFaces(avgDescriptor);
              if (fraudResult.fraud && fraudResult.mosTalaba) {
                const oxshashlik = Math.round((1 - (fraudResult.distance || 0)) * 100);
                setFraudInfo({
                  mosTalaba: `${fraudResult.mosTalaba.ism} ${fraudResult.mosTalaba.familiya}`,
                  mosTalabaGuruh: `${fraudResult.mosTalaba.kurs} / ${fraudResult.mosTalaba.guruh}`,
                  oxshashlik,
                });
                const storedFraudResult: FraudResult = {
                  detected: true,
                  mosTalaba: fraudResult.mosTalaba,
                  distance: fraudResult.distance || 0,
                  frameBase64: fraudResult.frameBase64 || '',
                };
                setFraudDetectedResult(storedFraudResult);
                setShowFraudWarning(true);
                setStatus('success');
                const imageBase64 = captureImage ? captureFrameBase64() : undefined;
                fraudWarningTimerRef.current = window.setTimeout(() => {
                  setShowFraudWarning(false);
                  cleanup();
                  onCaptureComplete(avgDescriptor, imageBase64, storedFraudResult);
                }, 5000);
              } else {
                setStatus('success');
                setMessage("Yuz muvaffaqiyatli ro'yxatdan o'tkazildi! ✓");
                const imageBase64 = captureImage ? captureFrameBase64() : undefined;
                setTimeout(() => { cleanup(); onCaptureComplete(avgDescriptor, imageBase64); }, 800);
              }
            } else if (!stepCooldownRef.current) setMessage('← Chapga qarang');
          }
          return;
        }

        // ── LOGIN (o'quvchi) — 3 SEKUND YUZ MOS KELMAGANDA USTOZ CHAQIRISH ──
        if (mode === 'login' && targetDescriptor) {
          if (currentStep === 'center') {
            const dist = faceDistance(descriptor, targetDescriptor);
            if (dist < threshold) {
              // Mos keldi
              checkNoMatchTimeout(true);
              successfulMatchesRef.current += 1;
              descriptorHistoryRef.current.push(descriptor);
              setCenterProgress(Math.min(100, Math.round((successfulMatchesRef.current / 3) * 100)));
              setMessage(`Yuz aniqlanmoqda... (${successfulMatchesRef.current}/3)`);
              if (successfulMatchesRef.current >= 3) {
                completedStepsRef.current.add('center');
                setScanStepSynced('right');
                stepCooldownRef.current = false;
                setMessage("Endi o'ngga qarang →");
              }
            } else {
              // Mos kelmadi — timer tekshir
              checkNoMatchTimeout(false);
              successfulMatchesRef.current = Math.max(0, successfulMatchesRef.current - 1);
              setCenterProgress(Math.min(100, Math.round((successfulMatchesRef.current / 3) * 100)));
              setMessage(`Yuz mos kelmadi (${((1 - dist) * 100).toFixed(0)}%) — yaqinroq keling`);
            }
          } else if (currentStep === 'right') {
            if (yawDir === 'right' && !stepCooldownRef.current) {
              stepCooldownRef.current = true;
              completedStepsRef.current.add('right');
              setMessage("✓ O'ng taraf! Chapga qarang");
              setTimeout(() => { setScanStepSynced('left'); stepCooldownRef.current = false; }, 400);
            } else if (!stepCooldownRef.current) setMessage("O'ngga qarang →");
          } else if (currentStep === 'left') {
            if (yawDir === 'left' && !stepCooldownRef.current) {
              stepCooldownRef.current = true;
              completedStepsRef.current.add('left');
              setScanStepSynced('done');
              if (detectionIntervalRef.current) { clearInterval(detectionIntervalRef.current); detectionIntervalRef.current = null; }
              setStatus('success');
              setMessage('Yuz tasdiqlandi! ✓');
              const avgDesc = averageDescriptors(descriptorHistoryRef.current);
              setTimeout(() => { cleanup(); onCaptureComplete(avgDesc.length ? avgDesc : descriptor); }, 600);
            } else if (!stepCooldownRef.current) setMessage('← Chapga qarang');
          }
        }
      } catch (err) {
        console.error('Yuz aniqlashda xato:', err);
      }
    }, 400);
  };

  const getStatusColor = () => {
    if (status === 'success') return 'border-green-400';
    if (status === 'fraud' || status === 'error') return 'border-red-500';
    if (scanStep === 'right') return 'border-amber-400';
    if (scanStep === 'left') return 'border-purple-400';
    if (status === 'detecting') return 'border-blue-400 animate-pulse';
    return 'border-blue-400';
  };

  const CircleProgress = ({
    value, max, color, label, icon, done,
  }: { value: number; max: number; color: string; label: string; icon: JSX.Element; done: boolean; }) => {
    const r = 20;
    const circ = 2 * Math.PI * r;
    const prog = done ? 0 : circ - (value / max) * circ;
    return (
      <div className="flex flex-col items-center gap-1">
        <svg width="52" height="52" className="rotate-[-90deg]">
          <circle cx="26" cy="26" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle cx="26" cy="26" r={r} fill="none" stroke={done ? '#22c55e' : color}
            strokeWidth="4" strokeDasharray={circ} strokeDashoffset={prog}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
          <foreignObject x="10" y="10" width="32" height="32">
            <div className="flex items-center justify-center w-8 h-8 rotate-90">
              {done ? <CheckCircle className="h-5 w-5 text-green-500" />
                : <span style={{ color: done ? '#22c55e' : color }}>{icon}</span>}
            </div>
          </foreignObject>
        </svg>
        <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight max-w-[60px]">{label}</span>
      </div>
    );
  };

  // ── FRAUD OGOHLANTIRISH ─────────────────────────────────────────────────
  if (showFraudWarning && fraudInfo) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="max-w-lg w-full">
          <div className="bg-white border-4 border-orange-500 rounded-2xl shadow-2xl overflow-hidden animate-bounce-in">
            <div className="h-2 bg-orange-100">
              <div className="h-full bg-orange-500 transition-all"
                style={{ animation: 'shrink-width 5s linear forwards' }} />
            </div>
            <div className="p-8 space-y-5 text-center">
              <div className="flex justify-center">
                <div className="bg-orange-100 p-5 rounded-full">
                  <ShieldAlert className="h-16 w-16 text-orange-600" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-orange-700 mb-2">⚠️ Diqqat: Shubhali profil</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Siz avval <strong>{fraudInfo.mosTalabaGuruh}</strong>da <strong>{fraudInfo.mosTalaba}</strong> nomidan
                  ro'yxatdan o'tgansiz. Profilingiz admin paneliga yuborildi.
                </p>
              </div>
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 text-left space-y-2">
                <p className="text-sm font-bold text-orange-800">Aniqlangan eski profil:</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Profil:</span>
                  <span className="font-semibold text-orange-900">{fraudInfo.mosTalaba}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">O'xshashlik:</span>
                  <span className="font-bold text-orange-700">{fraudInfo.oxshashlik}%</span>
                </div>
              </div>
              <p className="text-xs text-gray-400">5 soniyadan keyin yopiladi...</p>
            </div>
          </div>
        </div>
        <style>{`
          @keyframes bounce-in { 0% { transform:scale(0.8); opacity:0; } 60% { transform:scale(1.05); opacity:1; } 100% { transform:scale(1); } }
          @keyframes shrink-width { from { width:100%; } to { width:0%; } }
          .animate-bounce-in { animation: bounce-in 0.4s ease-out; }
        `}</style>
      </div>
    );
  }

  // ── USTOZ OVERRIDE PANEL ────────────────────────────────────────────────
  if (showUstozOverride) {
    // O'quvchi ma'lumotlari (loginInfo yoki registerInfo dan)
    const oquvchi = loginInfo || registerInfo;

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <Card className="max-w-xl w-full border-4 border-amber-400 shadow-2xl">
          <CardContent className="pt-0 pb-6 space-y-0 overflow-hidden rounded-xl">

            {/* Sarlavha */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-5 -mx-6 mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2.5 rounded-full">
                  <PhoneCall className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Test yaratuvchini chaqiring</h2>
                  <p className="text-amber-100 text-sm mt-0.5">Ustoz tasdiqlovchi sifatida yuzini skanerga ko'rsatadi</p>
                </div>
              </div>
            </div>

            {/* O'quvchi ma'lumotlari — ekranda ko'rinib turadi */}
            {oquvchi && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                  <p className="text-sm font-bold text-blue-800 uppercase tracking-wide">Tasdiqlash kutilayotgan o'quvchi</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-gray-500 mb-1">Ism</p>
                    <p className="font-bold text-gray-900 text-base">{oquvchi.ism}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-gray-500 mb-1">Familiya</p>
                    <p className="font-bold text-gray-900 text-base">{oquvchi.familiya}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-gray-500 mb-1">Kurs</p>
                    <p className="font-bold text-blue-700 text-base">{oquvchi.kurs}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-gray-500 mb-1">Guruh</p>
                    <p className="font-bold text-blue-700 text-base uppercase">{oquvchi.guruh}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Xabar matn */}
            {!ustozOverrideScanning && !ustozOverrideMessage && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm text-amber-900 leading-relaxed text-center font-medium">
                  Bu siz ekanligingizni tasdiqlash uchun <strong>test yaratuvchini chaqiring</strong> va
                  tasdiqlangandan so'ng profilingizga kira olasiz
                </p>
              </div>
            )}

            {/* Kamera (ustoz skanlash uchun) */}
            <div className="relative bg-black rounded-xl overflow-hidden mb-4" style={{ aspectRatio: '4/3' }}>
              <video ref={videoRef} autoPlay muted playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)', filter: `brightness(${brightness}%) contrast(${contrast}%)` }} />
              <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full"
                style={{ transform: 'scaleX(-1)' }} />
              {ustozOverrideScanning && (
                <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-12 w-12 text-white animate-spin" />
                  <p className="text-white font-semibold text-sm">Ustoz yuzi skanlanmoqda...</p>
                </div>
              )}
              {!ustozOverrideScanning && !ustozOverrideMessage && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
                  <p className="text-white text-center text-sm font-semibold">
                    👆 Ustoz yuzini kameraga qarating
                  </p>
                </div>
              )}
            </div>

            {/* Status xabar */}
            {ustozOverrideMessage && (
              <div className={`px-4 py-3 rounded-xl text-sm font-semibold border-2 mb-4 text-center ${
                ustozOverrideMessage.startsWith('✅')
                  ? 'bg-green-50 border-green-300 text-green-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {ustozOverrideMessage}
              </div>
            )}

            {/* Tugmalar */}
            <div className="flex gap-3">
              <Button
                onClick={startUstozOverrideScan}
                disabled={ustozOverrideScanning}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold h-12"
                size="lg"
              >
                {ustozOverrideScanning
                  ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Skanlanmoqda...</>
                  : <><UserCheck className="mr-2 h-5 w-5" />Ustoz yuzini skanlash</>}
              </Button>
              <Button onClick={onCancel} variant="outline" size="lg" className="h-12 px-5">
                Bekor qilish
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedSteps = completedStepsRef.current;
  const isRegister = mode === 'register';

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <Card className={`max-w-2xl w-full border-4 ${getStatusColor()} shadow-2xl transition-colors duration-300`}>
        <CardContent className="pt-5 pb-5 space-y-4">

          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {status === 'loading' && <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />}
              {status === 'ready' && <Camera className="h-6 w-6 text-blue-600" />}
              {status === 'detecting' && <Loader2 className="h-6 w-6 text-yellow-600 animate-spin" />}
              {status === 'success' && <CheckCircle className="h-6 w-6 text-green-600" />}
              {status === 'error' && <AlertCircle className="h-6 w-6 text-red-600" />}
              <div>
                <h3 className="font-bold text-lg">
                  {isUstozLogin ? 'Ustoz Face ID bilan kirish'
                    : isRegister ? "Yuzni ro'yxatdan o'tkazish"
                      : 'Yuz identifikatsiyasi'}
                </h3>
                <p className="text-sm text-gray-500">{message}</p>
              </div>
            </div>
            <Button onClick={onCancel} variant="ghost" size="sm">✕</Button>
          </div>

          {/* 3 BOSQICH PROGRESS */}
          {(isRegister || mode === 'login') && (
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl px-4 py-3 border border-slate-200">
              <div className="flex items-center justify-around">
                <CircleProgress value={centerFramesRef.current} max={5} color="#3b82f6"
                  label="Markazga qarang" icon={<Eye className="h-4 w-4" />}
                  done={completedSteps.has('center')} />
                <div className="flex-1 mx-2 h-1 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-amber-500 transition-all duration-500"
                    style={{ width: completedSteps.has('center') ? '100%' : `${centerProgress}%` }} />
                </div>
                <CircleProgress value={completedSteps.has('right') ? 1 : 0} max={1} color="#f59e0b"
                  label="O'ngga qarang" icon={<ArrowRight className="h-4 w-4" />}
                  done={completedSteps.has('right')} />
                <div className="flex-1 mx-2 h-1 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-purple-500 transition-all duration-500"
                    style={{ width: completedSteps.has('right') ? '100%' : '0%' }} />
                </div>
                <CircleProgress value={completedSteps.has('left') ? 1 : 0} max={1} color="#8b5cf6"
                  label="Chapga qarang" icon={<ArrowLeft className="h-4 w-4" />}
                  done={completedSteps.has('left')} />
              </div>
              {scanStep !== 'done' && (
                <div className={`mt-3 flex items-center justify-center gap-2 text-sm font-semibold ${STEP_INFO[scanStep].color}`}>
                  <span>{STEP_INFO[scanStep].label}</span>
                </div>
              )}
              {scanStep === 'done' && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-green-600">
                  <CheckCircle className="h-5 w-5" /><span>Barcha bosqichlar bajarildi!</span>
                </div>
              )}
            </div>
          )}

          {/* Ustoz topildi */}
          {isUstozLogin && foundUstoz && status === 'detecting' && (
            <div className="bg-green-50 border-2 border-green-300 rounded-xl px-4 py-3 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900">{foundUstoz.name}</p>
                <p className="text-xs text-green-700">Aniqlik: {foundUstoz.confidence}%</p>
              </div>
            </div>
          )}

          {/* KAMERA */}
          <div className="relative bg-black rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              autoPlay muted playsInline
              className="w-full h-auto"
              style={{
                transform: 'scaleX(-1)',
                filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                transition: 'filter 0.4s ease',
              }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Yuz yo'nalishi overlay */}
            {(isRegister || mode === 'login') && scanStep !== 'done' && !loading && !showNoFaceHint && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
                <div className="flex items-center justify-center gap-2 text-white font-bold text-base drop-shadow-lg">
                  {scanStep === 'center' && <><Eye className="h-5 w-5" /> Kameraga to'g'ri qarang</>}
                  {scanStep === 'right' && (
                    <span className="flex items-center gap-2 animate-bounce text-amber-300">
                      <ArrowRight className="h-6 w-6" /> O'ngga qarang
                    </span>
                  )}
                  {scanStep === 'left' && (
                    <span className="flex items-center gap-2 animate-bounce text-purple-300">
                      <ArrowLeft className="h-6 w-6" /> Chapga qarang
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* NO-FACE HINT */}
            {showNoFaceHint && !loading && (
              <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-4 p-6">
                <Sun className="h-12 w-12 text-yellow-400 animate-pulse" />
                <p className="text-white text-center font-bold text-lg leading-snug">
                  Yorug'roq joyga o'ting yoki<br />kameraga yaqinroq keling
                </p>
                {retryCount < 3 && (
                  <p className="text-yellow-300 text-sm text-center">
                    Threshold: {getThreshold(retryCount + 1).toFixed(1)} (yengilroq)
                    {brightness < 200 && ` • Yorqinlik +${(retryCount + 1) * 20}%`}
                  </p>
                )}
                <Button
                  onClick={handleRetry}
                  className="mt-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-8 py-3 rounded-xl text-base shadow-lg"
                >
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Qayta tekshirish
                  {retryCount > 0 && <span className="ml-2 text-xs opacity-75">({retryCount}/3)</span>}
                </Button>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto mb-3" />
                  <p className="text-sm">{message}</p>
                </div>
              </div>
            )}
          </div>

          {/* Brightness indikator */}
          {brightness > 100 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Sun className="h-4 w-4 text-yellow-600 flex-shrink-0" />
              <p className="text-xs text-yellow-800">
                Yorqinlik filtri: <strong>{brightness}%</strong> • Kontrast: <strong>{contrast}%</strong>
              </p>
            </div>
          )}

          {/* Ko'rsatmalar */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs font-bold text-blue-800 mb-1.5">📸 Ko'rsatmalar:</p>
            <ul className="text-xs text-blue-700 space-y-0.5">
              <li>• Yaxshi yoritilgan joyda bo'ling</li>
              <li>• Ko'zoynak yoki niqob taqmang</li>
              {(isRegister || mode === 'login') && (
                <>
                  <li className="text-blue-900 font-semibold">
                    • 3 bosqich: <strong>markazga → o'ngga → chapga</strong>
                  </li>
                  <li>• 3 soniya ichida mos kelmasa — ustoz chaqiriladi</li>
                </>
              )}
              {isUstozLogin && (
                <li className="text-blue-800 font-semibold">• Tizim barcha ustozlar bilan taqqoslab aniqlaydi</li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
