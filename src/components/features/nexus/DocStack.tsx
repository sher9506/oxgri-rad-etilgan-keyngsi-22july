import { useRef, useEffect, useState, useCallback } from 'react';

interface DocStackProps {
  phaseB: boolean;
  scanning: boolean;
  layers?: number;
  reducedMotion: boolean;
  canHover: boolean;
  active: boolean;
}

interface LayerStyle {
  transform: string;
  zIndex: number;
}

function getLayerTransform(index: number, total: number, phaseB: boolean): string {
  const center = (total - 1) / 2;
  const offset = index - center;

  if (phaseB) {
    const fanAngle = offset * 6;
    const translateX = offset * 14;
    const translateZ = index * 20;
    return `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${fanAngle}deg) rotateX(4deg)`;
  }

  const zStep = index * 24;
  const tilt = index === 0 ? 0 : (offset > 0 ? 3 : -3);
  return `translateZ(${zStep}px) rotateX(${tilt}deg) rotateY(${tilt * 0.5}deg)`;
}

export default function DocStack({
  phaseB,
  scanning,
  layers = 4,
  reducedMotion,
  canHover,
  active,
}: DocStackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const rafRef = useRef<number>(0);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!canHover || reducedMotion) return;
    const el = containerRef.current;
    if (!el) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      const maxTilt = 8;
      setTilt({
        rx: Math.max(-maxTilt, Math.min(maxTilt, -dy * maxTilt)),
        ry: Math.max(-maxTilt, Math.min(maxTilt, dx * maxTilt)),
      });
    });
  }, [canHover, reducedMotion]);

  const onPointerLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setTilt({ rx: 0, ry: 0 });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !canHover || reducedMotion) return;
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', onPointerLeave);
    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [canHover, reducedMotion, onPointerMove, onPointerLeave]);

  // Float animation on outer wrapper only (translateY)
  useEffect(() => {
    if (reducedMotion || !floatRef.current) return;
    let start = 0;
    let raf = 0;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = (ts - start) / 1000;
      const amplitude = active ? 4 : 6;
      const period = active ? 4 : 6;
      if (floatRef.current) {
        floatRef.current.style.transform = `translateY(${Math.sin((elapsed / period) * Math.PI * 2) * amplitude}px)`;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, active]);

  const layerStyles: LayerStyle[] = Array.from({ length: layers }, (_, i) => ({
    transform: getLayerTransform(i, layers, phaseB),
    zIndex: i,
  }));

  return (
    <div
      ref={containerRef}
      className="nc-docstack-viewport"
      aria-hidden="true"
      style={{ perspective: '1000px' }}
    >
      <div
        ref={floatRef}
        className="nc-docstack-float"
      >
        <div
          ref={tiltRef}
          className="nc-docstack-scene"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            transition: 'transform 400ms cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {layerStyles.map((ls, i) => (
            <div
              key={i}
              className={`nc-doc-layer ${phaseB ? 'nc-doc-layer-fanned' : ''} ${i === layers - 1 ? 'nc-doc-layer-top' : ''}`}
              style={{
                transform: ls.transform,
                zIndex: ls.zIndex,
                transitionDelay: phaseB ? `${i * 70}ms` : '0ms',
              }}
            >
              <div className="nc-doc-layer-header" />
              <div className="nc-doc-layer-lines">
                <div className="nc-doc-line" style={{ width: '88%' }} />
                <div className="nc-doc-line" style={{ width: '72%' }} />
                <div className="nc-doc-line" style={{ width: '94%' }} />
                <div className="nc-doc-line" style={{ width: '60%' }} />
                <div className="nc-doc-line" style={{ width: '80%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {scanning && !reducedMotion && (
        <div className="nc-scan-clip" aria-hidden="true">
          <div className="nc-scan-line" />
        </div>
      )}
    </div>
  );
}
