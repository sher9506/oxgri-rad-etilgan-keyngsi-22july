import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale, ChevronRight, ChevronDown, X, LogIn, LogOut, User as UserIcon,
  Play, FileText, GraduationCap, Library, Newspaper, Layers,
  TrendingUp, HelpCircle, BookOpen, BookMarked, MessageCircle,
  ClipboardCheck, MoreHorizontal, Home, Globe,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang, Lang } from '@/contexts/LangContext';
import { lazy, Suspense } from 'react';

const NotificationBell = lazy(() => import('@/components/features/NotificationBell'));
const OquvchiBildirishnomaBell = lazy(() => import('@/components/features/OquvchiBildirishnomaBell'));

const EASE = [0.22, 1, 0.36, 1] as const;
const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface NavItem {
  id: string;
  label: string;
  icon: any;
  desc?: string;
  accent?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  mega?: boolean;
}

export function buildNavGroups(
  userRol: string | undefined,
  ustozBotRuxsat: boolean,
  blogHuquqi: boolean,
  ustozHuquqi: boolean,
): { main: NavItem[]; groups: NavGroup[]; kabinetGroup: NavGroup | null } {
  const isUstoz = userRol === 'ustoz';
  const isBlogOnly = isUstoz && blogHuquqi && !ustozHuquqi;
  const isUstozRestricted = isUstoz && ustozHuquqi && !blogHuquqi;

  const main: NavItem[] = isBlogOnly
    ? [{ id: 'blog', label: 'Blog', icon: Newspaper }]
    : [
        { id: 'kurslar', label: 'Kurslar', icon: BookMarked },
        { id: 'oqmatlar', label: "O'quv materiallari", icon: Library },
      ];

  const sinovGroup: NavGroup = {
    label: 'Sinov',
    mega: true,
    items: isBlogOnly
      ? []
      : [
          { id: 'sinov', label: "Sinovni boshlash", icon: Play, desc: "Kod bilan test yoki kazus boshlang", accent: true },
          { id: 'mavjud_testlar', label: 'Mavjud testlar', icon: FileText, desc: "Ommaviy testlar ro'yxati" },
          { id: 'mavjud_kazuslar', label: 'Mavjud kazuslar', icon: GraduationCap, desc: "Ommaviy kazuslar to'plami" },
          { id: 'moot_court', label: 'Moot Court', icon: Scale, desc: 'AI sudya bilan jonli bahs' },
        ],
  };

  const yanaGroup: NavGroup = {
    label: 'Yana',
    items: isBlogOnly
      ? [
          { id: 'yordam', label: 'Yordam', icon: HelpCircle, desc: 'Yordam markazi' },
        ]
      : [
          { id: 'savol_javob', label: 'Savol–javoblar', icon: Layers, desc: "Savollarga javoblar kutubxonasi" },
          { id: 'reyting', label: 'Reyting', icon: TrendingUp, desc: "O'quvchilar reytingi" },
          { id: 'blog', label: 'Blog', icon: Newspaper, desc: 'Yuridik maqolalar va tahlillar' },
          { id: 'yordam', label: 'Yordam', icon: HelpCircle, desc: 'Yordam markazi' },
        ],
  };

  const groups = isBlogOnly ? [yanaGroup] : [sinovGroup, yanaGroup];

  let kabinetGroup: NavGroup | null = null;
  if (isUstoz && isBlogOnly) {
    kabinetGroup = {
      label: 'Kabinetim',
      items: [{ id: 'blog_yozish', label: 'Blog yozish', icon: Newspaper, desc: 'Yangi maqola yozish' }],
    };
  } else if (isUstoz && !isBlogOnly) {
    const allItems: NavItem[] = [
        { id: 'ustoz', label: 'Kazus kabineti', icon: UserIcon, desc: "Kazuslar boshqaruvi" },
        { id: 'testlar', label: 'Test kabineti', icon: BookOpen, desc: 'Testlar boshqaruvi' },
        { id: 'oquvchilar', label: "O'quvchilarim", icon: GraduationCap, desc: "O'quvchilar ro'yxati" },
        { id: 'blog_yozish', label: 'Blog yozish', icon: Newspaper, desc: 'Yangi maqola yozish' },
    ];
    if (ustozBotRuxsat) {
      allItems.push({ id: 'bot_yangilik', label: 'Bot Yangilik', icon: MessageCircle, desc: 'Bot xabarnomasi' });
    }
    kabinetGroup = {
      label: 'Kabinetim',
      items: isUstozRestricted ? allItems.filter(i => i.id !== 'blog_yozish') : allItems,
    };
  }

  return { main, groups, kabinetGroup };
}

const LANG_OPTIONS: { code: Lang; flag: string; label: string }[] = [
  { code: 'uz', flag: '🇺🇿', label: "O'z" },
  { code: 'ru', flag: '🇷🇺', label: 'Ру' },
  { code: 'en', flag: '🇬🇧', label: 'En' },
];

/* ═══ Sinov guruhidagi tab id'lar ═══ */
const SINOV_TABS = ['sinov', 'mavjud_testlar', 'mavjud_kazuslar', 'moot_court'];
const YANA_TABS = ['savol_javob', 'reyting', 'blog', 'yordam'];

/* ═════════════════════════════════════════════════════════════════
   MobileSheet — bottom-sheet dialog
   ═════════════════════════════════════════════════════════════════ */
function MobileSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      triggerRef.current?.focus();
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: EASE }}
            className="fixed inset-0 z-[60] lg:hidden"
            style={{ background: 'rgba(13,27,66,.45)' }}
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: EASE }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => { if (info.offset.y > 80) onClose(); }}
            className="fixed left-0 right-0 bottom-0 z-[61] lg:hidden"
            style={{
              maxHeight: '78svh',
              background: 'var(--ff-card)',
              borderRadius: '28px 28px 0 0',
              boxShadow: '0 -8px 40px -12px rgba(13,27,66,.25)',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div className="flex flex-col items-center pt-3 pb-1 shrink-0" style={{ cursor: 'grab' }}>
              <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'var(--line)' }} />
            </div>
            <div className="flex items-center justify-between px-5 pb-2 shrink-0">
              <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>{title}</h2>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center ff-focus"
                style={{ color: 'var(--ink-muted)', background: 'var(--bg-2)' }}
                aria-label="Yopish"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ═══ SheetRow — 56px qator ikona plitkasi + nom + chevron ═══ */
function SheetRow({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const tileStyle: React.CSSProperties = item.id === 'moot_court'
    ? { background: 'linear-gradient(135deg, var(--navy-1), var(--navy-3))' }
    : item.accent
      ? { background: 'linear-gradient(135deg, var(--gold), var(--gold-deep))' }
      : isActive
        ? { background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))' }
        : { background: 'var(--cobalt-tint)' };

  const iconColor = (item.id === 'moot_court' || item.accent || isActive) ? '#fff' : 'var(--cobalt-2)';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 transition-all ff-focus"
      style={{ minHeight: 56, borderRadius: 16 }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={tileStyle}>
        <Icon className="h-[18px] w-[18px]" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>{item.label}</p>
        {item.desc && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--ink-muted)' }}>{item.desc}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--ink-muted)' }} />
    </button>
  );
}

function SheetSectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--ink-muted)' }}>{label}</span>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   MobileBottomNav — 5 tab suzuvchi shisha panel
   ═════════════════════════════════════════════════════════════════ */
function MobileBottomNav({
  activeTab,
  onTabChange,
  onOpenSinov,
  onOpenYana,
  hideNav,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSinov: () => void;
  onOpenYana: () => void;
  hideNav: boolean;
}) {
  const tabs = [
    { id: 'haqida', label: 'Bosh', icon: Home },
    { id: 'kurslar', label: 'Kurslar', icon: GraduationCap },
    { id: 'oqmatlar', label: 'Materiallar', icon: Library, shortLabel: 'Materiallar' },
  ];

  const isActive = (tabId: string) => {
    if (tabId === 'haqida') return activeTab === 'haqida';
    if (tabId === 'kurslar') return activeTab === 'kurslar';
    if (tabId === 'oqmatlar') return activeTab === 'oqmatlar';
    return false;
  };

  const isSinovActive = SINOV_TABS.includes(activeTab);
  const isYanaActive = YANA_TABS.includes(activeTab);

  const Cell = ({ tabId, label, icon: Icon, onClick, active, hasPopup }: {
    tabId: string; label: string; icon: any; onClick: () => void; active: boolean; hasPopup?: boolean;
  }) => (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-1 transition-all ff-focus"
      style={{ minHeight: 48, borderRadius: 12, touchAction: 'manipulation' }}
      aria-current={active ? 'page' : undefined}
      aria-haspopup={hasPopup ? 'dialog' : undefined}
      aria-expanded={hasPopup ? (tabId === 'sinov' ? isSinovActive : isYanaActive) : undefined}
      aria-label={label}
    >
      <div
        className="flex items-center justify-center transition-colors"
        style={{
          width: 40,
          height: 28,
          borderRadius: 9999,
          background: active ? 'var(--cobalt-tint)' : 'transparent',
        }}
      >
        <Icon
          className="h-[22px] w-[22px] transition-colors"
          style={{ color: active ? 'var(--cobalt-2)' : 'var(--ink-muted)' }}
        />
      </div>
      <span
        className="text-[11px] font-semibold leading-none transition-colors"
        style={{ color: active ? 'var(--cobalt-2)' : 'var(--ink-muted)' }}
      >
        {label}
      </span>
      {active && (
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gold)' }} />
      )}
    </button>
  );

  if (hideNav) return null;

  return (
    <nav
      aria-label="Asosiy navigatsiya"
      className="fixed left-3 right-3 z-50 lg:hidden"
      style={{
        bottom: 'calc(8px + env(safe-area-inset-bottom))',
        height: 64,
        borderRadius: 24,
        background: 'rgba(255,255,255,.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--line)',
        boxShadow: '0 18px 40px -18px rgba(13,27,66,.28), inset 0 1px 0 rgba(255,255,255,.9)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
      }}
    >
      <Cell tabId="haqida" label="Bosh" icon={Home} onClick={() => onTabChange('haqida')} active={isActive('haqida')} />
      <Cell tabId="kurslar" label="Kurslar" icon={GraduationCap} onClick={() => onTabChange('kurslar')} active={isActive('kurslar')} />
      <Cell tabId="oqmatlar" label="Materiallar" icon={Library} onClick={() => onTabChange('oqmatlar')} active={isActive('oqmatlar')} />
      <Cell tabId="sinov" label="Sinov" icon={ClipboardCheck} onClick={onOpenSinov} active={isSinovActive} hasPopup />
      <Cell tabId="yana" label="Yana" icon={MoreHorizontal} onClick={onOpenYana} active={isYanaActive} hasPopup />
    </nav>
  );
}

/* ═════════════════════════════════════════════════════════════════
   MobileTopBar — ixcham sticky header
   ═════════════════════════════════════════════════════════════════ */
function MobileTopBar({
  activeTab,
  onOpenLogin,
  onLogout,
  onOpenYana,
}: {
  activeTab: string;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenYana: () => void;
}) {
  const { user, isAuthenticated } = useAuth();

  const oquvchiStorageKey = user?.rol === 'oquvchi' ? `oquvchi_${user.ism}_${user.familiya}` : null;

  return (
    <header
      className="sticky top-0 z-40 lg:hidden"
      style={{
        height: 56,
        paddingTop: 'env(safe-area-inset-top)',
        background: 'rgba(255,255,255,.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div className="flex items-center justify-between h-full px-4">
        {/* Logo */}
        <button
          onClick={() => { /* tab haqida already handled by parent */ }}
          className="flex items-center gap-2"
          aria-label="FanFaster bosh sahifa"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))' }}>
            <Scale className="text-white" style={{ width: 16, height: 16 }} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold" style={{ color: 'var(--ink)', fontFamily: "'Source Serif 4 Variable', Georgia, serif" }}>FanFaster</span>
            <span className="text-[8px] font-semibold tracking-[0.22em] uppercase mt-0.5" style={{ color: 'var(--ink-muted)' }}>Platforma</span>
          </div>
        </button>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          {/* Notification */}
          {isAuthenticated && user?.rol === 'oquvchi' && oquvchiStorageKey ? (
            <Suspense fallback={null}>
              <OquvchiBildirishnomaBell oquvchiIsm={user.ism} oquvchiFamiliya={user.familiya} kurs={user.kurs} guruh={user.guruh} storageKey={oquvchiStorageKey} />
            </Suspense>
          ) : isAuthenticated && user?.rol === 'ustoz' ? (
            <Suspense fallback={null}><NotificationBell /></Suspense>
          ) : (
            <button className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ color: 'var(--ink-muted)' }} aria-label="Bildirishnomalar">
              <FileText className="h-5 w-5" />
            </button>
          )}

          {/* Login or Avatar */}
          {isAuthenticated && user ? (
            <button
              onClick={onOpenYana}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 ff-focus"
              style={{ background: 'var(--cobalt-tint)', border: '1px solid var(--cobalt-line)' }}
              aria-label="Profil va menyu"
            >
              <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--cobalt-2)' }}>{user.ism[0]}{user.familiya[0]}</span>
            </button>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-4 font-semibold text-sm text-white transition-all active:scale-95 ff-focus"
              style={{
                background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))',
                borderRadius: 14,
                height: 40,
                boxShadow: '0 8px 20px -8px rgba(29,78,216,.45)',
              }}
            >
              <LogIn className="h-3.5 w-3.5" />
              Kirish
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ═════════════════════════════════════════════════════════════════
   MobileNav — birlashtirgan komponent (TopBar + BottomNav + Sheets)
   ═════════════════════════════════════════════════════════════════ */
export interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string, subPath?: string) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  hideBottomNav?: boolean;
}

export default function MobileNav({ activeTab, onTabChange, onOpenLogin, onLogout, hideBottomNav = false }: MobileNavProps) {
  const { user } = useAuth();
  const { lang, setLang } = useLang();
  const [ustozBotRuxsat, setUstozBotRuxsat] = useState(false);
  const [sinovOpen, setSinovOpen] = useState(false);
  const [yanaOpen, setYanaOpen] = useState(false);
  const [hideNav, setHideNav] = useState(hideBottomNav);

  const { groups, kabinetGroup } = buildNavGroups(
    user?.rol, ustozBotRuxsat, user?.blog_huquqi, user?.ustoz_huquqi
  );

  // Ustoz bot ruxsatini tekshirish
  useEffect(() => {
    if (user?.rol !== 'ustoz' || !user?.ustoz_id) return;
    const ustozId = user.ustoz_id;
    const checkRuxsat = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: individual } = await supabase.from('settings').select('value').eq('key', `USTOZ_BOT_RUXSAT_${ustozId}`).maybeSingle();
        if (individual !== null && individual !== undefined) {
          setUstozBotRuxsat(individual?.value ?? false);
          return;
        }
        const { data: umumiy } = await supabase.from('settings').select('value').eq('key', 'USTOZ_BOT_YANGILIK_RUXSAT').maybeSingle();
        setUstozBotRuxsat(umumiy?.value ?? false);
      } catch { /* ignore */ }
    };
    checkRuxsat();
    const interval = setInterval(checkRuxsat, 30000);
    return () => clearInterval(interval);
  }, [user?.rol, user?.ustoz_id]);

  // Klaviatura ochilganda panel yashirin
  useEffect(() => {
    setHideNav(hideBottomNav);
  }, [hideBottomNav]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      const vh = window.visualViewport;
      if (vh && vh.height < window.innerHeight * 0.7) {
        setHideNav(true);
      } else if (!hideBottomNav) {
        setHideNav(false);
      }
    };
    window.visualViewport?.addEventListener('resize', onResize);
    return () => window.visualViewport?.removeEventListener('resize', onResize);
  }, [hideBottomNav]);

  const handleNavigate = useCallback((tab: string) => {
    onTabChange(tab);
    setSinovOpen(false);
    setYanaOpen(false);
  }, [onTabChange]);

  const sinovGroup = groups.find(g => g.label === 'Sinov');
  const yanaGroup = groups.find(g => g.label === 'Yana');

  return (
    <>
      {/* Mobile Top Bar — only show for non-ustoz/non-admin */}
      {!user?.rol || user.rol === 'oquvchi' ? (
        <MobileTopBar
          activeTab={activeTab}
          onOpenLogin={onOpenLogin}
          onLogout={onLogout}
          onOpenYana={() => setYanaOpen(true)}
        />
      ) : null}

      {/* Bottom Nav */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={handleNavigate}
        onOpenSinov={() => setSinovOpen(true)}
        onOpenYana={() => setYanaOpen(true)}
        hideNav={hideNav}
      />

      {/* Sinov Sheet */}
      <MobileSheet open={sinovOpen} onClose={() => setSinovOpen(false)} title="Sinov">
        {sinovGroup?.items.map(item => (
          <SheetRow
            key={item.id}
            item={item}
            isActive={activeTab === item.id}
            onClick={() => handleNavigate(item.id)}
          />
        )) ?? <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>Hozircha bo'limlar yo'q</p>}
      </MobileSheet>

      {/* Yana Sheet */}
      <MobileSheet open={yanaOpen} onClose={() => setYanaOpen(false)} title="Yana">
        {/* Profil bloki */}
        <div className="px-3 py-3 mb-1" style={{ background: 'var(--bg)', borderRadius: 16 }}>
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--cobalt-tint)', border: '1px solid var(--cobalt-line)' }}>
                <span className="text-xs font-bold uppercase" style={{ color: 'var(--cobalt-2)' }}>{user.ism[0]}{user.familiya[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>{user.ism} {user.familiya}</p>
                <p className="text-xs capitalize" style={{ color: 'var(--ink-muted)' }}>{user.rol === 'ustoz' ? 'Ustoz' : "O'quvchi"}{user.kurs ? ` • ${user.kurs}-kurs` : ''}</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { onOpenLogin(); setYanaOpen(false); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-semibold text-sm rounded-xl transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))', borderRadius: 14 }}
            >
              <LogIn className="h-4 w-4" /> Kirish
            </button>
          )}
        </div>

        {/* Profil amallari — faqat kirgan bo'lsa */}
        {user && (
          <>
            <SheetRow
              item={{ id: 'profil', label: 'Profilim', icon: UserIcon, desc: 'Profil ma\'lumotlari' }}
              isActive={activeTab === 'profil'}
              onClick={() => handleNavigate('profil')}
            />
            <button
              onClick={() => { onLogout(); setYanaOpen(false); }}
              className="w-full flex items-center gap-3 px-3 transition-all ff-focus"
              style={{ minHeight: 56, borderRadius: 16 }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,.1)' }}>
                <LogOut className="h-[18px] w-[18px]" style={{ color: '#ef4444' }} />
              </div>
              <span className="text-[15px] font-semibold" style={{ color: '#ef4444' }}>Chiqish</span>
            </button>
          </>
        )}

        {/* Yana guruh elementlari */}
        {yanaGroup && yanaGroup.items.length > 0 && (
          <>
            <SheetSectionLabel label="Bo'limlar" />
            {yanaGroup.items.map(item => (
              <SheetRow
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                onClick={() => handleNavigate(item.id)}
              />
            ))}
          </>
        )}

        {/* Kabinet guruh */}
        {kabinetGroup && kabinetGroup.items.length > 0 && (
          <>
            <SheetSectionLabel label="Kabinetim" />
            {kabinetGroup.items.map(item => (
              <SheetRow
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                onClick={() => handleNavigate(item.id)}
              />
            ))}
          </>
        )}

        {/* Til tanlagich */}
        <SheetSectionLabel label="Til" />
        <div className="flex gap-2 px-3 pb-2">
          {LANG_OPTIONS.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ff-focus"
              style={{
                background: lang === l.code ? 'var(--cobalt-tint)' : 'var(--bg)',
                color: lang === l.code ? 'var(--cobalt-2)' : 'var(--ink-body)',
                border: `1px solid ${lang === l.code ? 'var(--cobalt-line)' : 'var(--line)'}`,
                minHeight: 44,
              }}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      </MobileSheet>
    </>
  );
}
