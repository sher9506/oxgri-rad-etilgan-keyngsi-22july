// LexionRobot — FanFaster uchun yumaloq 3D robotcha-qahramon
// 11 ta alohida qatlam: bosh, 2 quloq, 2 ko'z qorachig'i, tana, 2 qo'l, panja, 2 oyoq.
// Qismlar bir-birining ostiga kirib turadi (qo'llar va oyoqlar tana ostida, quloqlar bosh ostida),
// shuning uchun harakatda ham hech qachon ajralib ketmaydi. Harakatni LexionAI.tsx boshqaradi.
import type { CSSProperties } from 'react';
import { LEXION_H, LEXION_SPRITES, LEXION_W, type LexionPart } from './lexionAssets';

export type LexionReg = (name: string) => (el: HTMLElement | null) => void;

interface LexionRobotProps {
  reg: LexionReg;
}

const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;
const origin = (x: number, y: number) => `${pct(x, LEXION_W)} ${pct(y, LEXION_H)}`;

function Sprite({ name }: { name: LexionPart }) {
  const s = LEXION_SPRITES[name];
  const style: CSSProperties = {
    left: pct(s.x, LEXION_W),
    top: pct(s.y, LEXION_H),
    width: pct(s.w, LEXION_W),
    height: pct(s.h, LEXION_H),
  };
  return (
    <span className="lex-sp" style={style}>
      <img src={s.src} alt="" draggable={false} />
    </span>
  );
}

// Ko'z kosasi: markaz (cx, cy) — rasm koordinatalarida. Qorachiq kosadan chiqib ketmaydi (clip).
function EyeSocket({ side, cx, cy, reg }: { side: 'L' | 'R'; cx: number; cy: number; reg: LexionReg }) {
  const iris = LEXION_SPRITES[side === 'L' ? 'irisL' : 'irisR'];
  const left = cx - 50;
  const top = cy - 50;
  return (
    <span
      className="lex-eye"
      style={{ left: pct(left, LEXION_W), top: pct(top, LEXION_H), width: pct(100, LEXION_W), height: pct(100, LEXION_H) }}
    >
      <span
        className="lex-iris"
        ref={reg(`iris${side}`)}
        style={{ left: `${iris.x - left}%`, top: `${iris.y - top}%` }}
      >
        <img src={iris.src} alt="" draggable={false} />
      </span>
      <span className="lex-lid" ref={reg(`lid${side}`)} />
    </span>
  );
}

export function LexionRobot({ reg }: LexionRobotProps) {
  return (
    <span className="lex-scene" ref={reg('scene')} aria-hidden="true">
      <span className="lex-lay" ref={reg('glow')}>
        <span className="lex-glow" />
      </span>
      <span className="lex-shadow" ref={reg('shadow')} />

      <span className="lex-rig" ref={reg('rig')}>
        <span className="lex-lay lex-body" ref={reg('body')} style={{ transformOrigin: '50% 88%' }}>
          {/* Qo'llar va oyoqlar — tana ostida */}
          <span className="lex-lay" ref={reg('armL')} style={{ transformOrigin: origin(205, 372) }}>
            <Sprite name="armL" />
          </span>
          <span className="lex-lay" ref={reg('armR')} style={{ transformOrigin: origin(378, 365) }}>
            <Sprite name="armR" />
            {/* Panja (ko'rsatkich barmoq) — bilak ustida, bilak bilan birga harakatlanadi */}
            <span className="lex-lay" ref={reg('hand')} style={{ transformOrigin: origin(470, 388) }}>
              <Sprite name="hand" />
            </span>
          </span>
          <span className="lex-lay" ref={reg('footL')} style={{ transformOrigin: origin(210, 530) }}>
            <Sprite name="footL" />
          </span>
          <span className="lex-lay" ref={reg('footR')} style={{ transformOrigin: origin(370, 530) }}>
            <Sprite name="footR" />
          </span>

          {/* Tana + ko'krak emblemasi */}
          <span className="lex-lay" ref={reg('torso')}>
            <Sprite name="torso" />
            <span className="lex-emblem">
              <i className="lex-impact-ring" />
            </span>
          </span>

          {/* Bosh: bo'yin nuqtasi atrofida 3D buriladi; quloqlar orqada (Z<0), yuz oldinda */}
          <span className="lex-lay lex-head" ref={reg('head')} style={{ transformOrigin: origin(288, 336) }}>
            <span className="lex-lay lex-ear" ref={reg('earL')} style={{ transformOrigin: origin(112, 185) }}>
              <Sprite name="earL" />
            </span>
            <span className="lex-lay lex-ear" ref={reg('earR')} style={{ transformOrigin: origin(468, 155) }}>
              <Sprite name="earR" />
            </span>
            <span className="lex-lay">
              <Sprite name="head" />
            </span>
            <EyeSocket side="L" cx={216} cy={204.8} reg={reg} />
            <EyeSocket side="R" cx={367.4} cy={189.8} reg={reg} />
          </span>
        </span>
      </span>

      {/* Qo'nganda chang va § belgilari */}
      <span className="lex-dust" ref={reg('dust')}>
        <i style={{ ['--dx' as string]: '-46%', ['--d' as string]: '0ms' }} />
        <i style={{ ['--dx' as string]: '46%', ['--d' as string]: '0ms' }} />
        <i style={{ ['--dx' as string]: '-26%', ['--d' as string]: '50ms' }} />
        <i style={{ ['--dx' as string]: '28%', ['--d' as string]: '50ms' }} />
        <i style={{ ['--dx' as string]: '-62%', ['--d' as string]: '90ms' }} />
        <i style={{ ['--dx' as string]: '64%', ['--d' as string]: '90ms' }} />
      </span>
      <span className="lex-burst" ref={reg('burst')}>
        <i style={{ ['--bx' as string]: '-70px', ['--by' as string]: '-90px', ['--bd' as string]: '0ms' }}>§</i>
        <i style={{ ['--bx' as string]: '-34px', ['--by' as string]: '-130px', ['--bd' as string]: '40ms' }}>¶</i>
        <i style={{ ['--bx' as string]: '10px', ['--by' as string]: '-150px', ['--bd' as string]: '80ms' }}>§</i>
        <i style={{ ['--bx' as string]: '52px', ['--by' as string]: '-120px', ['--bd' as string]: '20ms' }}>¶</i>
        <i style={{ ['--bx' as string]: '86px', ['--by' as string]: '-84px', ['--bd' as string]: '60ms' }}>§</i>
      </span>

      {/* Doimiy suzuvchi belgilar */}
      <span className="lex-sparks">
        <i className="lex-spark" style={{ left: '86%', top: '8%', animationDelay: '0s' }}>§</i>
        <i className="lex-spark" style={{ left: '3%', top: '12%', animationDelay: '2s' }}>¶</i>
        <i className="lex-spark" style={{ left: '54%', top: '1%', animationDelay: '4s' }}>§</i>
      </span>
    </span>
  );
}
