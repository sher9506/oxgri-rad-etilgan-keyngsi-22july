// LexionRobot — FanFaster uchun yumaloq 3D robotcha-qahramon
// Ikki qatlam: TANA va BOSH. Ikkalasi ham yassi rasm, 3D effekt faqat boshning
// bo'yin nuqtasi atrofida burilishidan hosil bo'ladi — shuning uchun qismlar hech qachon ajralib ketmaydi.
import type { RefObject } from 'react';
import { LEXION_BODY, LEXION_HEAD } from './lexionAssets';

interface LexionRobotProps {
  sceneRef: RefObject<HTMLSpanElement>;
}

export function LexionRobot({ sceneRef }: LexionRobotProps) {
  return (
    <span ref={sceneRef} className="lex-scene" aria-hidden="true">
      <span className="lex-float">
        <span className="lex-bump">
          {/* Orqa nur */}
          <span className="lex-glow" />

          {/* Tana */}
          <span className="lex-bodywrap">
            <img className="lex-part" src={LEXION_BODY} alt="" draggable={false} />
            {/* Click: ko'krak emblemasidan oltin zarba */}
            <span className="lex-emblem">
              <i className="lex-impact-ring" />
            </span>
          </span>

          {/* Bosh (bo'yin nuqtasi atrofida buriladi) */}
          <span className="lex-headwrap">
            <span className="lex-headsway">
              <img className="lex-part" src={LEXION_HEAD} alt="" draggable={false} />
              {/* Ko'z qovoqlari (pirpiratish) */}
              <i className="lex-lid lex-lid--l" />
              <i className="lex-lid lex-lid--r" />
            </span>
          </span>

          {/* Suzuvchi § belgilari */}
          <span className="lex-sparks">
            <i className="lex-spark" style={{ left: '86%', top: '8%', animationDelay: '0s' }}>§</i>
            <i className="lex-spark" style={{ left: '3%', top: '12%', animationDelay: '2s' }}>¶</i>
            <i className="lex-spark" style={{ left: '54%', top: '1%', animationDelay: '4s' }}>§</i>
          </span>
        </span>
      </span>
    </span>
  );
}
