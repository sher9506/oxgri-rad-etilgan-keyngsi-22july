// LexionOrb — shishasomon shar ichida adolat tarozisi
// Qatlamlar: orqa glow, orbita-orqa, shar, tarozi, orbita-old

interface LexionOrbProps {
  sceneRef: React.RefObject<HTMLDivElement>;
  floatRef: React.RefObject<HTMLDivElement>;
  innerLightRef: React.RefObject<SVGCircleElement>;
}

export function LexionOrb({ sceneRef, floatRef, innerLightRef }: LexionOrbProps) {
  return (
    <div ref={sceneRef} className="lex-scene" aria-hidden="true">
      <div ref={floatRef} className="lex-float">
        {/* ── Orbit back (behind orb) ── */}
        <svg className="lex-svg lex-layer-orbit-back" viewBox="0 0 120 120" fill="none">
          {/* Ring 1 — tilted ellipse */}
          <g className="lex-orbit-ring lex-orbit-ring-1" style={{ transformOrigin: '60px 60px' }}>
            <ellipse cx="60" cy="60" rx="52" ry="18" stroke="rgba(201,154,59,0.28)" strokeWidth="0.7" fill="none" transform="rotate(-15 60 60)" />
            {/* § symbols on ring 1 */}
            <text x="108" y="63" fontSize="6" fill="rgba(201,154,59,0.5)" fontFamily="Georgia, serif">§</text>
            <text x="12" y="58" fontSize="6" fill="rgba(201,154,59,0.35)" fontFamily="Georgia, serif">§</text>
          </g>
        </svg>

        {/* ── Orb body ── */}
        <svg className="lex-svg lex-layer-orb" viewBox="0 0 120 120" fill="none">
          <defs>
            <radialGradient id="lex-orb-grad" cx="42" cy="36" r="58" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#2E5BB8" />
              <stop offset="40%" stopColor="#1A3470" />
              <stop offset="80%" stopColor="#0D1B42" />
              <stop offset="100%" stopColor="#080F28" />
            </radialGradient>
            <radialGradient id="lex-orb-hl" cx="38" cy="32" r="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(141,183,255,0.35)" />
              <stop offset="100%" stopColor="rgba(141,183,255,0)" />
            </radialGradient>
          </defs>
          {/* Glass sphere */}
          <circle cx="60" cy="60" r="44" fill="url(#lex-orb-grad)" />
          <circle cx="60" cy="60" r="44" fill="url(#lex-orb-hl)" />
          {/* Inner gold ring */}
          <circle cx="60" cy="60" r="38" stroke="rgba(201,154,59,0.2)" strokeWidth="0.6" fill="none" />
          {/* Specular highlight */}
          <ellipse className="lex-specular" cx="44" cy="42" rx="12" ry="8" fill="rgba(255,255,255,0.12)" transform="rotate(-30 44 42)" />
          {/* Inner light (follows pointer) */}
          <circle ref={innerLightRef} className="lex-inner-light" cx="60" cy="60" r="6" fill="rgba(59,139,255,0.15)" />
          {/* Light wave (click) */}
          <circle className="lex-light-wave" cx="60" cy="60" r="20" fill="none" stroke="rgba(59,139,255,0.4)" strokeWidth="1.5" opacity="0" />
        </svg>

        {/* ── Scale of justice (inside orb) ── */}
        <svg className="lex-svg lex-layer-scale" viewBox="0 0 120 120" fill="none">
          <defs>
            <linearGradient id="lex-scale-gold" x1="48" y1="44" x2="72" y2="78">
              <stop offset="0%" stopColor="#D9AC42" />
              <stop offset="100%" stopColor="#B8862E" />
            </linearGradient>
          </defs>
          <g className="lex-scale-group" style={{ transformOrigin: '60px 32px' }}>
            {/* Vertical post */}
            <line x1="60" y1="34" x2="60" y2="72" stroke="url(#lex-scale-gold)" strokeWidth="1.6" strokeLinecap="round" />
            {/* Top knob */}
            <circle cx="60" cy="32" r="2.2" fill="url(#lex-scale-gold)" />
            {/* Horizontal beam */}
            <line x1="44" y1="38" x2="76" y2="38" stroke="url(#lex-scale-gold)" strokeWidth="1.4" strokeLinecap="round" />
            {/* Left chain */}
            <line x1="44" y1="38" x2="42" y2="50" stroke="url(#lex-scale-gold)" strokeWidth="0.7" opacity="0.7" />
            {/* Right chain */}
            <line x1="76" y1="38" x2="78" y2="50" stroke="url(#lex-scale-gold)" strokeWidth="0.7" opacity="0.7" />
            {/* Left pan */}
            <path d="M36 50 Q36 56 42 57 Q48 56 48 50" stroke="url(#lex-scale-gold)" strokeWidth="1.2" fill="rgba(201,154,59,0.08)" strokeLinecap="round" />
            {/* Right pan */}
            <path d="M72 50 Q72 56 78 57 Q84 56 84 50" stroke="url(#lex-scale-gold)" strokeWidth="1.2" fill="rgba(201,154,59,0.08)" strokeLinecap="round" />
            {/* Base */}
            <line x1="54" y1="72" x2="66" y2="72" stroke="url(#lex-scale-gold)" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="57" y1="72" x2="57" y2="76" stroke="url(#lex-scale-gold)" strokeWidth="0.8" opacity="0.6" />
            <line x1="63" y1="72" x2="63" y2="76" stroke="url(#lex-scale-gold)" strokeWidth="0.8" opacity="0.6" />
          </g>
        </svg>

        {/* ── Orbit front (in front of orb) ── */}
        <svg className="lex-svg lex-layer-orbit-front" viewBox="0 0 120 120" fill="none">
          {/* Ring 2 — different tilt */}
          <g className="lex-orbit-ring lex-orbit-ring-2" style={{ transformOrigin: '60px 60px' }}>
            <ellipse cx="60" cy="60" rx="48" ry="14" stroke="rgba(201,154,59,0.2)" strokeWidth="0.6" fill="none" transform="rotate(20 60 60)" />
            {/* § symbols on ring 2 */}
            <text x="8" y="64" fontSize="5" fill="rgba(201,154,59,0.4)" fontFamily="Georgia, serif">§</text>
            <text x="66" y="12" fontSize="5" fill="rgba(201,154,59,0.3)" fontFamily="Georgia, serif">§</text>
            <text x="86" y="104" fontSize="5" fill="rgba(201,154,59,0.25)" fontFamily="Georgia, serif">§</text>
          </g>
        </svg>
      </div>
    </div>
  );
}
