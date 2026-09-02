
import { useState, useEffect } from 'react';
import {
  Play, TrendingUp, UserCircle, ChevronLeft, ChevronRight,
  Scale, Users, Shield, Database, Bell, Search, BookOpen,
  ScanFace, X, User as UserIcon, FileText, GraduationCap,
  Layers, Send, Library, ShieldAlert, ShieldCheck, MessageCircle,
  Edit, Lock, Info, Bot, Megaphone, HelpCircle, BarChart2, Brain,
  BookMarked, ChevronDown, Settings, LayoutDashboard, Zap, Trophy
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin?: boolean;
  adminView?: string;
  onAdminViewChange?: (view: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

// ── Admin guruhlar ────────────────────────────────────────────────────────────
const ADMIN_GROUPS = [
  {
    id: 'boshqaruv',
    label: 'Boshqaruv',
    icon: LayoutDashboard,
    color: 'text-blue-400',
    items: [
      { id: 'analitika', label: 'Analitika', icon: BarChart2 },
      { id: 'ustoz', label: 'Ustozlar', icon: Users },
      { id: 'barcha_testlar', label: 'Barcha testlar', icon: BookOpen },
      { id: 'materiallar', label: "O'quv materiallari", icon: Library },
      { id: 'natija', label: 'Natijalar', icon: Search },
    ],
  },
  {
    id: 'xavfsizlik',
    label: 'Xavfsizlik',
    icon: ShieldCheck,
    color: 'text-red-400',
    items: [
      { id: 'asosiy_sozlamalar', label: 'Himoya tizimi', icon: ShieldCheck },
      { id: 'tahrirlashlar', label: "Tahrir so'rovlari", icon: Edit },
      { id: 'fraud', label: 'Fraud nazorat', icon: ShieldAlert },
      { id: 'faceid', label: 'Face ID Panel', icon: ScanFace },
    ],
  },
  {
    id: 'muloqot',
    label: 'Muloqot',
    icon: MessageCircle,
    color: 'text-green-400',
    items: [
      { id: 'chat_admin', label: 'Chat boshqaruv', icon: MessageCircle },
      { id: 'bildirishnoma', label: 'Xabarnoma', icon: Bell },
      { id: 'zahira', label: 'Zahira (Backup)', icon: Database },
      { id: 'yordam_admin', label: 'Yordam xabarlari', icon: HelpCircle },
    ],
  },
  {
    id: 'botai',
    label: 'Bot / AI',
    icon: Bot,
    color: 'text-purple-400',
    items: [
      { id: 'bot_sozlamalari', label: "O'quvchi Bot", icon: Bot },
      { id: 'ustoz_bot_sozlamalari', label: 'Ustoz Boti', icon: Users },
      { id: 'bot_xabarnoma', label: 'Bot Xabarnomasi', icon: Megaphone },
      { id: 'bot_ustoz_ruxsat', label: 'Ustoz Bot Ruxsati', icon: Shield },
      { id: 'tg_login_bot', label: 'Telegram Login Bot', icon: Bot },
      { id: 'ai_mentor', label: 'AI Mentor', icon: Brain },
      { id: 'chunking', label: 'Chunking (AI Index)', icon: Database },
      { id: 'sozlamalar', label: 'Maxfiy sozlamalar', icon: Lock },
    ],
  },
];

// ── Normal/Ustoz menyu seksiyalari ────────────────────────────────────────────
function buildSections(userRol: string | undefined, ustozBotRuxsat: boolean, t: (k: string) => string) {
  const isUstoz = userRol === 'ustoz';

  const oqishItems = [
    { id: 'kurslar', label: t('nav.kurslar'), icon: BookMarked },
    { id: 'oqmatlar', label: t('nav.oqmatlar'), icon: Library },
    { id: 'savol_javob', label: t('nav.savol_javob'), icon: Layers },
  ];

  const sinovItems = [
    { id: 'sinov', label: t('nav.bilim_olish'), icon: Play, accent: true },
    { id: 'mavjud_testlar', label: t('nav.mavjud_testlar'), icon: FileText },
    { id: 'mavjud_kazuslar', label: t('nav.mavjud_kazuslar'), icon: GraduationCap },
  ];

  const bottomItems = [
    { id: 'natijalar', label: t('nav.natijalar'), icon: TrendingUp },
    { id: 'profil', label: t('nav.profil'), icon: UserIcon },
    { id: 'haqida', label: t('nav.haqida'), icon: Info },
    { id: 'yordam', label: t('nav.yordam'), icon: HelpCircle },
  ];

  const kabinetItems = isUstoz ? [
    { id: 'ustoz', label: 'Kazus kabineti', icon: UserCircle },
    { id: 'testlar', label: 'Test kabineti', icon: BookOpen },
    { id: 'oquvchilar', label: "O'quvchilarim", icon: GraduationCap },
    ...(ustozBotRuxsat ? [{ id: 'bot_yangilik', label: 'Bot Yangilik', icon: Megaphone }] : []),
  ] : [];

  return { oqishItems, sinovItems, bottomItems, kabinetItems };
}

export default function Sidebar({
  activeTab, onTabChange,
  isAdmin = false, adminView = 'ustoz', onAdminViewChange,
  isOpen = false, onClose
}: SidebarProps) {
  const [ustozBotRuxsat, setUstozBotRuxsat] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Boshlang'ich holat: haqida tabida ochiq, boshqalarida yig'ilgan
    return activeTab !== 'haqida';
  });
  // Admin accordion guruhlar holati
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // Joriy adminView qaysi guruhga tegishli ekanligini topish
    const found = ADMIN_GROUPS.find(g => g.items.some(i => i.id === adminView));
    return new Set(found ? [found.id] : ['boshqaruv']);
  });

  const { user } = useAuth();
  const { t } = useLang();

  // ── Ustoz bot ruxsatini tekshirish ──────────────────────────────────────────
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

  // ── Tab o'zgarganda sidebar holati ─────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'haqida') {
      setIsCollapsed(false);
    } else {
      setIsCollapsed(true);
    }
  }, [activeTab]);

  // ── Admin guruhni avtomatik ochish ─────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    const found = ADMIN_GROUPS.find(g => g.items.some(i => i.id === adminView));
    if (found && !openGroups.has(found.id)) {
      setOpenGroups(prev => new Set([...prev, found.id]));
    }
  }, [adminView, isAdmin]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const n = new Set(prev);
      n.has(groupId) ? n.delete(groupId) : n.add(groupId);
      return n;
    });
  };

  const handleItemClick = (tab: string) => {
    onTabChange(tab);
    onClose?.(); // Mobilda yopish
    // Desktop: haqida bo'lmasa collapse qilish
    if (tab !== 'haqida') {
      setIsCollapsed(true);
    }
  };

  const handleAdminItemClick = (viewId: string) => {
    onAdminViewChange?.(viewId);
    onTabChange('admin');
    onClose?.();
    setIsCollapsed(true);
  };

  const { oqishItems, sinovItems, bottomItems, kabinetItems } = buildSections(
    user?.rol, ustozBotRuxsat, t
  );

  // ── Menu item renderer ──────────────────────────────────────────────────────
  const MenuItem = ({
    item,
    isActive,
    onClick,
    accent = false,
  }: {
    item: { id: string; label: string; icon: any };
    isActive: boolean;
    onClick: () => void;
    accent?: boolean;
  }) => {
    const Icon = item.icon;
    return (
      <button
        onClick={onClick}
        title={isCollapsed ? item.label : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all group ${
          isActive
            ? accent
              ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-900/30'
              : 'bg-white/10 text-white font-bold'
            : accent
              ? 'text-blue-300 hover:bg-blue-600/20 hover:text-blue-200'
              : 'text-gray-400 hover:bg-white/5 hover:text-white'
        } ${isCollapsed ? 'justify-center px-2' : ''}`}
      >
        <Icon className={`flex-shrink-0 transition-transform ${isActive && accent ? 'scale-110' : ''} ${isCollapsed ? 'h-5 w-5' : 'h-4 w-4'}`} />
        {!isCollapsed && (
          <span className={`text-xs font-semibold truncate ${accent ? 'font-bold' : ''}`}>
            {item.label}
          </span>
        )}
        {/* Accent item active indicator */}
        {isCollapsed && isActive && (
          <span className="absolute right-1 w-1 h-4 bg-blue-400 rounded-full" />
        )}
      </button>
    );
  };

  // ── Section label ──────────────────────────────────────────────────────────
  const SectionLabel = ({ label }: { label: string }) => {
    if (isCollapsed) return <div className="h-px bg-white/5 my-2 mx-2" />;
    return (
      <div className="px-3 pt-3 pb-1">
        <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">{label}</span>
      </div>
    );
  };

  // ── Sidebar content ────────────────────────────────────────────────────────
  const sidebarContent = (
    <div
      className={`h-full bg-[#121212] text-white flex flex-col shadow-2xl transition-all duration-300 ${
        isCollapsed ? 'w-14' : 'w-52'
      }`}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className="relative border-b border-white/5">
        <div className={`flex items-center gap-3 p-4 overflow-hidden ${isCollapsed ? 'justify-center p-3' : ''}`}>
          <div className="relative flex-shrink-0 rounded-xl bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] shadow-[0_0_15px_rgba(30,58,138,0.5)] border border-white/20 p-2 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent rounded-xl" />
            <Scale className="h-5 w-5 text-slate-200 relative z-10" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <h1 className="text-base font-black tracking-tighter leading-none flex flex-col">
                <span className="text-slate-100">Fan</span>
                <span className="text-slate-300 font-bold -mt-0.5 text-sm">Faster</span>
              </h1>
              <div className="flex items-center gap-1 mt-1 opacity-70">
                <span className="text-[8px] text-slate-400 font-black tracking-[0.3em] uppercase">Platforma</span>
                <Send className="h-2 w-2 text-slate-400 rotate-45 fill-current" />
              </div>
            </div>
          )}
          {/* Mobile close */}
          <button onClick={onClose} className="md:hidden absolute top-2 right-2 p-1 text-gray-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* ── Toggle tugmasi — Logo ostida ── */}
        <div className={`flex ${isCollapsed ? 'justify-center' : 'justify-end'} px-2 pb-2`}>
          <button
            onClick={() => setIsCollapsed(v => !v)}
            title={isCollapsed ? "Kengaytirish" : "Yig'ish"}
            className="flex items-center justify-center w-8 h-8 rounded-xl transition-all hover:bg-white/10 text-gray-500 hover:text-white bg-white/5 border border-white/10"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 custom-scrollbar">
        {isAdmin ? (
          /* ── ADMIN ACCORDION ─────────────────────────────────────────── */
          <div className="px-1.5 space-y-0.5">
            {!isCollapsed && (
              <div className="px-2 py-1.5 mb-1">
                <span className="text-[9px] font-black text-red-500 uppercase tracking-[0.2em]">Admin boshqaruvi</span>
              </div>
            )}
            {ADMIN_GROUPS.map((group) => {
              const GroupIcon = group.icon;
              const isGroupOpen = openGroups.has(group.id);
              const isGroupActive = group.items.some(i => i.id === adminView);

              return (
                <div key={group.id}>
                  {/* Group header */}
                  <button
                    onClick={() => !isCollapsed && toggleGroup(group.id)}
                    title={isCollapsed ? group.label : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all ${
                      isGroupActive
                        ? 'bg-white/10 text-white'
                        : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                  >
                    <GroupIcon className={`flex-shrink-0 h-4 w-4 ${group.color} ${isCollapsed ? 'h-5 w-5' : ''}`} />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-left text-xs font-bold">{group.label}</span>
                        <ChevronDown className={`h-3 w-3 text-gray-600 transition-transform ${isGroupOpen ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </button>

                  {/* Group items */}
                  {(isGroupOpen || isCollapsed) && (
                    <div className={`space-y-0.5 ${!isCollapsed ? 'ml-3 mt-0.5 pl-2 border-l border-white/5' : ''}`}>
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = adminView === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleAdminItemClick(item.id)}
                            title={isCollapsed ? item.label : undefined}
                            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all ${
                              isActive
                                ? 'bg-red-600 text-white font-bold'
                                : 'text-gray-500 hover:bg-white/5 hover:text-white'
                            } ${isCollapsed ? 'justify-center px-2' : ''}`}
                          >
                            <ItemIcon className={`flex-shrink-0 ${isCollapsed ? 'h-4 w-4' : 'h-3.5 w-3.5'}`} />
                            {!isCollapsed && (
                              <span className="text-[11px] font-semibold truncate">{item.label}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── NORMAL / USTOZ MENYU ─────────────────────────────────────── */
          <div className="px-1.5 space-y-0.5">
            {/* O'QISH sektsiyasi */}
            <SectionLabel label="O'QISH" />
            {oqishItems.map(item => (
              <MenuItem
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                onClick={() => handleItemClick(item.id)}
              />
            ))}

            {/* SINOV sektsiyasi */}
            <SectionLabel label="SINOV" />
            {sinovItems.map(item => (
              <MenuItem
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                onClick={() => handleItemClick(item.id)}
                accent={item.id === 'sinov'}
              />
            ))}

            {/* Ustoz kabineti */}
            {kabinetItems.length > 0 && (
              <>
                <SectionLabel label="KABINETIM" />
                {kabinetItems.map(item => (
                  <MenuItem
                    key={item.id}
                    item={item}
                    isActive={activeTab === item.id}
                    onClick={() => handleItemClick(item.id)}
                  />
                ))}
              </>
            )}

            {/* Pastki elementlar */}
            <div className={`${isCollapsed ? 'mt-2' : 'mt-2'} border-t border-white/5 pt-2`}>
              {bottomItems.map(item => (
                <MenuItem
                  key={item.id}
                  item={item}
                  isActive={activeTab === item.id}
                  onClick={() => handleItemClick(item.id)}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className={`border-t border-white/5 p-2 flex ${isCollapsed ? 'justify-center' : 'justify-center items-center'}`}>
        <div className="bg-white/5 rounded-full px-3 py-1.5">
          <p className="text-[9px] text-gray-600 font-black uppercase tracking-[2px]">v 1.0</p>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  );

  return (
    <>
      {/* ── DESKTOP ─────────────────────────────────────────────────────── */}
      <div className="hidden md:block h-screen sticky top-0 flex-shrink-0">
        {sidebarContent}
      </div>

      {/* ── MOBILE DRAWER ────────────────────────────────────────────────── */}
      <div className={`md:hidden fixed inset-0 z-50 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className={`absolute left-0 top-0 h-full transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Mobile da har doim kengaytirilgan ko'rinish */}
          <div className="h-full w-52 bg-[#121212] text-white flex flex-col shadow-2xl">
            {/* Logo mobile */}
            <div className="border-b border-white/5">
              <div className="p-4 flex items-center gap-3">
                <div className="relative flex-shrink-0 rounded-xl bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] border border-white/20 p-2">
                  <Scale className="h-5 w-5 text-slate-200 relative z-10" />
                </div>
                <div className="flex flex-col flex-1">
                  <h1 className="text-base font-black text-slate-100 leading-none">
                    FanFaster
                  </h1>
                  <span className="text-[8px] text-slate-400 font-black tracking-[0.3em] uppercase mt-1">Platforma</span>
                </div>
                <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-2 px-1.5 custom-scrollbar space-y-0.5">
              {isAdmin ? (
                ADMIN_GROUPS.map(group => {
                  const GroupIcon = group.icon;
                  const isGroupOpen = openGroups.has(group.id);
                  return (
                    <div key={group.id}>
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all text-gray-400 hover:bg-white/5 hover:text-white`}
                      >
                        <GroupIcon className={`h-4 w-4 ${group.color} flex-shrink-0`} />
                        <span className="flex-1 text-left text-xs font-bold">{group.label}</span>
                        <ChevronDown className={`h-3 w-3 transition-transform ${isGroupOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isGroupOpen && (
                        <div className="ml-3 pl-2 border-l border-white/5 space-y-0.5">
                          {group.items.map(item => {
                            const ItemIcon = item.icon;
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleAdminItemClick(item.id)}
                                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all ${
                                  adminView === item.id
                                    ? 'bg-red-600 text-white font-bold'
                                    : 'text-gray-500 hover:bg-white/5 hover:text-white'
                                }`}
                              >
                                <ItemIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="text-[11px] font-semibold">{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <>
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">O'QISH</span>
                  </div>
                  {oqishItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <button key={item.id} onClick={() => handleItemClick(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                          activeTab === item.id ? 'bg-white/10 text-white font-bold' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                        }`}>
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs font-semibold">{item.label}</span>
                      </button>
                    );
                  })}

                  <div className="px-3 pt-3 pb-1">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">SINOV</span>
                  </div>
                  {sinovItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <button key={item.id} onClick={() => handleItemClick(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                          activeTab === item.id
                            ? item.id === 'sinov' ? 'bg-blue-600 text-white font-bold' : 'bg-white/10 text-white font-bold'
                            : item.id === 'sinov' ? 'text-blue-300 hover:bg-blue-600/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                        }`}>
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs font-semibold">{item.label}</span>
                      </button>
                    );
                  })}

                  {kabinetItems.length > 0 && (
                    <>
                      <div className="px-3 pt-3 pb-1">
                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">KABINETIM</span>
                      </div>
                      {kabinetItems.map(item => {
                        const Icon = item.icon;
                        return (
                          <button key={item.id} onClick={() => handleItemClick(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                              activeTab === item.id ? 'bg-white/10 text-white font-bold' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                            }`}>
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            <span className="text-xs font-semibold">{item.label}</span>
                          </button>
                        );
                      })}
                    </>
                  )}

                  <div className="border-t border-white/5 pt-2 mt-2 space-y-0.5">
                    {bottomItems.map(item => {
                      const Icon = item.icon;
                      return (
                        <button key={item.id} onClick={() => handleItemClick(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                            activeTab === item.id ? 'bg-white/10 text-white font-bold' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`}>
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="text-xs font-semibold">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </nav>

            <div className="border-t border-white/5 p-3">
              <p className="text-[9px] text-gray-600 font-black uppercase tracking-[2px] text-center">v 1.0</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
