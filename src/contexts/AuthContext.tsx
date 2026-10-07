import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export interface User {
  ism: string;
  familiya: string;
  rol: 'oquvchi' | 'ustoz';
  guruh?: string;
  kurs?: string;
  login?: string;
  ustoz_id?: string;
  faceIdTasdiqlangan?: boolean;
  blog_huquqi?: boolean;
  ustoz_huquqi?: boolean;
  hukm_only?: boolean;
  talaba_id?: string;
  google_linked?: boolean;
  telegram_linked?: boolean;
  tasdiqlangan?: boolean;
  avatar_url?: string | null;
  bonus_urinish?: number;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'huquq_auth_user';
// sessionStorage kaliti — tab yopilganda tozalanadi, refresh da saqlanadi
const SESSION_FLAG = 'page_is_refreshing';
// Doimiy localStorage kaliti — foydalanuvchi o'zi chiqmaguncha saqlanadi
const PERSISTENT_KEY = 'huquq_persistent_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // 1. Avval doimiy (persistent) foydalanuvchini tekshiramiz
    const persistentUser = localStorage.getItem(PERSISTENT_KEY);
    if (persistentUser) {
      try {
        const userData = JSON.parse(persistentUser) as User;
        // talaba_id merged_into zanjiri bo'yicha asosiy qatorga normallashtirish
        if (userData.talaba_id && userData.rol === 'oquvchi') {
          supabase
            .from('talabalar')
            .select('id, ism, familiya, guruh, kurs, login_id, merged_into, google_user_id, telegram_chat_id')
            .eq('id', userData.talaba_id)
            .maybeSingle()
            .then(({ data: talaba }) => {
              if (talaba?.merged_into) {
                // Asosiy qatorga o'tish
                supabase
                  .from('talabalar')
                  .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id, avatar_url')
                  .eq('id', talaba.merged_into)
                  .maybeSingle()
                  .then(({ data: asosiy }) => {
                    if (asosiy) {
                      const normalized: User = {
                        ...userData,
                        talaba_id: asosiy.id,
                        ism: asosiy.ism || userData.ism,
                        familiya: asosiy.familiya || userData.familiya,
                        guruh: asosiy.guruh || userData.guruh,
                        kurs: asosiy.kurs || userData.kurs,
                        login: asosiy.login_id || userData.login,
                        google_linked: !!asosiy.google_user_id,
                        telegram_linked: !!asosiy.telegram_chat_id,
                        tasdiqlangan: !!asosiy.google_user_id && !!asosiy.telegram_chat_id,
                        avatar_url: asosiy.avatar_url || null,
                      };
                      setUser(normalized);
                      const json = JSON.stringify(normalized);
                      localStorage.setItem(PERSISTENT_KEY, json);
                      localStorage.setItem(STORAGE_KEY, json);
                    } else {
                      setUser(userData);
                    }
                  });
              } else {
                // Asosiy qator — avatar_url ni yangilash
                supabase
                  .from('talabalar')
                  .select('avatar_url')
                  .eq('id', userData.talaba_id)
                  .maybeSingle()
                  .then(({ data: t }) => {
                    if (t?.avatar_url !== undefined) {
                      const normalized = { ...userData, avatar_url: t.avatar_url };
                      setUser(normalized);
                      localStorage.setItem(PERSISTENT_KEY, JSON.stringify(normalized));
                      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
                    } else {
                      setUser(userData);
                    }
                  });
              }
            });
        } else {
          setUser(userData);
        }
        sessionStorage.setItem(SESSION_FLAG, 'true');
        localStorage.setItem(STORAGE_KEY, persistentUser);
        console.log('✅ Doimiy foydalanuvchi yuklandi:', userData);
        return;
      } catch (error) {
        console.error('❌ Persistent localStorage parse xatosi:', error);
        localStorage.removeItem(PERSISTENT_KEY);
      }
    }

    // 2. Persistent bo'lmasa — eski session logikasi
    const isRefreshing = sessionStorage.getItem(SESSION_FLAG);
    if (isRefreshing) {
      const savedUser = localStorage.getItem(STORAGE_KEY);
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          console.log('✅ Foydalanuvchi (refresh) yuklandi:', userData);
        } catch (error) {
          console.error('❌ localStorage parse xatosi:', error);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('baholash_toplam_kod');
      console.log('🔄 Yangi sessiya — avvalgi kirish o\'chirildi');
    }

    const handleBeforeUnload = () => {
      sessionStorage.setItem(SESSION_FLAG, 'true');
    };
    // O'quvchi profil yaratilganda AuthContext ni yangilash
    const handleOquvchiProfil = (e: Event) => {
      const userData = (e as CustomEvent).detail;
      if (userData) {
        setUser(userData);
        sessionStorage.setItem(SESSION_FLAG, 'true');
        console.log('✅ O\'quvchi profili avtomatik yaratildi:', userData);
      }
    };
    // Avatar yangilanganda — butun ilovada sinxronlash
    const handleAvatarUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.avatarUrl !== undefined) {
        setUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, avatar_url: detail.avatarUrl };
          const json = JSON.stringify(updated);
          localStorage.setItem(PERSISTENT_KEY, json);
          localStorage.setItem(STORAGE_KEY, json);
          return updated;
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('oquvchi-profil-yaratildi', handleOquvchiProfil);
    window.addEventListener('avatar-updated', handleAvatarUpdated);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('oquvchi-profil-yaratildi', handleOquvchiProfil);
      window.removeEventListener('avatar-updated', handleAvatarUpdated);
    };
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    const userJson = JSON.stringify(userData);
    localStorage.setItem(STORAGE_KEY, userJson);
    // Doimiy saqlash — foydalanuvchi o'zi chiqmaguncha saqlanadi
    localStorage.setItem(PERSISTENT_KEY, userJson);
    sessionStorage.setItem(SESSION_FLAG, 'true');
    console.log('✅ Foydalanuvchi tizimga kirdi:', userData);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PERSISTENT_KEY);
    sessionStorage.removeItem(SESSION_FLAG);
    localStorage.removeItem('baholash_toplam_kod');
    localStorage.removeItem('sinov_oquvchi');
    localStorage.removeItem('fanfaster_demo_used');
    // Mini App eslab qolish flag'ini tozalash
    try { localStorage.removeItem('ff_miniapp_linked'); } catch {}
    try {
      window.Telegram?.WebApp?.CloudStorage?.removeItem?.('ff_miniapp_linked', () => {});
    } catch {}
    console.log('✅ Foydalanuvchi tizimdan chiqdi');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
