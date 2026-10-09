// LexionAI — o'ng pastki burchakdagi jonli robotcha yordamchi
// Faqat jamoat sahifalarida render qilinadi (istisno sharti App.tsx da).
//
// Harakat tizimi ("rig"): bitta requestAnimationFrame sikli har kadrda barcha qatlamlarning
// transformini yozadi. Kirish ssenariysi, nigoh (ko'z → bosh → tana ketma-ketligi), pirpirash,
// quloq/qo'l o'ynashi, sayr qilish va bosilishga javob shu yerda.
import { useCallback, useEffect, useRef } from 'react';
import './lexion.css';
import { LexionRobot, type LexionReg } from './LexionRobot';
import { LexionLabel } from './LexionLabel';

interface LexionAIProps {
  onOpen?: () => void;
}

// ───────────────────────── sozlamalar ─────────────────────────
const GAZE_FAR = 240; // px — kursor shundan uzoqda bo'lsa nigoh to'liq chetga (tanh bilan yumshoq)
const NEAR = 260; // px — kursor yaqin: ko'zlar sal kattalashadi
const CLICK_LOOK = 150; // px — bosilgan nuqtaga qarashda "kuchliroq" burilish
const CLICK_HOLD = 1.7; // s — bosilgan nuqtaga qarab turish
const HEAD_YAW = 16; // ° — bosh burilishi (juda ko'p tuyulsa kamaytiring)
const HEAD_PITCH = 9; // °
const EYE_TRAVEL_X = 12; // sahna px — qorachiq siljishi (kosa chetida kesiladi)
const EYE_TRAVEL_Y = 9;
const INTRO_KEY = 'lexion:intro:v2'; // sessiyada bir marta to'liq tushish, keyin qisqa chiqish

// ───────────────────────── yordamchilar ─────────────────────────
const clamp = (v: number, a = -1, b = 1) => Math.min(b, Math.max(a, v));
const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const sm = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
// siqilib-cho'zilish: s<0 bo'lsa 1, aks holda so'nuvchi tebranish
const spring = (s: number, amp: number, rate = 7, freq = 2.8) =>
  s < 0 ? 1 : 1 - amp * Math.exp(-rate * s) * Math.cos(2 * Math.PI * freq * s);
const decayOsc = (s: number, amp: number, rate: number, freq: number, phase = 0) =>
  s < 0 ? 0 : amp * Math.exp(-rate * s) * Math.cos(2 * Math.PI * freq * s + phase);
const pulse = (t: number, t0: number, dur = 0.17) => {
  const u = (t - t0) / dur;
  return u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
};

interface Pose {
  x: number; y: number; rot: number; sx: number; sy: number; alpha: number; // butun robot
  torsoRot: number;
  armL: number; armR: number; hand: number;
  footLy: number; footLr: number; footRy: number; footRr: number;
  headX: number; headY: number; headYaw: number; headPitch: number; headRoll: number;
  earL: number; earR: number;
  eyeScale: number; lid: number;
}

const neutral = (): Pose => ({
  x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1,
  torsoRot: 0, armL: 0, armR: 0, hand: 0,
  footLy: 0, footLr: 0, footRy: 0, footRr: 0,
  headX: 0, headY: 0, headYaw: 0, headPitch: 0, headRoll: 0,
  earL: 0, earR: 0, eyeScale: 1, lid: 0,
});

type Gaze = { x: number; y: number };
type WalkState = 'idle' | 'out' | 'pause' | 'back';

export function LexionAI({ onOpen }: LexionAIProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const walkerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const clickTimerRef = useRef<number>();
  const els = useRef<Record<string, HTMLElement | null>>({});
  const regCache = useRef<Record<string, (el: HTMLElement | null) => void>>({});
  const api = useRef<{ react: () => void }>({ react: () => undefined });

  const reg: LexionReg = useCallback((name: string) => {
    if (!regCache.current[name]) {
      regCache.current[name] = (el: HTMLElement | null) => {
        els.current[name] = el;
      };
    }
    return regCache.current[name];
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const walker = walkerRef.current;
    const btn = btnRef.current;
    if (!root || !walker || !btn) return;
    const E = els.current;
    const rig = E.rig;
    if (!rig) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      rig.style.opacity = '1';
      root.classList.add('ready');
      return;
    }

    const onVis = () => root.classList.toggle('tab-hidden', document.hidden);
    document.addEventListener('visibilitychange', onVis);
    onVis();

    // ── o'lchamlar ──
    let W = btn.offsetWidth || 176;
    let k = W / 580;
    const base = { cx: 0, cy: 0, left: 0 };
    const S = {
      t: 0,
      walkX: 0,
      ptr: { x: 0, y: 0 },
      hasPtr: false,
      lastMove: -99,
      look: { x: 0, y: 0 } as Gaze,
      lookUntil: -1,
      glance: { x: -0.4, y: -0.1 } as Gaze,
      nextGlance: 2,
      eye: { x: 0, y: 0 },
      head: { x: 0, y: 0 },
      body: 0,
      blink: { next: 2.2, a: -9, b: -9 },
      reactT0: -9,
      wagT0: -9,
      nextWag: 11,
      earT0: -9,
      nextEar: 6,
      walk: { state: 'idle' as WalkState, dir: -1, target: 0, t0: 0, nextAt: 22, w: 0, phase: 0 },
      intro: { on: true, mode: 'full' as 'full' | 'quick', t0: 0.5, D: 0.8, dist: 800, landed: false, ready: false },
    };

    const measure = () => {
      W = btn.offsetWidth || 176;
      k = W / 580;
      const r = btn.getBoundingClientRect();
      base.cx = r.left + r.width / 2 - S.walkX;
      base.cy = r.top + r.height * 0.4;
      base.left = r.left - S.walkX;
      S.intro.dist = r.top + r.height + 50;
      S.intro.D = clamp(0.55 + S.intro.dist / 2200, 0.62, 0.95);
    };
    measure();

    let seen = false;
    try {
      seen = sessionStorage.getItem(INTRO_KEY) === '1';
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* private mode */
    }
    S.intro.mode = seen ? 'quick' : 'full';
    S.intro.t0 = seen ? 0.25 : 0.55;
    if (seen) S.intro.landed = true;

    // ── DOM yozuvchi (o'zgarmagan qiymatni qayta yozmaydi) ──
    const cache = new Map<HTMLElement, string>();
    const setTf = (el: HTMLElement | null | undefined, tf: string) => {
      if (!el || cache.get(el) === tf) return;
      el.style.transform = tf;
      cache.set(el, tf);
    };
    const f2 = (v: number) => v.toFixed(2);

    // ── hodisalar ──
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      S.ptr.x = e.clientX;
      S.ptr.y = e.clientY;
      S.hasPtr = true;
      S.lastMove = S.t;
    };
    const onDown = (e: PointerEvent) => {
      S.ptr.x = e.clientX;
      S.ptr.y = e.clientY;
      S.lastMove = S.t;
      S.hasPtr = e.pointerType !== 'touch' ? true : S.hasPtr;
      const dx = e.clientX - (base.cx + S.walkX);
      const dy = e.clientY - base.cy;
      S.look = { x: Math.tanh(dx / CLICK_LOOK), y: Math.tanh(dy / CLICK_LOOK) };
      S.lookUntil = S.t + CLICK_HOLD;
      S.nextGlance = S.lookUntil + 2;
    };
    const onLeave = () => {
      S.hasPtr = false;
    };
    const onResize = () => measure();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true, capture: true });
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', onResize);
    api.current.react = () => {
      S.reactT0 = S.t;
    };

    const timers: number[] = [];
    const flash = (el: HTMLElement | null | undefined, ms = 1400) => {
      if (!el) return;
      el.classList.remove('go');
      void el.offsetWidth;
      el.classList.add('go');
      timers.push(window.setTimeout(() => el.classList.remove('go'), ms));
    };

    // ───────────────────────── asosiy sikl ─────────────────────────
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) {
        last = now;
        return;
      }
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      S.t += dt;
      const t = S.t;
      const p = neutral();
      let introGaze: Gaze | null = null;
      let introBlink = 0;

      // 1) Tinch holat: suzish, nafas, qo'l-quloq tebranishi
      const ph = (t * 2 * Math.PI) / 3.6;
      p.y += (-(1 - Math.cos(ph)) / 2) * 0.04 * W;
      p.sy *= 1 + 0.006 * Math.sin(ph + 0.5);
      p.sx *= 1 - 0.004 * Math.sin(ph + 0.5);
      p.armL += 2.5 * Math.sin(ph + 0.9);
      p.armR += 1.2 * Math.sin(ph + 0.9);
      p.hand += 1.5 * Math.sin(ph * 1.3);
      p.earL += 1.8 * Math.sin(ph - 0.7);
      p.earR += -1.8 * Math.sin(ph - 0.7);
      p.headY += 0.25 * Math.sin(ph - 0.6);
      p.headRoll += 1.3 * Math.sin((t * 2 * Math.PI) / 5);

      const I = S.intro;
      const idleOk = !I.on && t - S.reactT0 > 1.2;

      // 2) Kirish ssenariysi
      if (I.on) {
        const it = t - I.t0;
        const landing = (s: number) => {
          // qo'nish: siqilish, ikki sakrash, bosh va quloqlar kechikib qaytadi
          const sq = spring(s, 0.16, 6.5, 2.7) * (s > 0.46 ? spring(s - 0.46, 0.05, 8, 3) : 1);
          p.sy *= sq;
          p.sx *= 1 / Math.sqrt(sq);
          if (s > 0.16 && s < 0.46) p.y += -Math.sin((Math.PI * (s - 0.16)) / 0.3) * 0.1 * W;
          if (s > 0.64 && s < 0.84) p.y += -Math.sin((Math.PI * (s - 0.64)) / 0.2) * 0.025 * W;
          p.headY += decayOsc(s, 2.4, 6, 3.2);
          p.headPitch += decayOsc(s, 6, 6, 3.2);
          const flop = decayOsc(s, 6, 4, 4.5);
          p.earL += flop;
          p.earR += -flop;
          p.armL += decayOsc(s, 10, 4.5, 3);
          p.armR += decayOsc(s, -4, 4.5, 3);
          p.hand += decayOsc(s, 7, 5, 5);
          // nigoh: avval pastga, keyin atrofga qarab "hayron" bo'ladi
          if (s < 0.55) introGaze = { x: 0, y: 0.6 };
          else if (s < 0.95) introGaze = { x: -0.15, y: 0.1 };
          else if (s < 1.5) introGaze = { x: -0.9, y: -0.15 };
          else if (s < 2.0) introGaze = { x: 0.8, y: -0.35 };
          introBlink = Math.max(pulse(s, 0.62), pulse(s, 0.86));
          // diqqat tortish: barmoq bilan "mana men!" va kichik sakrash
          const wt = s - 1.95;
          if (wt > 0 && wt < 1.5) {
            const env = sm(wt / 0.12) * (1 - sm((wt - 1.0) / 0.4));
            p.hand += 8 * Math.sin(2 * Math.PI * 3.4 * wt) * env;
            p.armR += -3 * env;
            p.earL += 4 * env;
            p.earR += -4 * env;
            p.y += -Math.sin(Math.PI * clamp(wt / 0.4, 0, 1)) * 0.045 * W;
            p.eyeScale = 1 + 0.06 * env;
          }
          if (s > 3.5) {
            I.on = false;
            S.nextGlance = t + 0.8;
            S.nextWag = t + rnd(9, 14);
            S.nextEar = t + rnd(4, 8);
            S.walk.nextAt = t + rnd(16, 26);
            S.blink.next = t + 1.2;
          }
        };
        if (it < 0) {
          p.y += -I.dist;
          p.alpha = 0;
        } else if (I.mode === 'full') {
          if (it < I.D) {
            const u = it / I.D;
            p.y += -I.dist * (1 - u * u);
            p.rot += Math.sin(it * 7.5) * 7 * (1 - u);
            p.sy *= 1 + 0.05 * u;
            p.sx *= 1 - 0.03 * u;
            p.armL += 12 * Math.sin(it * 24);
            p.armR += 6 * Math.sin(it * 21 + 1);
            p.hand += 7 * Math.sin(it * 30);
            p.footLr += 8 * Math.sin(it * 18);
            p.footRr += -8 * Math.sin(it * 18 + 0.7);
            p.earL += 4 + 3 * Math.sin(it * 34);
            p.earR += -(4 + 3 * Math.sin(it * 34 + 1));
            p.eyeScale = 1.1;
            introGaze = { x: 0, y: 0.75 };
          } else {
            const s = it - I.D;
            if (!I.landed) {
              I.landed = true;
              flash(E.dust, 1200);
              flash(E.burst, 1500);
            }
            if (!I.ready && s > 1.2) {
              I.ready = true;
              root.classList.add('ready');
            }
            landing(s);
          }
        } else {
          // qisqa chiqish (sessiyada qayta kirganda): joyida paydo bo'ladi, atrofga qaraydi, barmoq o'ynatadi
          const a = sm(it / 0.4);
          p.alpha = a;
          p.sx *= 0.92 + 0.08 * a;
          p.sy *= 0.92 + 0.08 * a;
          if (!I.ready) {
            I.ready = true;
            root.classList.add('ready');
          }
          landing(it + 1.5);
        }
      }

      // 3) Bosilishga javob: sakrash, bosh irg'ashi, panja o'ynashi
      const rt = t - S.reactT0;
      if (rt >= 0 && rt < 1.3) {
        p.y += -Math.sin(Math.PI * clamp(rt / 0.5, 0, 1)) * 0.085 * W;
        p.sy *= rt < 0.5 ? 1 + 0.045 * Math.sin((Math.PI * rt) / 0.5) : spring(rt - 0.5, 0.07, 8, 3);
        p.headPitch += 8 * Math.sin(Math.PI * clamp((rt - 0.05) / 0.45, 0, 1));
        p.armL += 6 * Math.sin(Math.PI * clamp(rt / 0.5, 0, 1));
        p.hand += 8 * Math.sin(2 * Math.PI * 4 * rt) * Math.exp(-2.5 * rt);
        p.earL += 5 * Math.exp(-3 * rt) * Math.sin(2 * Math.PI * 6 * rt);
        p.earR += -5 * Math.exp(-3 * rt) * Math.sin(2 * Math.PI * 6 * rt + 0.8);
        p.eyeScale = Math.max(p.eyeScale, 1 + 0.06 * Math.exp(-3 * rt));
      }

      // 4) Vaqti-vaqti: barmoq o'ynatish va quloq qimirlatish
      if (idleOk) {
        if (t >= S.nextWag) {
          S.wagT0 = t;
          S.nextWag = t + rnd(10, 17);
        }
        if (t >= S.nextEar) {
          S.earT0 = t;
          S.nextEar = t + rnd(5, 10);
        }
      }
      const wt = t - S.wagT0;
      if (wt >= 0 && wt < 1.5) {
        const env = sm(wt / 0.12) * (1 - sm((wt - 1.0) / 0.4));
        p.hand += 7 * Math.sin(2 * Math.PI * 3.4 * wt) * env;
        p.armR += -2.5 * env;
      }
      const et = t - S.earT0;
      if (et >= 0 && et < 1) {
        p.earL += 6 * Math.sin(2 * Math.PI * 6 * et) * Math.exp(-4 * et);
        p.earR += -6 * Math.sin(2 * Math.PI * 6 * et + 0.8) * Math.exp(-4 * et);
      }

      // 5) Sayr: ba'zan bir necha qadam yurib, atrofga qarab, qaytib keladi
      const Wk = S.walk;
      const ptrDist = S.hasPtr ? Math.hypot(S.ptr.x - (base.cx + S.walkX), S.ptr.y - base.cy) : 9999;
      const maxWalk = clamp(base.left - 24, 0, 150 * (W / 176));
      let walkSpeed = 0;
      if (Wk.state === 'idle') {
        if (t >= Wk.nextAt) {
          if (idleOk && ptrDist > 320 && maxWalk > 40) {
            Wk.state = 'out';
            Wk.dir = -1;
            Wk.target = -rnd(0.5, 0.85) * maxWalk;
            Wk.t0 = t;
          } else {
            Wk.nextAt = t + 6;
          }
        }
      } else if (Wk.state === 'out' || Wk.state === 'back') {
        const goal = Wk.state === 'out' ? Wk.target : 0;
        const remain = Math.abs(goal - S.walkX);
        walkSpeed = Math.min(sm((t - Wk.t0) / 0.4), clamp(remain / (W * 0.22), 0.18, 1));
        S.walkX += Wk.dir * 0.4 * W * walkSpeed * dt;
        if ((Wk.dir < 0 && S.walkX <= goal) || (Wk.dir > 0 && S.walkX >= goal)) {
          S.walkX = goal;
          if (Wk.state === 'out') {
            Wk.state = 'pause';
            Wk.t0 = t;
          } else {
            Wk.state = 'idle';
            Wk.nextAt = t + rnd(30, 55);
          }
        }
        if (!idleOk && !I.on && Wk.state === 'out') {
          Wk.state = 'back';
          Wk.dir = 1;
          Wk.t0 = t;
        }
      } else if (Wk.state === 'pause') {
        if (t - Wk.t0 > rnd(1.5, 2.2) || ptrDist < 200) {
          Wk.state = 'back';
          Wk.dir = 1;
          Wk.t0 = t;
        }
      }
      Wk.w = damp(Wk.w, walkSpeed, 9, dt);
      const ww = Wk.w;
      if (ww > 0.01) {
        Wk.phase += 2 * Math.PI * 1.25 * dt * ww;
        const sn = Math.sin(Wk.phase);
        p.footLy += -Math.max(0, sn) * 2.8 * ww;
        p.footRy += -Math.max(0, -sn) * 2.8 * ww;
        p.footLr += -Math.max(0, sn) * 6 * ww;
        p.footRr += Math.max(0, -sn) * 6 * ww;
        p.y += -Math.abs(sn) * 0.02 * W * ww;
        p.torsoRot += sn * 2.4 * ww;
        p.rot += Wk.dir * 1.6 * ww;
        p.armL += -sn * 10 * ww;
        p.armR += sn * 4 * ww;
        p.hand += Math.cos(Wk.phase * 2) * 4 * ww;
        p.headRoll += -sn * 1.8 * ww;
        const bounce = Math.sin(Wk.phase * 2 + 0.5) * 4 * ww;
        p.earL += bounce;
        p.earR += -bounce;
      }
      const walking = Wk.state === 'out' || Wk.state === 'back';

      // 6) Nigoh: bosilgan nuqta > kursor > sayr yo'nalishi > tasodifiy qarashlar
      let tg: Gaze;
      if (introGaze) {
        tg = introGaze;
      } else if (walking) {
        tg = { x: Wk.dir * 0.75, y: 0.05 };
      } else if (t < S.lookUntil) {
        tg = S.look;
      } else if (S.hasPtr && t - S.lastMove < 5) {
        const dx = S.ptr.x - (base.cx + S.walkX);
        const dy = S.ptr.y - base.cy;
        tg = { x: Math.tanh(dx / GAZE_FAR), y: Math.tanh(dy / GAZE_FAR) };
      } else {
        if (t >= S.nextGlance) {
          S.glance = Math.random() < 0.28 ? { x: rnd(-0.2, 0.2), y: rnd(-0.15, 0.2) } : { x: rnd(-1, 0.35), y: rnd(-0.5, 0.5) };
          S.nextGlance = t + rnd(1.5, 3.8);
        }
        tg = S.glance;
      }
      if (ptrDist < NEAR) p.eyeScale = Math.max(p.eyeScale, 1.04);

      // ko'z tez, bosh sekinroq, tana eng sekin — shuning uchun nigoh "jonli" ko'rinadi
      const lead = t < S.lookUntil ? 1.5 : 1;
      S.eye.x = damp(S.eye.x, tg.x, 16 * lead, dt);
      S.eye.y = damp(S.eye.y, tg.y, 16 * lead, dt);
      S.head.x = damp(S.head.x, tg.x * 0.85, 4.5 * lead, dt);
      S.head.y = damp(S.head.y, tg.y * 0.85, 4.5 * lead, dt);
      S.body = damp(S.body, tg.x, 2.2, dt);

      p.headYaw += S.head.x * HEAD_YAW;
      p.headPitch += -S.head.y * HEAD_PITCH;
      p.headRoll += S.head.x * 2.5;
      p.headX += S.head.x * 0.5;
      p.torsoRot += S.body * 1.2;

      // 7) Pirpirash: tasodifiy, ba'zan ikki marta
      const B = S.blink;
      if (t >= B.next) {
        B.a = t;
        B.b = Math.random() < 0.22 ? t + 0.3 : -9;
        B.next = t + rnd(2.2, 5.6);
      }
      p.lid = clamp(Math.max(pulse(t, B.a), pulse(t, B.b), introBlink), 0, 1);

      // ───────────── DOM ga yozish ─────────────
      setTf(E.rig, `translate3d(${f2(p.x)}px,${f2(p.y)}px,0) rotate(${f2(p.rot)}deg) scale(${p.sx.toFixed(4)},${p.sy.toFixed(4)})`);
      rig.style.opacity = p.alpha >= 0.999 ? '1' : p.alpha.toFixed(3);
      setTf(E.body, `rotate(${f2(p.torsoRot)}deg)`);
      setTf(E.armL, `rotate(${f2(clamp(p.armL, -16, 16))}deg)`);
      setTf(E.armR, `rotate(${f2(clamp(p.armR, -10, 10))}deg)`);
      setTf(E.hand, `rotate(${f2(clamp(p.hand, -10, 10))}deg)`);
      setTf(E.footL, `translate(0,${f2(p.footLy)}%) rotate(${f2(p.footLr)}deg)`);
      setTf(E.footR, `translate(0,${f2(p.footRy)}%) rotate(${f2(p.footRr)}deg)`);
      setTf(
        E.head,
        `perspective(${f2(4.3 * W)}px) translate3d(${f2(p.headX)}%,${f2(p.headY)}%,0) rotateY(${f2(p.headYaw)}deg) rotateX(${f2(p.headPitch)}deg) rotateZ(${f2(p.headRoll)}deg)`,
      );
      setTf(E.earL, `translateZ(${f2(-30 * k)}px) rotate(${f2(clamp(p.earL, -9, 9))}deg)`);
      setTf(E.earR, `translateZ(${f2(-30 * k)}px) rotate(${f2(clamp(p.earR, -9, 9))}deg)`);

      const ex = (S.eye.x - S.head.x * 0.5) * EYE_TRAVEL_X;
      const ey = (S.eye.y - S.head.y * 0.5) * EYE_TRAVEL_Y;
      const squeeze = 1 - 0.06 * Math.abs(S.eye.x);
      const irisTf = `translate(${f2(ex)}%,${f2(ey)}%) scale(${(p.eyeScale * squeeze).toFixed(3)},${p.eyeScale.toFixed(3)})`;
      setTf(E.irisL, irisTf);
      setTf(E.irisR, irisTf);
      const lidTf = `scaleY(${p.lid.toFixed(3)})`;
      setTf(E.lidL, lidTf);
      setTf(E.lidR, lidTf);

      // yer soyasi: balandlikka qarab kichrayadi
      const h = Math.max(0, -p.y) / W;
      const sc = clamp(1 - h * 1.1, 0, 1);
      const shadow = E.shadow;
      if (shadow) {
        setTf(shadow, `scale(${(0.3 + 0.7 * sc * p.sx).toFixed(3)},${(0.3 + 0.7 * sc).toFixed(3)})`);
        shadow.style.opacity = (0.9 * sc * p.alpha).toFixed(3);
      }
      if (E.glow) E.glow.style.opacity = (sc * p.alpha).toFixed(3);
      setTf(walker, `translate3d(${f2(S.walkX)}px,0,0)`);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', onResize);
      api.current.react = () => undefined;
    };
  }, []);

  useEffect(() => () => window.clearTimeout(clickTimerRef.current), []);

  const handleClick = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const btn = btnRef.current;
    const pill = pillRef.current;
    btn?.classList.add('respond');
    api.current.react();
    if (pill) {
      pill.classList.remove('pulse');
      void pill.offsetWidth;
      pill.classList.add('pulse');
    }
    onOpen?.();
    clickTimerRef.current = window.setTimeout(() => {
      btn?.classList.remove('respond');
      pill?.classList.remove('pulse');
      busyRef.current = false;
    }, 900);
  }, [onOpen]);

  return (
    <div ref={rootRef} className="lex-root">
      <div ref={walkerRef} className="lex-walker">
        <button ref={btnRef} type="button" className="lex-btn" onClick={handleClick} aria-label="Lexion AI yordamchisi">
          <LexionRobot reg={reg} />
        </button>
        <LexionLabel onClick={handleClick} pulseRef={pillRef} />
      </div>
    </div>
  );
}
