import { Scale, LogIn, LogOut, User as UserIcon, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import LoginModal from '@/components/features/LoginModal';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      
      <header className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white shadow-lg animate-slide-down sticky top-0 z-20">
        <div className="container mx-auto px-4 py-1.5">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="bg-[hsl(43,96%,56%)] p-1 rounded-lg animate-bounce-slow">
                <Scale className="h-5 w-5 text-[hsl(221,83%,53%)]" />
              </div>
              <div>
                <h1 className="text-sm font-bold">JurisMind</h1>
                <p className="text-[9px] text-blue-100">Bilimingizni sun'iy intellekt bilan yuksaltiring</p>
              </div>
            </div>

            {/* Kirish/Profil tugmalari */}
            <div className="flex items-center gap-2 relative">
              {isAuthenticated && user ? (
                <div>
                  {/* Profil tugmasi */}
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-lg transition-all border border-white/20"
                  >
                    <div className="bg-white/20 p-0.5 rounded-full">
                      <UserIcon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="text-left hidden md:block">
                      <p className="text-[11px] font-semibold">{user.ism} {user.familiya}</p>
                      <p className="text-[9px] text-blue-100">
                        {user.rol === 'ustoz' ? '👨‍🏫 Ustoz' : '👨‍🎓 O\'quvchi'}
                        {user.kurs && ` • ${user.kurs}-kurs`}
                      </p>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {showProfileDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowProfileDropdown(false)}
                      />
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl z-50 overflow-hidden border-2 border-gray-100">
                        {/* Profil header */}
                        <div className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white p-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-3 rounded-full">
                              <UserIcon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <p className="font-bold text-lg">{user.ism} {user.familiya}</p>
                              <p className="text-sm text-blue-100">
                                {user.rol === 'ustoz' ? '👨‍🏫 Ustoz' : '👨‍🎓 O\'quvchi'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Profil ma'lumotlari */}
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50">
                          <h3 className="text-xs font-bold text-gray-700 uppercase mb-3">Mening profilim</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center py-1.5 px-3 bg-white rounded-lg">
                              <span className="text-gray-600">Ism:</span>
                              <span className="font-semibold text-gray-900">{user.ism}</span>
                            </div>
                            <div className="flex justify-between items-center py-1.5 px-3 bg-white rounded-lg">
                              <span className="text-gray-600">Familiya:</span>
                              <span className="font-semibold text-gray-900">{user.familiya}</span>
                            </div>
                            <div className="flex justify-between items-center py-1.5 px-3 bg-white rounded-lg">
                              <span className="text-gray-600">Rol:</span>
                              <span className="font-semibold text-gray-900">
                                {user.rol === 'ustoz' ? 'Ustoz' : 'O\'quvchi'}
                              </span>
                            </div>
                            {user.kurs && (
                              <div className="flex justify-between items-center py-1.5 px-3 bg-white rounded-lg">
                                <span className="text-gray-600">Kurs:</span>
                                <span className="font-semibold text-gray-900">{user.kurs}-kurs</span>
                              </div>
                            )}
                            {user.guruh && (
                              <div className="flex justify-between items-center py-1.5 px-3 bg-white rounded-lg">
                                <span className="text-gray-600">Guruh:</span>
                                <span className="font-semibold text-gray-900">{user.guruh}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Chiqish tugmasi */}
                        <div className="p-3 bg-gray-50 border-t border-gray-200">
                          <button
                            onClick={() => {
                              logout();
                              setShowProfileDropdown(false);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
                          >
                            <LogOut className="h-5 w-5" />
                            Chiqish
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 border border-white/20"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="text-xs">Kirish</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <style>{`
          @keyframes slide-down {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes bounce-slow {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-5px);
            }
          }

          .animate-slide-down {
            animation: slide-down 0.6s ease-out;
          }

          .animate-bounce-slow {
            animation: bounce-slow 2s ease-in-out infinite;
          }
        `}</style>
      </header>
    </>
  );
}
