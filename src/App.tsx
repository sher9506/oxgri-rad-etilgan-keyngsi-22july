
import { useState, useEffect, useRef, createContext, useContext, useMemo, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import TelegramCallback from '@/pages/TelegramCallback';
import { AnimatePresence, motion } from 'framer-motion';
import { LogIn, LogOut, User as UserIcon, ChevronDown, Menu, Bell } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import Sidebar from '@/components/layout/Sidebar';
import LoginModal from '@/components/features/LoginModal';
import SinovBoshlash from '@/components/features/SinovBoshlash';
import RealVaqtNatijalar from '@/components/features/RealVaqtNatijalar';
import MavjudTestlar from '@/components/features/MavjudTestlar';
import MavjudKazuslar from '@/components/features/MavjudKazuslar';
const KurslarOquvchi = lazy(() => import('@/components/features/KurslarOquvchi'));
const KurslarUstoz = lazy(() => import('@/components/features/KurslarUstoz'));
const UstozKabineti = lazy(() => import('@/components/features/UstozKabineti'));
const TalabalarRoyhat = lazy(() => import('@/components/features/TalabalarRoyhat'));
const OquvchilarRoyhat = lazy(() => import('@/components/features/OquvchilarRoyhat'));
const FaceIdPanel = lazy(() => import('@/components/features/FaceIdPanel'));
const AdminPanel = lazy(() => import('@/components/features/AdminPanel'));
const TestlarKabineti = lazy(() => import('@/components/features/TestlarKabineti'));
const BotXabarnomasi = lazy(() => import('@/components/features/BotXabarnomasi'));
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';
import { LangProvider, useLang, Lang } from '@/contexts/LangContext';
import OquvchiBildirishnomaBell from '@/components/features/OquvchiBildirishnomaBell';
import SaytHaqida from '@/components/features/SaytHaqida';
const ProfilSahifa = lazy(() => import('@/components/features/ProfilSahifa'));
const SavolJavobUstoz = lazy(() => import('@/components/features/SavolJavobUstoz'));
const SavolJavobOquvchi = lazy(() => import('@/components/features/SavolJavobOquvchi'));
const OquvMateriallarOquvchi = lazy(() => import('@/components/features/OquvMateriallarOquvchi'));
const OquvMateriallarUstoz = lazy(() => import('@/components/features/OquvMateriallarUstoz'));
import { supabase } from '@/lib/supabase';
import {
  parseDeepLink,
  setupPostMessageListener,
  postRouteChange,
  getCurrentCleanPath,
  TAB_PATHS,
} from '@/lib/deepLink';
import NotificationBell from '@/components/features/NotificationBell';
const ReytingSahifa = lazy(() => import('@/components/features/ReytingSahifa'));
const YordamSahifa = lazy(() => import('@/components/features/YordamSahifa'));
const MentorChatBot = lazy(() => import('@/components/features/MentorChatBot'));
const SmartTalim = lazy(() => import('@/components/features/SmartTalim'));
const AdminChunking = lazy(() => import('@/components/features/AdminChunking'));
const BlogList = lazy(() => import('@/components/features/BlogList'));
const BlogYozish = lazy(() => import('@/components/features/BlogYozish'));
const BlogPostDetail = lazy(() => import('@/components/features/BlogPostDetail'));
const BlogMuallif = lazy(() => import('@/components/features/BlogMuallif'));

// Admin Context
interface AdminContextType {
  isAdmin: boolean;
  adminView: string;
  loginAdmin: () => void;
  logoutAdmin: () => void;
  setAdminView: (view: string) => void;
}

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  adminView: 'ustoz',
  loginAdmin: () => {},
  logoutAdmin: () => {},
  setAdminView: () => {},
});

export function useAdmin() {
  return useContext(AdminContext);
}

// Language flags
const LANG_OPTIONS: { code: Lang; flag: string; label: string }[] = [
  { code: 'uz', flag: '🇺🇿', label: "O'z" },
  { code: 'ru', flag: '🇷🇺', label: 'Ру' },
  { code: 'en', flag: '🇬🇧', label: 'En' },
];

function LangSwitcher() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const current = LANG_OPTIONS.find(l => l.code === lang)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition-all text-gray-600 border border-gray-200"
        style={{ fontSize: 11, fontWeight: 700 }}
      >
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 bg-white rounded-xl shadow-xl z-50 border border-gray-100 overflow-hidden min-w-[80px]">
            {LANG_OPTIONS.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold transition-all ${lang === l.code ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
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
    notifications.forEach(n => {
      if (n.id) yuklangan.current.add(n.id);
    });
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

function AppContent() {
  // Deep-link: ilk yuklashda URL dan tabni o'qish
  const getInitialTab = () => {
    const deepLink = parseDeepLink();
    if (deepLink) return deepLink.activeTab;
    return 'haqida';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);
  // Deep-link subPath (material/test/keys ID)
  const [pendingDeepLink, setPendingDeepLink] = useState<{ subPath: string; tab: string } | null>(() => {
    const deepLink = parseDeepLink();
    if (deepLink && deepLink.subPath) return { subPath: deepLink.subPath, tab: deepLink.activeTab };
    return null;
  });
  const location = useLocation(); 
  const navigate = useNavigate(); 
  // Sahifa birinchi yuklanganda haqida tabini ko'rsatish (animatsiya yo'q)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Global login modal opener — used by child components
  useEffect(() => {
    const handler = () => setIsLoginModalOpen(true);
    window.addEventListener('open-login-modal', handler);
    return () => window.removeEventListener('open-login-modal', handler);
  }, []);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const { t } = useLang();

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminView, setAdminView] = useState('ustoz');

  const loginAdmin = useCallback(() => setIsAdmin(true), []);
  const logoutAdmin = useCallback(() => { setIsAdmin(false); setAdminView('ustoz'); }, []);

  // ── Hash URL orqali admin paneliga kirish (#/shox) ──
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#/shox') {
        setActiveTab('admin');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // ── Browser History / Orqaga tugmasi mantiqi ──
  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ tab: activeTab }, '', '');
    }

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab]);

  const handleTabChange = useCallback((tab: string, subPath?: string) => {
    const adminTabs = ['admin', 'admin_ustoz', 'admin_natija', 'admin_yangilik', 'admin_sozlamalar', 'admin_royhat', 'admin_zahira', 'admin_faceid', 'admin_bildirishnoma'];
    if (isAdmin && !adminTabs.includes(tab)) logoutAdmin();

    setActiveTab(tab);

    // Deep-link uchun pending subPath ni saqlash
    if (subPath) {
      setPendingDeepLink({ subPath, tab });
    }

    // Parent oynaga route-change xabari yuborish
    const cleanPath = getCurrentCleanPath(tab, subPath);
    postRouteChange(cleanPath);

    if (tab === 'admin') {
      window.location.hash = '/shox';
    } else {
      if (window.location.hash === '#/shox') {
        window.history.pushState({ tab }, '', window.location.pathname);
      } else {
        window.history.pushState({ tab }, '', '');
      }
    }
  }, [isAdmin, logoutAdmin]);

  const oquvchiStorageKey = useMemo(() => user?.rol === 'oquvchi' ? `oquvchi_${user.ism}_${user.familiya}` : null, [user]);

  // ── POSTMESSAGE LISTENER: tashqaridan navigate/auto-start/deeplink-sj xabarlarini tinglash ──
  useEffect(() => {
    const cleanup = setupPostMessageListener((tab, subPath) => {
      handleTabChange(tab, subPath || undefined);
      // Tab specific avtomatik ochish
      if (subPath) {
        if (tab === 'oqmatlar') {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('deeplink-oqmat', { detail: { subPath } }));
          }, 600);
        } else if (tab === 'mavjud_testlar') {
          const kod = subPath.split('/')[0];
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('deeplink-test', { detail: { kod } }));
            window.dispatchEvent(new CustomEvent('auto-start-kod', { detail: { kod } }));
          }, 600);
        } else if (tab === 'mavjud_kazuslar') {
          const kod = subPath.split('/')[0];
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('deeplink-keys', { detail: { kod } }));
            window.dispatchEvent(new CustomEvent('auto-start-kod', { detail: { kod } }));
          }, 600);
        } else if (tab === 'savol_javob') {
          const parts = subPath.split('/');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('deeplink-sj', { detail: { bolimId: parts[0], bobId: parts[1] || null } }));
          }, 600);
        }
      }
    });
    return cleanup;
  }, [handleTabChange]);

  // ── DEEP-LINK: ilk yuklashda pending subPath ni jo'natish ──
  useEffect(() => {
    if (!pendingDeepLink) return;
    const { subPath, tab } = pendingDeepLink;
    const timer = setTimeout(() => {
      if (tab === 'oqmatlar') {
        window.dispatchEvent(new CustomEvent('deeplink-oqmat', { detail: { subPath } }));
      } else if (tab === 'mavjud_testlar') {
        const kod = subPath.split('/')[0];
        window.dispatchEvent(new CustomEvent('deeplink-test', { detail: { kod } }));
        window.dispatchEvent(new CustomEvent('auto-start-kod', { detail: { kod } }));
      } else if (tab === 'mavjud_kazuslar') {
        const kod = subPath.split('/')[0];
        window.dispatchEvent(new CustomEvent('deeplink-keys', { detail: { kod } }));
        window.dispatchEvent(new CustomEvent('auto-start-kod', { detail: { kod } }));
      } else if (tab === 'savol_javob') {
        const parts = subPath.split('/');
        window.dispatchEvent(new CustomEvent('deeplink-sj', { detail: { bolimId: parts[0], bobId: parts[1] || null } }));
      } else if (tab === 'sinov') {
        window.dispatchEvent(new CustomEvent('auto-start-kod', { detail: { kod: subPath.split('/')[0] } }));
      }
      setPendingDeepLink(null);
    }, 800);
    return () => clearTimeout(timer);
  }, [pendingDeepLink, activeTab]);

  // Orqaga qaytish mumkin bo'lgan sahifalar (haqida sahifasiga qaytadi)
  const BACK_TABS = ['sinov','natijalar','mavjud_testlar','mavjud_kazuslar','oqmatlar','savol_javob','profil','reyting','ustoz','testlar','royhat','oquvchilar','bot_yangilik','faceid','blog','blog_yozish'];
  const showBackBtn = BACK_TABS.includes(activeTab) && !isAdmin;

  const getPageTitle = () => {
    switch (activeTab) {
      case 'haqida': return t('page.haqida');
      case 'sinov': return t('page.sinov');
      case 'natijalar': return t('page.natijalar');
      case 'mavjud_testlar': return t('page.testlar');
      case 'mavjud_kazuslar': return t('page.kazuslar');
      case 'oqmatlar': return t('page.oqmatlar');
      case 'profil': return t('page.profil');
      case 'savol_javob': return t('page.savol_javob');
      default: return 'FanFaster';
    }
  };

  const LazyFallback = () => <div className="flex items-center justify-center py-16"><div className="h-7 w-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  const renderContent = () => {
    if (isAdmin || activeTab === 'admin') {
    return <Suspense fallback={<LazyFallback />}><AdminPanel adminView={adminView} onAdminViewChange={setAdminView} isAdminLoggedIn={isAdmin} onAdminLogin={loginAdmin} onAdminLogout={logoutAdmin} /></Suspense>;
    }
    switch (activeTab) {
      case 'haqida': 
        return <SaytHaqida onNavigate={(tab) => handleTabChange(tab)} />;
      case 'kurslar': return <Suspense fallback={<LazyFallback />}>{user?.rol === 'ustoz' ? <KurslarUstoz /> : <KurslarOquvchi onNavigate={handleTabChange} />}</Suspense>;
      case 'profil': return <Suspense fallback={<LazyFallback />}><ProfilSahifa /></Suspense>;
      case 'sinov': return <SinovBoshlash />;
      case 'natijalar': return <RealVaqtNatijalar />;
      case 'mavjud_testlar': return <MavjudTestlar />;
      case 'reyting': return <Suspense fallback={<LazyFallback />}><ReytingSahifa /></Suspense>;
      case 'mavjud_kazuslar': return <MavjudKazuslar />;
      case 'oqmatlar': return <Suspense fallback={<LazyFallback />}>{user?.rol === 'ustoz' ? <OquvMateriallarUstoz /> : <OquvMateriallarOquvchi />}</Suspense>;
      case 'savol_javob': return <Suspense fallback={<LazyFallback />}>{user?.rol === 'ustoz' ? <SavolJavobUstoz /> : <SavolJavobOquvchi />}</Suspense>;
      case 'ustoz': return <Suspense fallback={<LazyFallback />}><UstozKabineti /></Suspense>;
      case 'testlar': return <Suspense fallback={<LazyFallback />}><TestlarKabineti /></Suspense>;
      case 'royhat': return <Suspense fallback={<LazyFallback />}><OquvchilarRoyhat ustozId={user?.ustoz_id} mode="ustoz" /></Suspense>;
      case 'oquvchilar': return <Suspense fallback={<LazyFallback />}><OquvchilarRoyhat ustozId={user?.ustoz_id} mode="ustoz" /></Suspense>;
      case 'bot_yangilik': return <Suspense fallback={<LazyFallback />}><BotXabarnomasi onlyView={true} /></Suspense>;
      case 'smart_talim': return <Suspense fallback={<LazyFallback />}><SmartTalim onNavigateToMaterial={(bolimId, bobId, materialId) => { handleTabChange('oqmatlar'); setTimeout(() => { window.dispatchEvent(new CustomEvent('deeplink-oqmat', { detail: { subPath: `${bolimId}/${bobId || ''}/${materialId || ''}` } })); }, 600); }} /></Suspense>;
      case 'blog': return <Suspense fallback={<LazyFallback />}><BlogList /></Suspense>;
      case 'blog_yozish': return <Suspense fallback={<LazyFallback />}><BlogYozish /></Suspense>;
      case 'yordam': return <Suspense fallback={<LazyFallback />}><YordamSahifa /></Suspense>;
      case 'faceid': return <Suspense fallback={<LazyFallback />}><FaceIdPanel /></Suspense>;
      default: return <SaytHaqida onNavigate={(tab) => handleTabChange(tab)} />;
    }
  };

  const pageTransition = {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: 0.15 } }
  };

  return (
    <>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      
      <div className="flex bg-[#F2F4F7] font-sans" style={{ height: '100dvh', minHeight: '-webkit-fill-available', overflow: 'hidden' }}>
        <AdminContext.Provider value={{ isAdmin, adminView, loginAdmin, logoutAdmin, setAdminView }}>
          
          <Sidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            isAdmin={isAdmin}
            adminView={adminView}
            onAdminViewChange={setAdminView}
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />

          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-40">
              <div className="flex items-center gap-2">
                <button onClick={() => setIsMobileSidebarOpen(true)} className="md:hidden p-1 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                  <Menu className="h-5 w-5" />
                </button>
                {showBackBtn && (
                  <button
                    onClick={() => handleTabChange('haqida')}
                    className="flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all text-xs font-bold"
                    title="Bosh sahifaga qaytish"
                  >
                    <LogIn className="h-3.5 w-3.5 rotate-180" />
                    <span className="hidden sm:inline">Orqaga</span>
                  </button>
                )}
                <h1 className="text-[13px] font-bold text-gray-800 hidden sm:block uppercase tracking-tight">
                  {getPageTitle()}
                </h1>
              </div>

              <div className="flex items-center gap-1.5 md:gap-2">
                <Suspense fallback={null}>
                  <MentorChatBot
                    activeTab={activeTab}
                    onNavigate={(tab, extra) => {
                      handleTabChange(tab);
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
                <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />
                <div className="relative">
                  {isAuthenticated && user?.rol === 'oquvchi' && oquvchiStorageKey ? (
                    <OquvchiBildirishnomaBell oquvchiIsm={user.ism} oquvchiFamiliya={user.familiya} kurs={user.kurs} guruh={user.guruh} storageKey={oquvchiStorageKey} />
                  ) : isAuthenticated && user?.rol === 'ustoz' ? (
                    <>
                      <UstozBildirishnomaLoader ustozId={user.ustoz_id!} />
                      <NotificationBell />
                    </>
                  ) : (
                    <button className="p-1.5 text-gray-400 hover:text-blue-600 transition-all"><Bell className="h-4 w-4" /></button>
                  )}
                </div>
                <LangSwitcher />
                <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />
                {isAuthenticated && user ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                      className="flex items-center gap-1.5 pl-1.5 pr-0.5 py-0.5 hover:bg-gray-100 rounded-full transition-all"
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-black text-blue-600 uppercase">{user.ism[0]}{user.familiya[0]}</span>
                      </div>
                      <div className="text-left hidden md:block">
                        <p className="text-[11px] font-bold text-gray-600 leading-none">{t('header.my_profile')}</p>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                    {showProfileDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowProfileDropdown(false)} />
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl z-50 border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="px-3 py-2 border-b border-gray-50 bg-gray-50/50">
                            <p className="text-[11px] font-bold text-gray-900 truncate">{user.ism} {user.familiya}</p>
                          </div>
                          <div className="p-1">
                            <button onClick={() => { setActiveTab('profil'); setShowProfileDropdown(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-all text-xs font-medium"><UserIcon className="h-3.5 w-3.5" /> {t('page.profil')}</button>
                            <button onClick={() => { logout(); setShowProfileDropdown(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all text-xs font-bold"><LogOut className="h-3.5 w-3.5" /> {t('header.logout')}</button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setIsLoginModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[11px] font-black shadow-sm active:scale-95 transition-all"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>{t('header.login')}</span>
                  </button>
                )}
              </div>
            </header>

            <main className="flex-1 overflow-auto p-4 md:p-6">
              <div className="w-full">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isAdmin ? `admin-${adminView}` : activeTab}
                    variants={pageTransition}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {renderContent()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </div>
        </AdminContext.Provider>
      </div>
      <Toaster />
    </>
  );
}

function RouterRoot() {
  const location = useLocation();
  // /telegram-callback yo'li — alohida sahifa, asosiy layout yo'q
  if (location.pathname === '/telegram-callback') {
    return (
      <AuthProvider>
        <TelegramCallback />
      </AuthProvider>
    );
  }
  // /blog/:slug — blog post sahifasi (asosiy layout ichida)
  const blogPostMatch = location.pathname.match(/^\/blog\/([^/]+)$/);
  if (blogPostMatch && blogPostMatch[1] !== 'muallif') {
    return (
      <LangProvider>
        <AuthProvider>
          <NotificationProvider>
            <div className="flex bg-[#F2F4F7] font-sans" style={{ height: '100dvh', minHeight: '-webkit-fill-available', overflow: 'hidden' }}>
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 shrink-0 z-40">
                  <h1 className="text-[13px] font-bold text-gray-800 uppercase tracking-tight">Blog</h1>
                </header>
                <main className="flex-1 overflow-auto p-4 md:p-6">
                  <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="h-7 w-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
                    <BlogPostDetail slug={blogPostMatch[1]} />
                  </Suspense>
                </main>
              </div>
            </div>
          </NotificationProvider>
        </AuthProvider>
      </LangProvider>
    );
  }
  // /blog/muallif/:muallif_slug — muallif sahifasi (asosiy layout ichida)
  const muallifMatch = location.pathname.match(/^\/blog\/muallif\/([^/]+)$/);
  if (muallifMatch) {
    return (
      <LangProvider>
        <AuthProvider>
          <NotificationProvider>
            <div className="flex bg-[#F2F4F7] font-sans" style={{ height: '100dvh', minHeight: '-webkit-fill-available', overflow: 'hidden' }}>
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 shrink-0 z-40">
                  <h1 className="text-[13px] font-bold text-gray-800 uppercase tracking-tight">Muallif</h1>
                </header>
                <main className="flex-1 overflow-auto p-4 md:p-6">
                  <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="h-7 w-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
                    <BlogMuallif muallif_slug={muallifMatch[1]} />
                  </Suspense>
                </main>
              </div>
            </div>
          </NotificationProvider>
        </AuthProvider>
      </LangProvider>
    );
  }
  return (
    <LangProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </LangProvider>
  );
}

export default function App() {
  return <RouterRoot />;
}
