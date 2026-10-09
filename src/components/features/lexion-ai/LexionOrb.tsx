// LexionOrb — "Adolat Orbi"
// Barcha 3D qatlamlar HTML <span>; SVG faqat tarozi chizmasi sifatida (yassi) ishlatiladi.
// Sahna zanjiri: scene (pointer tilt) > float (suzish) > bump (click) > qatlamlar.
import type { CSSProperties, RefObject } from 'react';

interface LexionOrbProps {
  sceneRef: RefObject<HTMLSpanElement>;
}

interface GlyphDef {
  ch: string;
  a0: number; // boshlang'ich burchak (deg)
  dur: number; // bir aylanish (s)
}

const RING_A: GlyphDef[] = [
  { ch: '§', a0: 25, dur: 15 },
  { ch: '¶', a0: 145, dur: 15 },
  { ch: '§', a0: 265, dur: 15 },
];

const RING_B: GlyphDef[] = [
  { ch: '§', a0: 70, dur: 21 },
  { ch: '§', a0: 250, dur: 21 },
];

type Vars = CSSProperties & Record<`--${string}`, string | number>;

function Orbit({
  variant,
  roll,
  tilt,
  dir,
  glyphs,
}: {
  variant: 'a' | 'b';
  roll: number;
  tilt: number;
  dir: 1 | -1;
  glyphs: GlyphDef[];
}) {
  const style: Vars = { '--roll': roll, '--tilt': tilt, '--dir': dir };
  return (
    <span className={`lex-layer lex-orbit lex-orbit--${variant}`} style={style}>
      <span className="lex-orbit-tilt">
        <span className="lex-orbit-ring" />
        {glyphs.map((g, i) => {
          const gs: Vars = { '--a0': g.a0, '--dur': `${g.dur}s` };
          return (
            <span key={i} className="lex-glyph-orbit" style={gs}>
              <i className="lex-glyph">{g.ch}</i>
            </span>
          );
        })}
      </span>
    </span>
  );
}

export function LexionOrb({ sceneRef }: LexionOrbProps) {
  return (
    <span ref={sceneRef} className="lex-scene" aria-hidden="true">
      <span className="lex-float">
        <span className="lex-bump">
          {/* 1. Orqa nur */}
          <span className="lex-layer lex-glow" style={{ '--z': '-70px' } as Vars} />

          {/* 2. Sezilmas "tinglash" to'lqini (har ~5s) */}
          <span className="lex-layer lex-ping" style={{ '--z': '-10px' } as Vars}>
            <span className="lex-ping-ring" />
          </span>

          {/* 3. Shar + ikki orbita (sharni o'rab o'tadi: old yarmi oldida, orqa yarmi orqasida) */}
          <span className="lex-layer lex-sphere" style={{ '--z': '0px' } as Vars}>
            <span className="lex-rim" />
            <span className="lex-inner-ring" />
            <span className="lex-core" />
            <span className="lex-wave" />
            <span className="lex-specular" />
          </span>

          <Orbit variant="a" roll={-22} tilt={72} dir={1} glyphs={RING_A} />
          <Orbit variant="b" roll={26} tilt={76} dir={-1} glyphs={RING_B} />

          {/* 4. Tarozi — shar markazida, oldinda */}
          <span className="lex-layer lex-scale" style={{ '--z': '26px' } as Vars}>
            <svg className="lex-scale-svg" viewBox="0 0 100 100" fill="none">
              <defs>
                <linearGradient id="lex-gold-v" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFE9A0" />
                  <stop offset="45%" stopColor="#E3B54A" />
                  <stop offset="100%" stopColor="#9A6B22" />
                </linearGradient>
                <linearGradient id="lex-gold-h" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#B07F2A" />
                  <stop offset="40%" stopColor="#FFE9A0" />
                  <stop offset="100%" stopColor="#B07F2A" />
                </linearGradient>
              </defs>

              {/* Asos */}
              <path d="M28 93 L72 93 L63 84 L37 84 Z" fill="url(#lex-gold-v)" />
              {/* Ustun */}
              <rect x="46.5" y="22" width="7" height="64" rx="3.5" fill="url(#lex-gold-h)" />
              {/* Tepa tugma */}
              <circle cx="50" cy="16" r="5" fill="url(#lex-gold-v)" />

              {/* Yelka + pallalar (tebranadi) */}
              <g className="lex-beam">
                <rect x="10" y="23" width="80" height="6" rx="3" fill="url(#lex-gold-h)" />
                <circle cx="50" cy="26" r="6" fill="url(#lex-gold-v)" />
                <circle cx="14" cy="26" r="3.4" fill="url(#lex-gold-v)" />
                <circle cx="86" cy="26" r="3.4" fill="url(#lex-gold-v)" />

                <g className="lex-pan lex-pan--l">
                  <line x1="14" y1="27" x2="2" y2="60" stroke="#E7BE55" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="14" y1="27" x2="26" y2="60" stroke="#E7BE55" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M1 60 L27 60 A13 13 0 0 1 1 60 Z" fill="url(#lex-gold-v)" />
                  <path d="M1 60 L27 60" stroke="#FFF1BC" strokeWidth="1.6" strokeLinecap="round" />
                </g>

                <g className="lex-pan lex-pan--r">
                  <line x1="86" y1="27" x2="74" y2="60" stroke="#E7BE55" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="86" y1="27" x2="98" y2="60" stroke="#E7BE55" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M73 60 L99 60 A13 13 0 0 1 73 60 Z" fill="url(#lex-gold-v)" />
                  <path d="M73 60 L99 60" stroke="#FFF1BC" strokeWidth="1.6" strokeLinecap="round" />
                </g>
              </g>
            </svg>
          </span>
        </span>
      </span>
    </span>
  );
}
