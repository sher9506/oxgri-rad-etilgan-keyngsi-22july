import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Scale, ChevronDown, Menu, X, Bell, LogIn, LogOut, User as UserIcon,
  Play, FileText, GraduationCap, BookOpen, Library, Newspaper,
  Layers, TrendingUp, HelpCircle, UserCircle, BookMarked,
  MessageCircle, ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang, Lang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/contexts/NotificationContext';
import { lazy, Suspense } from 'react';

const NotificationBell = lazy(() => import('@/components/features/NotificationBell'));
const OquvchiBildirishnomaBell = lazy(() => import('@/components/features/OquvchiBildirishnomaBell'));
const MentorChatBot = lazy(() => import('@/components/features/MentorChatBot'));

interface TopNavProps {
  activeTab: string;
  onTabChange: (tab: string, subPath?: string) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

const LANG_OPTIONS: { code: Lang; flag: string; label: string }[] = [
  { code: 'uz', flag: '🇺🇿', label: "O'z" },
  { code: 'ru', flag: '🇷🇺', label: 'Ру' },
  { code: 'en', flag: '🇬🇧', label: 'En' },
];

interface NavItem {
  id: string;
  label: string;
  icon: any;
  desc?: string;
  accent?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  mega?: boolean;
}

function buildNavGroups(
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
      { id: 'ustoz', label: 'Kazus kabineti', icon: UserCircle, desc: "Kazuslar boshqaruvi" },
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

function LangSwitcher() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const current = LANG_OPTIONS.find(l => l.code === lang)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all ff-focus"
        style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-body)', background: 'var(--card)', border: '1px solid var(--line)' }}
        aria-label="Til tanlash"
      >
        <span>{current.flag}</span>
        <span>{current.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 bg-white rounded-xl shadow-xl z-50 border border-ff-line overflow-hidden min-w-[80px]">
            {LANG_OPTIONS.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold transition-all ${lang === l.code ? 'bg-ff-cobalt-tint text-ff-cobalt2' : 'hover:bg-ff-bg2 text-ff-ink-body'}`}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UstozBildirishnomaLoader({ ustozId }: { ustozId: string }) {
  const { addNotification, notifications } = useNotifications();
  const yuklangan = useRef<Set<string>>(new Set());

  useEffect(() => {
    notifications.forEach((n: any) => { if (n.id) yuklangan.current.add(n.id); });
  }, []);

  useEffect(() => {
    const yuklash = async () => {
      try {
        const { data, error } = await supabase
          .from('bildirishnomalar')
          .select('*')
          .eq('qabul_qiluvchi_tur', 'ustoz')
          .or(`qabul_qiluvchi_id.is.null,qabul_qiluvchi_id.eq.${ustozId}`)
          .order('created_at', { ascending: false })
          .limit(30);
        if (error || !data) return;
        data.forEach((b: any) => {
          if (!yuklangan.current.has(b.id)) {
            yuklangan.current.add(b.id);
            addNotification({
              type: b.tur === 'muhim' ? 'muhim' : b.tur === 'ogohlantirish' ? 'warning' : 'info',
              title: b.sarlavha,
              message: b.matn,
              data: { db_id: b.id },
            });
          }
        });
      } catch (e) {
        console.error('Ustoz bildirishnomalar xatosi:', e);
      }
    };
    yuklash();
    const interval = setInterval(yuklash, 8000);
    return () => clearInterval(interval);
  }, [ustozId, addNotification]);

  return null;
}

/* ── Dropdown panel with hover + click + keyboard support ── */
function NavDropdown({
  triggerLabel,
  items,
  mega,
  activeTab,
  onNavigate,
  closeMobile,
}: {
  triggerLabel: string;
  items: NavItem[];
  mega?: boolean;
  activeTab: string;
  onNavigate: (tab: string) => void;
  closeMobile?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const clearCloseTimer = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const scheduleClose = () => { clearCloseTimer(); closeTimer.current = setTimeout(() => { setOpen(false); setFocusedIndex(-1); }, 200); };

  const handleTriggerClick = () => {
    if (open) { setOpen(false); setFocusedIndex(-1); }
    else { setOpen(true); setFocusedIndex(0); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setFocusedIndex(-1); triggerRef.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) { setOpen(true); setFocusedIndex(0); } else { setFocusedIndex(i => Math.min(i + 1, items.length - 1)); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && focusedIndex >= 0 && open) { e.preventDefault(); const item = items[focusedIndex]; if (item) { onNavigate(item.id); setOpen(false); setFocusedIndex(-1); closeMobile?.(); } }
  };

  useEffect(() => () => clearCloseTimer(), []);

  if (items.length === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => { clearCloseTimer(); setOpen(true); }}
      onMouseLeave={scheduleClose}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        onClick={handleTriggerClick}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
          open ? 'text-ff-ink bg-ff-cobalt-tint' : 'text-ff-ink-body hover:text-ff-cobalt2 hover:bg-ff-cobalt-tint/60'
        }`}
      >
        {triggerLabel}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          className="absolute top-full left-0 mt-1 z-50"
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
          style={{ animation: 'ff-dropdown-in 180ms cubic-bezier(0.22,1,0.36,1) both' }}
        >
          {mega ? (
            <div className="grid grid-cols-2 gap-1 p-2 bg-white rounded-2xl shadow-xl border border-ff-line min-w-[440px]">
              {items.map((item, i) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    role="menuitem"
                    onClick={() => { onNavigate(item.id); setOpen(false); setFocusedIndex(-1); closeMobile?.(); }}
                    onMouseEnter={() => setFocusedIndex(i)}
                    className={`flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                      focusedIndex === i ? 'bg-ff-cobalt-tint/60' : ''
                    } ${item.accent ? 'ring-1 ring-ff-gold/30 bg-ff-gold-tint/40' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={item.accent ? { background: 'linear-gradient(135deg, var(--gold), #B8862E)', boxShadow: '0 4px 12px rgba(201,154,59,.2)' } : isActive ? { background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))', boxShadow: '0 4px 12px rgba(47,104,232,.2)' } : { background: 'var(--cobalt-tint)' }}>
                      <Icon className="h-4 w-4" style={{ color: item.accent || isActive ? '#fff' : 'var(--cobalt-2)' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold" style={{ color: item.accent ? 'var(--gold-ink)' : 'var(--ink)' }}>{item.label}</p>
                      {item.desc && <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--ink-muted)' }}>{item.desc}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 p-1.5 bg-white rounded-2xl shadow-xl border border-ff-line min-w-[220px]">
              {items.map((item, i) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    role="menuitem"
                    onClick={() => { onNavigate(item.id); setOpen(false); setFocusedIndex(-1); closeMobile?.(); }}
                    onMouseEnter={() => setFocusedIndex(i)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                      focusedIndex === i ? 'bg-ff-cobalt-tint/60' : ''
                    }`}
                  >
                    <Icon className="h-4 w-4" style={{ color: isActive ? 'var(--cobalt-2)' : 'var(--ink-muted)' }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: isActive ? 'var(--cobalt-2)' : 'var(--ink-body)' }}>{item.label}</p>
                      {item.desc && <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--ink-muted)' }}>{item.desc}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActiveUnderline({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
      style={{ background: 'var(--cobalt-2)' }}
    />
  );
}

export default function TopNav({ activeTab, onTabChange, onOpenLogin, onLogout }: TopNavProps) {
  const { user, isAuthenticated } = useAuth();
  const { t } = useLang();
  const [ustozBotRuxsat, setUstozBotRuxsat] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const { main, groups, kabinetGroup } = buildNavGroups(
    user?.rol, ustozBotRuxsat, user?.blog_huquqi, user?.ustoz_huquqi
  );

  useEffect(() => {
    if (user?.rol !== 'ustoz' || !user?.ustoz_id) return;
    const ustozId = user.ustoz_id;
    const checkRuxsat = async () => {
      const { data: individual } = await supabase.from('settings').select('value').eq('key', `USTOZ_BOT_RUXSAT_${ustozId}`).maybeSingle();
      if (individual !== null && individual !== undefined) {
        setUstozBotRuxsat(individual?.value ?? false);
        return;
      }
      const { data: umumiy } = await supabase.from('settings').select('value').eq('key', 'USTOZ_BOT_YANGILIK_RUXSAT').maybeSingle();
      setUstozBotRuxsat(umumiy?.value ?? false);
    };
    checkRuxsat();
    const interval = setInterval(checkRuxsat, 30000);
    return () => clearInterval(interval);
  }, [user?.rol, user?.ustoz_id]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavigate = useCallback((tab: string) => {
    onTabChange(tab);
    setIsMobileOpen(false);
  }, [onTabChange]);

  const oquvchiStorageKey = user?.rol === 'oquvchi' ? `oquvchi_${user.ism}_${user.familiya}` : null;

  const allNavItems: NavItem[] = [
    ...main,
    ...groups.flatMap(g => g.items),
    ...(kabinetGroup?.items || []),
  ];

  return (
    <>
      <style>{`
        @keyframes ff-dropdown-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes ff-dropdown-in { from { opacity: 0; } to { opacity: 1; } }
        }
      `}</style>

      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'border-b border-ff-line'
            : 'border-b border-ff-line/60'
        }`}
        style={{
          height: 72,
          background: 'rgba(255,255,255,.78)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="mx-auto flex items-center justify-between h-full" style={{ maxWidth: 1360, padding: '0 32px' }}>
          {/* ── LEFT: Logo + Nav ── */}
          <div className="flex items-center gap-6 min-w-0">
            {/* Logo */}
            <button
              onClick={() => handleNavigate('haqida')}
              className="flex items-center gap-2.5 shrink-0 group"
              aria-label="FanFaster bosh sahifa"
            >
              <div className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105" style={{ background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))', boxShadow: '0 4px 12px rgba(47,104,232,.25)' }}>
                <Scale className="text-white" style={{ width: 18, height: 18 }} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-base font-bold tracking-tight" style={{ color: 'var(--ink)', fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', 'Iowan Old Style', Georgia, serif" }}>FanFaster</span>
                <span className="text-[10px] font-semibold tracking-[0.22em] uppercase mt-0.5" style={{ color: 'var(--ink-muted)' }}>Platforma</span>
              </div>
            </button>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1" aria-label="Asosiy navigatsiya">
              {main.map(item => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <div key={item.id} className="relative">
                    <button
                      onClick={() => handleNavigate(item.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all relative ${
                        isActive ? 'text-ff-cobalt2' : 'text-ff-ink-body hover:text-ff-cobalt2 hover:bg-ff-cobalt-tint/60'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                      <ActiveUnderline show={isActive} />
                    </button>
                  </div>
                );
              })}

              {groups.map(group => (
                <div key={group.label} className="relative">
                  <NavDropdown
                    triggerLabel={group.label}
                    items={group.items}
                    mega={group.mega}
                    activeTab={activeTab}
                    onNavigate={handleNavigate}
                  />
                  <ActiveUnderline show={group.items.some(i => i.id === activeTab)} />
                </div>
              ))}

              {kabinetGroup && (
                <div className="relative">
                  <NavDropdown
                    triggerLabel={kabinetGroup.label}
                    items={kabinetGroup.items}
                    activeTab={activeTab}
                    onNavigate={handleNavigate}
                  />
                  <ActiveUnderline show={kabinetGroup.items.some(i => i.id === activeTab)} />
                </div>
              )}
            </nav>
          </div>

          {/* ── RIGHT cluster ── */}
          <div className="flex items-center gap-2 shrink-0">
            {/* AI Mentor — MentorChatBot renders its own floating button */}

            {/* Notification bell — only for authenticated */}
            {isAuthenticated && user?.rol === 'oquvchi' && oquvchiStorageKey ? (
              <Suspense fallback={null}>
                <OquvchiBildirishnomaBell oquvchiIsm={user.ism} oquvchiFamiliya={user.familiya} kurs={user.kurs} guruh={user.guruh} storageKey={oquvchiStorageKey} />
              </Suspense>
            ) : isAuthenticated && user?.rol === 'ustoz' ? (
              <>
                <UstozBildirishnomaLoader ustozId={user.ustoz_id!} />
                <Suspense fallback={null}><NotificationBell /></Suspense>
              </>
            ) : (
              <button className="p-1.5 transition-all" style={{ color: 'var(--ink-muted)' }} aria-label="Bildirishnomalar">
                <Bell className="h-4 w-4" />
              </button>
            )}

            <LangSwitcher />

            {/* Divider */}
            <div className="w-px h-5 mx-0.5 hidden sm:block" style={{ background: 'var(--line)' }} />

            {/* Profile or Login */}
            {isAuthenticated && user ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-1.5 pl-1.5 pr-0.5 py-0.5 rounded-full transition-all"
                  style={{ }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  aria-label="Profil menyusi"
                  aria-expanded={showProfileDropdown}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--cobalt-tint)', border: '1px solid var(--cobalt-line)' }}>
                    <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--cobalt-2)' }}>{user.ism[0]}{user.familiya[0]}</span>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} style={{ color: 'var(--ink-muted)' }} />
                </button>
                {showProfileDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileDropdown(false)} />
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-2xl z-50 border border-ff-line overflow-hidden" style={{ animation: 'ff-dropdown-in 180ms cubic-bezier(0.22,1,0.36,1) both' }}>
                      <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}>
                        <p className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>{user.ism} {user.familiya}</p>
                        <p className="text-[10px] font-medium capitalize" style={{ color: 'var(--ink-muted)' }}>{user.rol === 'ustoz' ? 'Ustoz' : "O'quvchi"}{user.kurs ? ` • ${user.kurs}-kurs` : ''}</p>
                      </div>
                      <div className="p-1">
                        <button
                          onClick={() => { handleNavigate('profil'); setShowProfileDropdown(false); }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-xs font-semibold"
                          style={{ color: 'var(--ink-body)' }}
                        >
                          <UserIcon className="h-3.5 w-3.5" /> {t('header.my_profile')}
                        </button>
                        <button
                          onClick={() => { onLogout(); setShowProfileDropdown(false); }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all text-xs font-bold"
                        >
                          <LogOut className="h-3.5 w-3.5" /> {t('header.logout')}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-4 py-2 text-white font-semibold text-sm transition-all active:scale-95 ff-focus"
                style={{
                  background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))',
                  borderRadius: 16,
                  boxShadow: '0 8px 20px -8px rgba(29,78,216,.45)',
                }}
              >
                <LogIn className="h-3.5 w-3.5" />
                {t('header.login')}
              </button>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg transition-all ff-focus"
              style={{ color: 'var(--ink-body)' }}
              aria-label="Menyuni ochish"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(13,27,66,.35)' }} onClick={() => setIsMobileOpen(false)} />
          <div
            className="absolute left-0 top-0 h-full w-[300px] bg-white shadow-2xl flex flex-col"
            style={{ animation: 'ff-slide-in-left 250ms cubic-bezier(0.22,1,0.36,1) both' }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))' }}>
                  <Scale className="text-white" style={{ width: 18, height: 18 }} />
                </div>
                <span className="text-base font-bold" style={{ color: 'var(--ink)', fontFamily: "'Source Serif 4 Variable', 'Source Serif 4', 'Iowan Old Style', Georgia, serif" }}>FanFaster</span>
              </div>
              <button onClick={() => setIsMobileOpen(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--ink-muted)' }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer nav */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Mobil navigatsiya">
              {allNavItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? item.accent
                          ? 'text-white shadow-md'
                          : ''
                        : 'hover:bg-ff-bg2'
                    }`}
                    style={isActive && !item.accent ? { background: 'var(--cobalt-tint)', color: 'var(--cobalt-2)' } : isActive && item.accent ? { background: 'linear-gradient(135deg, var(--gold), #B8862E)' } : { color: 'var(--ink-body)' }}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                    {item.accent && <ArrowRight className="h-3.5 w-3.5 ml-auto" />}
                  </button>
                );
              })}
            </nav>

            {/* Drawer footer */}
            <div className="p-3 border-t" style={{ borderColor: 'var(--line)' }}>
              <button
                onClick={() => { onOpenLogin(); setIsMobileOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold"
              >
                <LogIn className="h-4 w-4" /> {t('header.login')}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes ff-slide-in-left {
              from { transform: translateX(-100%); }
              to   { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}

      {/* MentorChatBot — hidden mount, opens via event */}
      <Suspense fallback={null}>
        <MentorChatBot
          activeTab={activeTab}
          onNavigate={(tab, extra) => {
            onTabChange(tab);
            if (extra?.kod && tab === 'sinov') {
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('auto-start-kod', { detail: { kod: extra.kod } }));
              }, 500);
            }
            if (extra?.materialId && tab === 'oqmatlar') {
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('auto-open-material', { detail: { materialId: extra.materialId } }));
              }, 500);
            }
            if (extra?.bolimId && tab === 'oqmatlar') {
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('deeplink-oqmat', { detail: { subPath: `${extra.bolimId}${extra.bobId ? '/' + extra.bobId : ''}${extra.materialId ? '/' + extra.materialId : ''}` } }));
              }, 500);
            }
          }}
        />
      </Suspense>
    </>
  );
}
