import { useRef, useEffect, useState, useCallback } from 'react';

interface BgShapesProps {
  reducedMotion: boolean;
}

/**
 * Two large, dim, slowly drifting accent shapes behind the Nexus AI chat area.
 * Purely decorative — aria-hidden, only transform animations.
 */
export default function BgShapes({ reducedMotion }: BgShapesProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (reducedMotion) {
    return (
      <div className="nc-bg-shapes" aria-hidden="true">
        <div className="nc-bg-shape nc-bg-shape-1" style={{ opacity: 0.08 }} />
        <div className="nc-bg-shape nc-bg-shape-2" style={{ opacity: 0.06 }} />
      </div>
    );
  }

  return (
    <div className="nc-bg-shapes" aria-hidden="true">
      <div
        className="nc-bg-shape nc-bg-shape-1"
        style={{ opacity: mounted ? 0.12 : 0 }}
      />
      <div
        className="nc-bg-shape nc-bg-shape-2"
        style={{ opacity: mounted ? 0.09 : 0 }}
      />
    </div>
  );
}
