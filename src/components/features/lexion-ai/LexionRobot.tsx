// LexionRobot — SVG robot qatlamlarga bo'lingan
// Tana, bosh, ko'zlar, ko'krak tarozi belgisi, oltin halqa

interface LexionRobotProps {
  sceneRef: React.RefObject<HTMLDivElement>;
  floatRef: React.RefObject<HTMLDivElement>;
  eyesRef: React.RefObject<SVGGElement>;
}

export function LexionRobot({ sceneRef, floatRef, eyesRef }: LexionRobotProps) {
  return (
    <div ref={sceneRef} className="lex-scene" aria-hidden="true">
      <div ref={floatRef} className="lex-float">
        {/* Body */}
        <svg className="lex-svg lex-layer-body" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="lex-body-grad" x1="20" y1="10" x2="80" y2="95">
              <stop offset="0%" stopColor="#1E3F8F" />
              <stop offset="55%" stopColor="#17306E" />
              <stop offset="100%" stopColor="#0D1B42" />
            </linearGradient>
            <radialGradient id="lex-body-hl" cx="38" cy="28" r="42">
              <stop offset="0%" stopColor="rgba(59,139,255,0.25)" />
              <stop offset="100%" stopColor="rgba(59,139,255,0)" />
            </radialGradient>
          </defs>
          {/* Body squircle */}
          <rect x="18" y="20" width="64" height="68" rx="22" ry="22" fill="url(#lex-body-grad)" />
          <rect x="18" y="20" width="64" height="68" rx="22" ry="22" fill="url(#lex-body-hl)" />
          {/* Glass top edge */}
          <path d="M22 26 Q22 20 28 20 L72 20 Q78 20 78 26 L78 32 L22 32 Z" fill="rgba(141,183,255,0.06)" />
        </svg>

        {/* Head */}
        <svg className="lex-svg lex-layer-head" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="lex-head-grad" x1="25" y1="8" x2="75" y2="55">
              <stop offset="0%" stopColor="#1E3F8F" />
              <stop offset="60%" stopColor="#17306E" />
              <stop offset="100%" stopColor="#0D1B42" />
            </linearGradient>
          </defs>
          {/* Head squircle */}
          <rect x="24" y="10" width="52" height="42" rx="18" ry="18" fill="url(#lex-head-grad)" />
          {/* Glass highlight */}
          <path d="M28 16 Q28 10 34 10 L66 10 Q72 10 72 16 L72 22 L28 22 Z" fill="rgba(141,183,255,0.08)" />
          {/* Face visor */}
          <rect x="30" y="22" width="40" height="24" rx="12" ry="12" fill="rgba(8,18,45,0.55)" />
        </svg>

        {/* Eyes */}
        <svg className="lex-svg lex-layer-eyes" viewBox="0 0 100 100" fill="none">
          <g ref={eyesRef} className="lex-eyes-group" style={{ transformOrigin: '50% 34%' }}>
            <ellipse className="lex-eye lex-eye-l" cx="42" cy="34" rx="5" ry="7" />
            <ellipse className="lex-eye lex-eye-r" cx="58" cy="34" rx="5" ry="7" />
            {/* Eye glints */}
            <circle cx="43.5" cy="32" r="1.3" fill="rgba(255,255,255,0.85)" />
            <circle cx="59.5" cy="32" r="1.3" fill="rgba(255,255,255,0.85)" />
          </g>
        </svg>

        {/* Chest — gold scale-of-justice plate */}
        <svg className="lex-svg lex-layer-chest" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="lex-gold-grad" x1="40" y1="60" x2="60" y2="82">
              <stop offset="0%" stopColor="#D9AC42" />
              <stop offset="100%" stopColor="#B8862E" />
            </linearGradient>
          </defs>
          {/* Gold plate */}
          <rect x="38" y="56" width="24" height="20" rx="6" ry="6" fill="url(#lex-gold-grad)" opacity="0.9" />
          {/* Scale-of-justice icon */}
          <g className="lex-scale-icon">
            {/* Vertical post */}
            <line x1="50" y1="59" x2="50" y2="72" stroke="#0D1B42" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
            {/* Horizontal beam */}
            <line x1="44" y1="62" x2="56" y2="62" stroke="#0D1B42" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
            {/* Left pan */}
            <path d="M41 62 Q41 66 44 66 Q47 66 47 62" stroke="#0D1B42" strokeWidth="1" fill="none" opacity="0.6" strokeLinecap="round" />
            {/* Right pan */}
            <path d="M53 62 Q53 66 56 66 Q59 66 59 62" stroke="#0D1B42" strokeWidth="1" fill="none" opacity="0.6" strokeLinecap="round" />
            {/* Top dot */}
            <circle cx="50" cy="59" r="1.1" fill="#0D1B42" opacity="0.7" />
          </g>
        </svg>

        {/* Gold ring — top of head */}
        <svg className="lex-svg lex-layer-ring" viewBox="0 0 100 100" fill="none">
          <ellipse cx="50" cy="12" rx="14" ry="3.5" stroke="#C99A3B" strokeWidth="1.8" fill="none" opacity="0.8" />
          <ellipse cx="50" cy="12" rx="10" ry="2.2" stroke="#D9AC42" strokeWidth="0.8" fill="none" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}
