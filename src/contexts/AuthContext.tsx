import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  ism: string;
  familiya: string;
  rol: 'oquvchi' | 'ustoz';
  guruh?: string;
  kurs?: string; // O'quvchi uchun kurs: 1-kurs, 2-kurs, 3-kurs, 4-kurs
  login?: string;
  ustoz_id?: string; // Tasdiqlangan ustoz uchun ID
  faceIdTasdiqlangan?: boolean; // Face ID orqali ro'yxatdan o'tgan
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
        const userData = JSON.parse(persistentUser);
        setUser(userData);
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
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('oquvchi-profil-yaratildi', handleOquvchiProfil);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('oquvchi-profil-yaratildi', handleOquvchiProfil);
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
    // O'quvchi ism/familiyasini sinov_oquvchi dan ham tozalaymiz
    localStorage.removeItem('sinov_oquvchi');
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
