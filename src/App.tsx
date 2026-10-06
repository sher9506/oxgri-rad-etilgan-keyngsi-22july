
import { useState, useEffect, useRef, createContext, useContext, useMemo, lazy, Suspense, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import TelegramCallback from '@/pages/TelegramCallback';
const GoogleCallback = lazy(() => import('@/pages/GoogleCallback'));
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/components/ui/sonner';
import TopNav from '@/components/layout/TopNav';
import Sidebar from '@/components/layout/Sidebar';
import { Menu as MenuIcon, LogOut, User as UserIcon } from 'lucide-react';
const LoginModal = lazy(() => import('@/components/features/LoginModal'));
const SinovBoshlash = lazy(() => import('@/components/features/SinovBoshlash'));
const RealVaqtNatijalar = lazy(() => import('@/components/features/RealVaqtNatijalar'));
const MavjudTestlar = lazy(() => import('@/components/features/MavjudTestlar'));
const MavjudKazuslar = lazy(() => import('@/components/features/MavjudKazuslar'));
const KurslarOquvchi = lazy(() => import('@/components/features/KurslarOquvchi'));
const KurslarUstoz = lazy(() => import('@/components/features/KurslarUstoz'));
const UstozKabineti = lazy(() => import('@/components/features/UstozKabineti'));
const OquvchilarRoyhat = lazy(() => import('@/components/features/OquvchilarRoyhat'));
const FaceIdPanel = lazy(() => import('@/components/features/FaceIdPanel'));
const AdminPanel = lazy(() => import('@/components/features/AdminPanel'));
const TestlarKabineti = lazy(() => import('@/components/features/TestlarKabineti'));
const BotXabarnomasi = lazy(() => import('@/components/features/BotXabarnomasi'));
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { LangProvider } from '@/contexts/LangContext';
const SaytHaqida = lazy(() => import('@/components/features/SaytHaqida'));
const ProfilSahifa = lazy(() => import('@/components/features/ProfilSahifa'));
const SavolJavobUstoz = lazy(() => import('@/components/features/SavolJavobUstoz'));
const SavolJavobOquvchi = lazy(() => import('@/components/features/SavolJavobOquvchi'));
const OquvMateriallarOquvchi = lazy(() => import('@/components/features/OquvMateriallarOquvchi'));
const OquvMateriallarUstoz = lazy(() => import('@/components/features/OquvMateriallarUstoz'));
import {
  parseDeepLink,
  setupPostMessageListener,
  postRouteChange,
  getCurrentCleanPath,
} from '@/lib/deepLink';
const ReytingSahifa = lazy(() => import('@/components/features/ReytingSahifa'));
const YordamSahifa = lazy(() => import('@/components/features/YordamSahifa'));
const SmartTalim = lazy(() => import('@/components/features/SmartTalim'));
const BlogList = lazy(() => import('@/components/features/BlogList'));
const BlogYozish = lazy(() => import('@/components/features/BlogYozish'));
const BlogPostDetail = lazy(() => import('@/components/features/BlogPostDetail'));
const BlogMuallif = lazy(() => import('@/components/features/BlogMuallif'));
const TezOradaSahifa = lazy(() => import('@/components/features/TezOradaSahifa'));
const MootCourtUstoz = lazy(() => import('@/components/features/MootCourtUstoz'));
const MootCourtOquvchi = lazy(() => import('@/components/features/MootCourtOquvchi'));
const QonunlarBazasi = lazy(() => import('@/components/features/QonunlarBazasi'));
const LexUzQidiruvchi = lazy(() => import('@/components/features/LexUzQidiruvchi'));
import MiniAppBanner, { useMiniAppAutoLogin, MiniAppLoginOverlay, isTelegramMiniApp } from '@/components/features/MiniAppBanner';
import ErrorBoundary from '@/components/ErrorBoundary';

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

function AppContent() {
  const getInitialTab = () => {
    const deepLink = parseDeepLink();
    if (deepLink) return deepLink.activeTab;
    return 'haqida';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [pendingDeepLink, setPendingDeepLink] = useState<{ subPath: string; tab: string } | null>(() => {
    const deepLink = parseDeepLink();
    if (deepLink && deepLink.subPath) return { subPath: deepLink.subPath, tab: deepLink.activeTab };
    return null;
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsLoginModalOpen(true);
    window.addEventListener('open-login-modal', handler);
    return () => window.removeEventListener('open-login-modal', handler);
  }, []);

  // Mini app avtokirish xatosi — foydalanuvchiga ko'rsatish
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.code === 'not_registered') {
        toast.warning('Telegram akkauntingiz topilmadi', {
          description: 'Iltimos, saytda ro\'yxatdan o\'ting yoki Telegramni ulang.',
        });
      } else if (detail?.code === 'bad_signature') {
        toast.error('Telegram imzo noto\'g\'ri', {
          description: 'Iltimos, saytdan qaytadan kiring.',
        });
      }
    };
    window.addEventListener('miniapp-autologin-failed', handler);
    return () => window.removeEventListener('miniapp-autologin-failed', handler);
  }, []);

  const { user, logout, login } = useAuth();

  // Mini app avtomatik kirish
  useMiniAppAutoLogin(login);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminView, setAdminView] = useState('ustoz');

  const loginAdmin = useCallback(() => setIsAdmin(true), []);
  const logoutAdmin = useCallback(() => { setIsAdmin(false); setAdminView('ustoz'); }, []);

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

    if (subPath) {
      setPendingDeepLink({ subPath, tab });
    }

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

  useEffect(() => {
    const cleanup = setupPostMessageListener((tab, subPath) => {
      handleTabChange(tab, subPath || undefined);
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

  const LazyFallback = () => <div className="flex items-center justify-center py-16"><div className="h-7 w-7 rounded-full animate-spin" style={{ border: '2px solid var(--cobalt-1)', borderTopColor: 'transparent' }} /></div>;

  const renderContent = () => {
    if (isAdmin || activeTab === 'admin') {
    return <Suspense fallback={<LazyFallback />}><AdminPanel adminView={adminView} onAdminViewChange={setAdminView} isAdminLoggedIn={isAdmin} onAdminLogin={loginAdmin} onAdminLogout={logoutAdmin} /></Suspense>;
    }

    if (user?.rol === 'ustoz') {
      const blogHuquqi = user.blog_huquqi === true;
      const ustozHuquqi = user.ustoz_huquqi === true;
      const isBlogOnly = blogHuquqi && !ustozHuquqi;
      const isUstozRestricted = ustozHuquqi && !blogHuquqi;

      if (isBlogOnly) {
        const allowed = ['blog', 'blog_yozish', 'profil', 'haqida', 'yordam'];
        if (!allowed.includes(activeTab)) {
          return <Suspense fallback={<LazyFallback />}><SaytHaqida onNavigate={(tab) => handleTabChange(tab)} /></Suspense>;
        }
      }

      if (isUstozRestricted && activeTab === 'blog_yozish') {
        return <Suspense fallback={<LazyFallback />}><SaytHaqida onNavigate={(tab) => handleTabChange(tab)} /></Suspense>;
      }
    }

    switch (activeTab) {
      case 'haqida': 
        return <Suspense fallback={<LazyFallback />}><SaytHaqida onNavigate={(tab) => handleTabChange(tab)} /></Suspense>;
      case 'kurslar': return <Suspense fallback={<LazyFallback />}>{user?.rol === 'ustoz' ? <KurslarUstoz /> : <KurslarOquvchi onNavigate={handleTabChange} />}</Suspense>;
      case 'profil': return <Suspense fallback={<LazyFallback />}><ProfilSahifa /></Suspense>;
      case 'sinov': return <Suspense fallback={<LazyFallback />}><SinovBoshlash /></Suspense>;
      case 'natijalar': return <Suspense fallback={<LazyFallback />}><RealVaqtNatijalar /></Suspense>;
      case 'mavjud_testlar': return <Suspense fallback={<LazyFallback />}><MavjudTestlar /></Suspense>;
      case 'reyting': return <Suspense fallback={<LazyFallback />}><ReytingSahifa /></Suspense>;
      case 'mavjud_kazuslar': return <Suspense fallback={<LazyFallback />}><MavjudKazuslar /></Suspense>;
      case 'oqmatlar': return <Suspense fallback={<LazyFallback />}>{user?.rol === 'ustoz' ? <OquvMateriallarUstoz /> : <OquvMateriallarOquvchi />}</Suspense>;
      case 'savol_javob': return <Suspense fallback={<LazyFallback />}>{user?.rol === 'ustoz' ? <SavolJavobUstoz /> : <SavolJavobOquvchi />}</Suspense>;
      case 'ustoz': return <Suspense fallback={<LazyFallback />}><UstozKabineti /></Suspense>;
      case 'testlar': return <Suspense fallback={<LazyFallback />}><TestlarKabineti /></Suspense>;
      case 'oquvchilar': return <Suspense fallback={<LazyFallback />}><OquvchilarRoyhat ustozId={user?.ustoz_id} mode="ustoz" /></Suspense>;
      case 'bot_yangilik': return <Suspense fallback={<LazyFallback />}><BotXabarnomasi onlyView={true} /></Suspense>;
      case 'smart_talim': return <Suspense fallback={<LazyFallback />}><SmartTalim onNavigateToMaterial={(bolimId, bobId, materialId) => { handleTabChange('oqmatlar'); setTimeout(() => { window.dispatchEvent(new CustomEvent('deeplink-oqmat', { detail: { subPath: `${bolimId}/${bobId || ''}/${materialId || ''}` } })); }, 600); }} /></Suspense>;
      case 'blog': return <Suspense fallback={<LazyFallback />}><BlogList /></Suspense>;
      case 'blog_yozish': return <Suspense fallback={<LazyFallback />}><BlogYozish /></Suspense>;
      case 'moot_court': return <Suspense fallback={<LazyFallback />}>{user?.rol === 'ustoz' ? <MootCourtUstoz /> : <MootCourtOquvchi />}</Suspense>;
      case 'qonun_bazasi': return <Suspense fallback={<LazyFallback />}><QonunlarBazasi /></Suspense>;
      case 'lex_uz_qidiruvchi': return <Suspense fallback={<LazyFallback />}><LexUzQidiruvchi /></Suspense>;
      case 'yordam': return <Suspense fallback={<LazyFallback />}><YordamSahifa /></Suspense>;
      case 'faceid': return <Suspense fallback={<LazyFallback />}><FaceIdPanel /></Suspense>;
      default: return <Suspense fallback={<LazyFallback />}><SaytHaqida onNavigate={(tab) => handleTabChange(tab)} /></Suspense>;
    }
  };

  const pageTransition = {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: 0.15 } }
  };

  return (
    <>
      <MiniAppBanner />
      <Suspense fallback={null}><LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} /></Suspense>
      
      {/* Mini App ichida login bo'lmaganda "Davom etish" overlay */}
      {isTelegramMiniApp() && !user && <MiniAppLoginOverlay />}
      
      <AdminContext.Provider value={{ isAdmin, adminView, loginAdmin, logoutAdmin, setAdminView }}>
        {isAdmin || user?.rol === 'ustoz' ? (
          <div className="flex font-sans ff-full-height" style={{ overflow: 'hidden', background: 'var(--bg)' }}>
            <Sidebar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              isAdmin={isAdmin}
              adminView={adminView}
              onAdminViewChange={setAdminView}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mobile top bar for ustoz/admin layout */}
              <div className="md:hidden flex items-center justify-between px-4 py-2.5 border-b shrink-0" style={{ background: 'var(--navy-1)', color: 'var(--on-navy)', borderColor: 'rgba(141,183,255,.1)' }}>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ color: 'var(--on-navy-muted)' }}
                  aria-label="Menyuni ochish"
                >
                  <MenuIcon className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold" style={{ color: 'var(--on-navy)', fontFamily: 'Source Serif 4, Georgia, serif' }}>FanFaster</span>
                </div>
                {user ? (
                  <button
                    onClick={() => handleTabChange('profil')}
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(141,183,255,.1)', border: '1px solid rgba(141,183,255,.2)' }}
                    aria-label="Profil"
                  >
                    <UserIcon className="h-4 w-4" style={{ color: 'var(--on-navy)' }} />
                  </button>
                ) : (
                  <div className="w-8 h-8" />
                )}
              </div>
              <main className="flex-1 overflow-auto" style={{ minHeight: 0, overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' } as CSSProperties}>
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
          </div>
        ) : (
          <div className="flex flex-col font-sans ff-full-height" style={{ overflow: 'hidden', background: 'var(--bg)' }}>
            <TopNav
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onOpenLogin={() => setIsLoginModalOpen(true)}
              onLogout={logout}
            />
            <main className="flex-1 overflow-auto pb-[calc(64px+8px+env(safe-area-inset-bottom)+24px)] lg:pb-0" style={{ minHeight: 0, overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' } as CSSProperties}>
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
        )}
      </AdminContext.Provider>
      <Toaster />
    </>
  );
}

function RouterRoot() {
  const location = useLocation();
  if (location.pathname === '/telegram-callback') {
    return (
      <AuthProvider>
        <TelegramCallback />
      </AuthProvider>
    );
  }
  if (location.pathname === '/google-callback') {
    return (
      <AuthProvider>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>}>
          <GoogleCallback />
        </Suspense>
      </AuthProvider>
    );
  }
  const blogPostMatch = location.pathname.match(/^\/blog\/([^/]+)$/);
  if (blogPostMatch && blogPostMatch[1] !== 'muallif') {
    return (
      <LangProvider>
        <AuthProvider>
          <NotificationProvider>
            <div className="flex flex-col font-sans ff-full-height" style={{ overflow: 'hidden', background: 'var(--bg)' }}>
              <TopNav
                activeTab="blog"
                onTabChange={() => {}}
                onOpenLogin={() => {}}
                onLogout={() => {}}
              />
              <main className="flex-1 overflow-auto p-4 md:p-6" style={{ minHeight: 0, overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' } as CSSProperties}>
                <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="h-7 w-7 rounded-full animate-spin" style={{ border: '2px solid var(--cobalt-1)', borderTopColor: 'transparent' }} /></div>}>
                  <BlogPostDetail slug={blogPostMatch[1]} />
                </Suspense>
              </main>
            </div>
          </NotificationProvider>
        </AuthProvider>
      </LangProvider>
    );
  }
  if (location.pathname === '/blog/mualliflar') {
    return (
      <LangProvider>
        <AuthProvider>
          <NotificationProvider>
            <div className="min-h-screen font-sans" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
              <Suspense fallback={<div className="flex min-h-[560px] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full" style={{ border: '2px solid var(--cobalt-1)', borderTopColor: 'transparent' }} /></div>}>
                <TezOradaSahifa sarlavha="Mualliflar" />
              </Suspense>
            </div>
          </NotificationProvider>
        </AuthProvider>
      </LangProvider>
    );
  }
  if (location.pathname === '/blog/mavzular') {
    return (
      <LangProvider>
        <AuthProvider>
          <NotificationProvider>
            <div className="min-h-screen font-sans" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
              <Suspense fallback={<div className="flex min-h-[560px] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full" style={{ border: '2px solid var(--cobalt-1)', borderTopColor: 'transparent' }} /></div>}>
                <TezOradaSahifa sarlavha="Mavzular" />
              </Suspense>
            </div>
          </NotificationProvider>
        </AuthProvider>
      </LangProvider>
    );
  }
  const muallifMatch = location.pathname.match(/^\/blog\/muallif\/([^/]+)$/);
  if (muallifMatch) {
    return (
      <LangProvider>
        <AuthProvider>
          <NotificationProvider>
            <div className="min-h-screen font-sans" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
              <Suspense fallback={<div className="flex min-h-[560px] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full" style={{ border: '2px solid var(--cobalt-1)', borderTopColor: 'transparent' }} /></div>}>
                <BlogMuallif muallif_slug={muallifMatch[1]} />
              </Suspense>
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
  return (
    <ErrorBoundary>
      <RouterRoot />
    </ErrorBoundary>
  );
}
