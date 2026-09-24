/* ═══════════════════════════════════════════════════════════════════════════
   STATISTICS — "Raqamning o'zi qahramon"
   Sub-components: DotMatrixCrowd, LayeredSheets, NetworkGraph,
   SatisfactionRing, StatCard, StatsGrid
   Each visual occupies 40%+ of card area and is integrated with the number.
   Main visuals opacity 0.6–1, background layers 0.15–0.3.
   ═══════════════════════════════════════════════════════════════════════════ */

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as [number, number, number, number];

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduce(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduce;
}

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: none), (pointer: coarse)');
    const handler = () => setIsTouch(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isTouch;
}

function useInViewOnce(margin = '-60px') {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin });
  return { ref, inView };
}

function useCountUp(target: number, start: boolean, reduce: boolean, duration = 1600) {
  const [value, setValue] = useState(reduce ? target : 0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!start) return;
    if (reduce) { setValue(target); return; }
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setValue(Math.round(eased * target));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [start, target, reduce, duration]);
  return value;
}

/* ── 3D Tilt hook: pointer on desktop, auto-sway on touch, none on reduced-motion ── */
function use3DTilt(reduce: boolean, isTouch: boolean, index: number, intensity = 8) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [spotX, setSpotX] = useState(50);
  const [spotY, setSpotY] = useState(50);
  const [autoTilt, setAutoTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (reduce || !isTouch) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      setAutoTilt({ x: Math.sin(t * 0.7 + index) * 3, y: Math.cos(t * 0.5 + index) * 3 });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, isTouch, index]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current || reduce || isTouch) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width;
    const dy = (e.clientY - rect.top) / rect.height;
    setTilt({ x: -(dy - 0.5) * intensity, y: (dx - 0.5) * intensity });
    setSpotX(dx * 100);
    setSpotY(dy * 100);
    setHovered(true);
  }, [reduce, isTouch, intensity]);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setSpotX(50);
    setSpotY(50);
    setHovered(false);
  }, []);

  return { ref, effectiveTilt: isTouch ? autoTilt : tilt, spotX, spotY, hovered, handleMouseMove, handleMouseLeave };
}

type StatItem = {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  suffix: string;
  label: string;
  color: string;
  accent: string;
  microType: string;
};

/* ═══ Visual 1: Dot Matrix "Crowd" — bottom strip, wave lights left→right (~4s cycle) ═══ */
function DotMatrixCrowd({ accent, reduce }: { accent: string; reduce: boolean }) {
  const cols = 14;
  const rows = 3;
  const [wavePos, setWavePos] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setWavePos(p => (p + 0.5) % (cols + 4)), 200);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div
      className="w-full"
      aria-hidden="true"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '4px', justifyItems: 'center' }}
    >
      {Array.from({ length: cols * rows }).map((_, i) => {
        const col = i % cols;
        const dist = wavePos - col;
        const lit = dist >= 0 && dist <= 4;
        const intensity = lit ? Math.max(0, 1 - dist / 4) : 0;
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: '5px',
              height: '5px',
              background: accent,
              opacity: reduce ? 0.55 : 0.2 + intensity * 0.7,
              transform: reduce ? 'scale(1)' : `scale(${1 + intensity * 0.4})`,
              boxShadow: lit && !reduce ? `0 0 6px ${accent}` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

/* ═══ Visual 2: Layered Glass Sheets — isometric 3D document stack, breathing ±3px
   Pointer hover: fan out. Touch: slight default fan. Looks like real document pages. ═══ */
function LayeredSheets({ accent, reduce, isTouch, hovered }: { accent: string; reduce: boolean; isTouch: boolean; hovered: boolean }) {
  const sheetCount = 4;
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true" style={{ perspective: '700px', transformStyle: 'preserve-3d' }}>
      {Array.from({ length: sheetCount }).map((_, i) => {
        const baseZ = (i - (sheetCount - 1) / 2) * 10;
        const fanOffset = hovered ? (i - (sheetCount - 1) / 2) * 20 : isTouch ? (i - (sheetCount - 1) / 2) * 8 : 0;
        return (
          <motion.div
            key={i}
            className="absolute rounded-lg border bg-white/85 shadow-sm overflow-hidden"
            style={{ borderColor: `${accent}30`, width: '62%', height: '72%', transformStyle: 'preserve-3d' }}
            animate={reduce ? {} : { translateZ: [baseZ - 1.5, baseZ + 1.5, baseZ - 1.5] }}
            transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
          >
            <motion.div
              animate={{ x: fanOffset, rotateY: hovered ? fanOffset * 0.4 : 0, opacity: hovered ? 1 : 0.85 }}
              transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
              style={{ width: '100%', height: '100%' }}
            >
              {/* Document content lines */}
              <div className="p-2.5 space-y-1.5">
                <div className="h-1.5 w-1/3 rounded-full" style={{ background: `${accent}50` }} />
                <div className="h-1 w-full rounded-full bg-slate-200" />
                <div className="h-1 w-5/6 rounded-full bg-slate-200" />
                <div className="h-1 w-4/5 rounded-full bg-slate-200" />
                <div className="h-1 w-3/4 rounded-full bg-slate-200" />
                {i === 0 && (
                  <>
                    <div className="h-1 w-2/3 rounded-full bg-slate-200 mt-2" />
                    <div className="h-1 w-1/2 rounded-full bg-slate-200" />
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ═══ Visual 3: Network Graph — card background, 12 nodes, pulse travels along edges ═══ */
function NetworkGraph({ accent, reduce }: { accent: string; reduce: boolean }) {
  const nodes = useMemo(() => [
    { x: 15, y: 20 }, { x: 45, y: 12 }, { x: 78, y: 18 }, { x: 25, y: 45 },
    { x: 55, y: 38 }, { x: 85, y: 42 }, { x: 12, y: 68 }, { x: 40, y: 62 },
    { x: 68, y: 55 }, { x: 90, y: 72 }, { x: 30, y: 82 }, { x: 60, y: 85 },
  ], []);

  const edges = useMemo(() => [
    [0, 1], [1, 2], [0, 3], [1, 4], [2, 5], [3, 4], [4, 5],
    [3, 6], [4, 7], [5, 8], [6, 7], [7, 8], [6, 9], [8, 9],
    [7, 10], [8, 11], [10, 11], [0, 4], [2, 4],
  ], []);

  const [activeEdge, setActiveEdge] = useState(0);
  const [litNode, setLitNode] = useState(-1);

  useEffect(() => {
    if (reduce) return;
    const edgeId = setInterval(() => setActiveEdge(p => (p + 1) % edges.length), 1200);
    const nodeId = setInterval(() => setLitNode(Math.floor(Math.random() * nodes.length)), 2200);
    return () => { clearInterval(edgeId); clearInterval(nodeId); };
  }, [reduce, edges.length, nodes.length]);

  const edge = edges[activeEdge];

  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke={accent}
          strokeWidth={i === activeEdge && !reduce ? 0.8 : 0.4}
          strokeOpacity={i === activeEdge && !reduce ? 0.7 : 0.2}
          style={{ transition: 'stroke-width 0.4s ease, stroke-opacity 0.4s ease' }}
        />
      ))}
      {!reduce && edge && (
        <motion.circle
          key={`pulse-${activeEdge}`}
          r="1.5"
          fill={accent}
          initial={{ cx: nodes[edge[0]].x, cy: nodes[edge[0]].y, opacity: 0 }}
          animate={{ cx: nodes[edge[1]].x, cy: nodes[edge[1]].y, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.2, ease: 'linear', opacity: { duration: 1.2, times: [0, 0.15, 0.85, 1] } }}
        />
      )}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x} cy={n.y}
          r={i === litNode && !reduce ? 2 : 1.2}
          fill={accent}
          opacity={i === litNode && !reduce ? 1 : 0.55}
          style={{ transition: 'r 0.3s ease, opacity 0.3s ease' }}
        />
      ))}
    </svg>
  );
}

/* ═══ Visual 4: Satisfaction Ring — wraps around the number itself, draws 0→98% ═══ */
function SatisfactionRing({ accent, reduce, inView }: { accent: string; reduce: boolean; inView: boolean }) {
  const R = 44;
  const CIRC = 2 * Math.PI * R;
  const [dash, setDash] = useState(reduce ? 0.02 : 1);

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setDash(0.02); return; }
    const startTime = performance.now();
    const duration = 1600;
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setDash(1 - eased * 0.98);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, reduce]);

  return (
    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={R} fill="none" stroke={accent} strokeOpacity="0.12" strokeWidth="4" />
      <circle
        cx="50" cy="50" r={R}
        fill="none" stroke={accent} strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={dash * CIRC}
        style={{
          filter: dash < 0.05 ? `drop-shadow(0 0 6px ${accent})` : 'none',
          transition: 'filter 0.6s ease',
        }}
      />
    </svg>
  );
}

/* ═══ StatCard: number is the hero, visual lives around/behind/within it ═══ */
function StatCard({ stat, index, reduce, isTouch }: { stat: StatItem; index: number; reduce: boolean; isTouch: boolean }) {
  const { ref: inViewRef, inView } = useInViewOnce('-30px');
  const tilt = use3DTilt(reduce, isTouch, index, 8);
  const count = useCountUp(stat.value, inView, reduce);
  const Icon = stat.icon;

  return (
    <motion.div
      ref={inViewRef}
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.12, ease: EASE_OUT_EXPO }}
    >
      <div
        ref={tilt.ref}
        onMouseMove={tilt.handleMouseMove}
        onMouseLeave={tilt.handleMouseLeave}
        className="relative h-full min-h-[210px] rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-sm overflow-hidden transition-shadow duration-500 hover:shadow-xl"
        style={{
          transform: `perspective(900px) rotateX(${tilt.effectiveTilt.x}deg) rotateY(${tilt.effectiveTilt.y}deg)`,
          transition: isTouch ? 'none' : 'transform 0.2s ease-out',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Pointer-following radial highlight */}
        {!isTouch && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(220px circle at ${tilt.spotX}% ${tilt.spotY}%, ${stat.accent}15, transparent 60%)` }}
          />
        )}

        {/* Background visual — network graph behind kazuslar card */}
        {stat.microType === 'kazuslar' && (
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.28 }}>
            <NetworkGraph accent={stat.accent} reduce={reduce} />
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 p-5 flex flex-col items-center justify-center gap-3 h-full" style={{ transformStyle: 'preserve-3d' }}>
          {/* 3D Icon plate — 3 layers: shadow, main plate, top highlight */}
          <div style={{ transform: 'translateZ(12px)', transformStyle: 'preserve-3d' }}>
            <div
              className={`absolute inset-0 rounded-xl bg-gradient-to-br ${stat.color} blur-md`}
              style={{ transform: 'translateZ(-4px) scale(1.05)', opacity: 0.35 }}
            />
            <div
              className={`relative w-11 h-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <Icon className="h-5 w-5 text-white" style={{ transform: 'translateZ(4px)' }} />
              <div className="absolute inset-x-0 top-0 h-1/3 rounded-t-xl bg-white/25" style={{ transform: 'translateZ(2px)' }} />
            </div>
          </div>

          {/* Number + integrated visual */}
          <div className="relative flex items-center justify-center" style={{ minHeight: '70px' }}>
            {stat.microType === 'satisfaction' ? (
              <div className="relative w-[115px] h-[115px] flex items-center justify-center">
                <SatisfactionRing accent={stat.accent} reduce={reduce} inView={inView} />
                <p
                  className="relative z-10 text-3xl font-black text-slate-900 tabular-nums leading-none text-center"
                  aria-label={`${stat.value.toLocaleString()}${stat.suffix}`}
                >
                  {count.toLocaleString()}{stat.suffix}
                </p>
              </div>
            ) : stat.microType === 'tests' ? (
              <div className="relative w-full h-[80px] flex items-center justify-center">
                <LayeredSheets accent={stat.accent} reduce={reduce} isTouch={isTouch} hovered={tilt.hovered} />
                <p
                  className="relative z-10 text-3xl font-black text-slate-900 tabular-nums leading-none bg-white/50 backdrop-blur-sm px-2 rounded"
                  aria-label={`${stat.value.toLocaleString()}${stat.suffix}`}
                >
                  {count.toLocaleString()}{stat.suffix}
                </p>
              </div>
            ) : (
              <p
                className="text-3xl md:text-4xl font-black text-slate-900 tabular-nums leading-none"
                aria-label={`${stat.value.toLocaleString()}${stat.suffix}`}
              >
                {count.toLocaleString()}{stat.suffix}
              </p>
            )}
          </div>

          {/* Label */}
          <p className="text-xs text-slate-500 font-semibold leading-tight text-center">{stat.label}</p>

          {/* Bottom visual — dot matrix crowd for users card */}
          {stat.microType === 'users' && (
            <div className="w-full mt-1" style={{ opacity: 0.9 }}>
              <DotMatrixCrowd accent={stat.accent} reduce={reduce} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══ StatsGrid: 4 cards with shared pointer spotlight ═══ */
function StatsGrid({ stats, reduce, isTouch }: { stats: StatItem[]; reduce: boolean; isTouch: boolean }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [spotX, setSpotX] = useState(50);
  const [spotY, setSpotY] = useState(50);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!gridRef.current || reduce || isTouch) return;
    const rect = gridRef.current.getBoundingClientRect();
    setSpotX(((e.clientX - rect.left) / rect.width) * 100);
    setSpotY(((e.clientY - rect.top) / rect.height) * 100);
  }, [reduce, isTouch]);

  return (
    <div ref={gridRef} onMouseMove={handleMouseMove} className="relative grid grid-cols-2 md:grid-cols-4 gap-4">
      {!isTouch && (
        <div
          className="absolute inset-0 pointer-events-none rounded-3xl transition-all duration-300"
          style={{ background: `radial-gradient(400px circle at ${spotX}% ${spotY}%, rgba(56,189,248,0.10), transparent 50%)` }}
        />
      )}
      {stats.map((s, i) => (
        <StatCard key={i} stat={s} index={i} reduce={reduce} isTouch={isTouch} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CTA BANNER — "Raised plate" + concentric target
   Sub-components: ConcentricTarget, CtaBanner
   No background shapes over text/button. Wave lines emanate from target only.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── ConcentricTarget: 4 disks at different Z layers, pointer tilt,
   arrow flies in on load and on button hover. Wave lines from center only. ── */
function ConcentricTarget({ reduce, isTouch, active }: { reduce: boolean; isTouch: boolean; active: boolean }) {
  const { ref, inView } = useInViewOnce('-40px');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [arrowIn, setArrowIn] = useState(false);

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setArrowIn(true); return; }
    const id = setTimeout(() => setArrowIn(true), 300);
    return () => clearTimeout(id);
  }, [inView, reduce]);

  useEffect(() => {
    if (!active || reduce) return;
    setArrowIn(false);
    const id = setTimeout(() => setArrowIn(true), 100);
    return () => clearTimeout(id);
  }, [active, reduce]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current || reduce || isTouch) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width - 0.5;
    const dy = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -dy * 12, y: dx * 12 });
  }, [ref, reduce, isTouch]);

  const handleMouseLeave = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  const [autoTilt, setAutoTilt] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (reduce || !isTouch) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      setAutoTilt({ x: Math.sin(t * 0.5) * 4, y: Math.cos(t * 0.4) * 4 });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, isTouch]);

  const effTilt = isTouch ? autoTilt : tilt;
  const disks = [
    { size: 124, z: 0, opacity: 0.2, duration: 6 },
    { size: 92, z: 14, opacity: 0.45, duration: 4.5 },
    { size: 60, z: 28, opacity: 0.75, duration: 3 },
    { size: 36, z: 42, opacity: 1, duration: 2 },
  ];

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-28 h-28 md:w-32 md:h-32 flex items-center justify-center shrink-0"
      style={{ perspective: '500px', transformStyle: 'preserve-3d' }}
      aria-hidden="true"
    >
      {/* Concentric wave lines — emanate from center, never cross text/button */}
      {!reduce && [0, 1, 2].map(i => (
        <motion.div
          key={`wave-${i}`}
          className="absolute rounded-full border pointer-events-none"
          style={{ borderColor: '#f59e0b' }}
          initial={{ width: 40, height: 40, opacity: 0.3 }}
          animate={{ width: [40, 150], height: [40, 150], opacity: [0.3, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: 'easeOut' }}
        />
      ))}

      {/* Concentric disks at different Z layers */}
      <div
        style={{
          transform: `rotateX(${effTilt.x}deg) rotateY(${effTilt.y}deg)`,
          transition: isTouch ? 'none' : 'transform 0.2s ease-out',
          transformStyle: 'preserve-3d',
        }}
        className="relative w-full h-full flex items-center justify-center"
      >
        {disks.map((d, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2"
            style={{
              borderColor: '#f59e0b',
              width: d.size,
              height: d.size,
              opacity: d.opacity,
              transform: `translateZ(${d.z}px)`,
              boxShadow: i === 3 ? '0 4px 20px rgba(245,158,11,0.3)' : 'none',
            }}
            animate={reduce ? {} : { scale: [1, 1.04, 1] }}
            transition={{ duration: d.duration, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
          />
        ))}

        {/* Center plate */}
        <div
          className="absolute rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg"
          style={{ width: 28, height: 28, transform: 'translateZ(48px)' }}
        >
          <Target className="h-4 w-4 text-white" />
        </div>

        {/* Arrow that flies in on load and on button hover */}
        <motion.div
          className="absolute"
          style={{ transform: 'translateZ(55px)' }}
          initial={reduce ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: -60, scale: 1.5 }}
          animate={arrowIn ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: -60, scale: 1.5 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
        >
          <div className="w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center">
            <ArrowRight className="h-3.5 w-3.5 text-amber-600" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── CtaBanner: raised 3D plate, sheen, target + magnetic button ── */
function CtaBanner({ reduce, isTouch, onCta }: { reduce: boolean; isTouch: boolean; onCta: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pressed, setPressed] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!btnRef.current || reduce || isTouch) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setOffset({ x: x * 0.1, y: y * 0.1 });
  };

  return (
    <motion.div
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
    >
      <div
        className="relative rounded-3xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 overflow-hidden"
        style={{
          boxShadow: '0 8px 32px rgba(245,158,11,0.15), 0 2px 8px rgba(245,158,11,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        {/* Diagonal sheen every ~6s */}
        {!reduce && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.4) 50%, transparent 65%)' }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 4.2, ease: 'easeInOut' }}
          />
        )}

        {/* Inner light edge */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }} />

        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5 relative z-10">
          {/* Left: target + text */}
          <div className="flex items-center gap-5">
            <ConcentricTarget reduce={reduce} isTouch={isTouch} active={btnHovered} />
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-900">Bilim darajangizni aniqlang</h2>
              <p className="text-sm text-slate-600 font-medium mt-0.5">Ro'yxatdan o'tib, shaxsiy o'quv rejangizni yarating</p>
            </div>
          </div>

          {/* Right: magnetic button */}
          <button
            ref={btnRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => { setOffset({ x: 0, y: 0 }); setPressed(false); setBtnHovered(false); }}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onClick={onCta}
            className="group flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm rounded-xl whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 transition-colors w-full md:w-auto justify-center"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${pressed ? 0.98 : 1})`,
              boxShadow: pressed ? '0 2px 8px rgba(245,158,11,0.3)' : '0 6px 20px rgba(245,158,11,0.35)',
              transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
            }}
          >
            Bepul boshlash
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
