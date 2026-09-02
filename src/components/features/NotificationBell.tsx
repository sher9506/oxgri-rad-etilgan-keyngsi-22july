import { useState, useEffect } from 'react';
import { Bell, X, Check, Trash2, Play, BellOff, ChevronDown } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';

interface NotificationBellProps {
  colorScheme?: 'blue' | 'green';
  onActionClick?: (tur: 'toplam' | 'test', kod: string) => void;
}

export default function NotificationBell({ colorScheme = 'blue', onActionClick }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll } = useNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'face_duplicate': return '👥';
      case 'warning': case 'ogohlantirish': return '⚠️';
      case 'muhim': return '🔴';
      default: return 'ℹ️';
    }
  };

  const getNotificationBg = (type: string, read: boolean) => {
    if (read) return 'bg-white hover:bg-gray-50';
    switch (type) {
      case 'muhim': return 'bg-red-50/60 hover:bg-red-50';
      case 'warning': case 'ogohlantirish': return 'bg-yellow-50/60 hover:bg-yellow-50';
      default: return 'bg-blue-50/50 hover:bg-blue-50';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Hozirgina';
    if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
    return date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const headerGradient = colorScheme === 'green'
    ? 'from-green-600 to-emerald-600'
    : 'from-blue-600 to-indigo-600';

  const badgeColor = colorScheme === 'green' ? 'bg-green-500' : 'bg-red-500';

  const handleNotificationClick = (notif: any) => {
    if (!notif.read) markAsRead(notif.id);
  };

  const handleActionBoshlash = (e: React.MouseEvent, notif: any) => {
    e.stopPropagation();
    if (notif.data?.actionTur && notif.data?.actionKod && onActionClick) {
      onActionClick(notif.data.actionTur, notif.data.actionKod);
      markAsRead(notif.id);
      setIsOpen(false);
    }
  };

  // Body scroll lock on mobile when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const NotifCard = ({ notif }: { notif: any }) => (
    <div
      key={notif.id}
      className={`mx-3 mb-2 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-[0.98] ${
        notif.read
          ? 'bg-white border-gray-100 shadow-sm'
          : notif.type === 'muhim'
          ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 shadow-md shadow-red-100'
          : notif.type === 'ogohlantirish' || notif.type === 'warning'
          ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 shadow-md shadow-amber-100'
          : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-md shadow-blue-100'
      }`}
      onClick={() => handleNotificationClick(notif)}
    >
      <div className="p-3.5">
        <div className="flex gap-3">
          {/* Icon circle */}
          <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm ${
            notif.type === 'muhim' ? 'bg-red-100' :
            notif.type === 'ogohlantirish' || notif.type === 'warning' ? 'bg-amber-100' :
            'bg-blue-100'
          }`}>
            {getNotificationIcon(notif.type)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1.5">
              <h4 className={`font-bold text-sm leading-snug flex-1 ${
                !notif.read ? 'text-gray-900' : 'text-gray-600'
              }`}>
                {notif.title}
              </h4>
              <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                {!notif.read && (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    notif.type === 'muhim' ? 'bg-red-500' :
                    notif.type === 'ogohlantirish' || notif.type === 'warning' ? 'bg-amber-500' :
                    'bg-blue-500'
                  }`} style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); clearNotification(notif.id); }}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed mt-1 line-clamp-3">
              {notif.message}
            </p>

            {/* Action button */}
            {notif.data?.actionTur && notif.data?.actionKod && onActionClick && (
              <button
                onClick={(e) => handleActionBoshlash(e, notif)}
                className="mt-2.5 w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] hover:from-[hsl(221,83%,45%)] hover:to-[hsl(221,83%,35%)] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-200 transition-all active:scale-95"
              >
                <Play className="h-3.5 w-3.5" />
                {notif.data.actionTur === 'toplam' ? 'Toplamni boshlash' : 'Testni boshlash'}
                <span className="bg-white/20 px-2 py-0.5 rounded-lg font-mono tracking-wider">
                  {notif.data.actionKod}
                </span>
              </button>
            )}

            <p className="text-[10px] text-gray-400 mt-2">{formatTime(notif.timestamp)}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const PanelContent = () => (
    <>
      {/* Header */}
      <div className={`bg-gradient-to-r ${headerGradient} text-white flex-shrink-0`}>
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/20 p-1.5 rounded-xl">
              <Bell className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-black text-base">Bildirishnomalar</h3>
              <p className="text-[11px] text-blue-100">
                {unreadCount > 0 ? `${unreadCount} ta yangi xabar` : 'Yangi xabar yo\'q'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-9 h-9 flex items-center justify-center bg-white/15 hover:bg-white/30 rounded-xl transition-all active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        {notifications.length > 0 && (
          <div className="px-4 pb-3 flex items-center justify-between">
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white font-semibold disabled:opacity-40 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg transition-all"
            >
              <Check className="h-3.5 w-3.5" />
              Barchasini o'qilgan
            </button>
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white font-semibold bg-white/10 hover:bg-red-400/40 px-2.5 py-1.5 rounded-lg transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hammasini o'chir
            </button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {notifications.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BellOff className="h-10 w-10 text-gray-300" />
            </div>
            <p className="font-bold text-gray-500">Bildirishnomalar yo'q</p>
            <p className="text-sm text-gray-400 mt-1">Yangi xabarlar shu yerda chiqadi</p>
          </div>
        ) : (
          <div className="pt-3 pb-4">
            {notifications.map((notif) => (
              <NotifCard key={notif.id} notif={notif} />
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="relative">
      {/* Bell tugmasi */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl transition-all duration-200 ${
          isOpen ? 'bg-white/20 scale-95' : 'hover:bg-white/10 active:scale-90'
        }`}
        title="Bildirishnomalar"
      >
        <Bell className={`h-5 w-5 transition-all ${
          unreadCount > 0 ? 'text-white' : 'text-blue-100'
        } ${isOpen ? '' : unreadCount > 0 ? 'animate-bell' : ''}`} />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 ${badgeColor} text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg ring-2 ring-white`}
            style={{ animation: 'notif-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* DESKTOP: dropdown panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 hidden md:block" onClick={() => setIsOpen(false)} />
          <div
            className="hidden md:flex absolute right-0 mt-2 w-[400px] bg-white rounded-2xl shadow-2xl z-50 overflow-hidden border border-gray-200 max-h-[600px] flex-col"
            style={{ animation: 'dropdown-in 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <PanelContent />
          </div>
        </>
      )}

      {/* MOBILE: fullscreen bottom drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            style={{ animation: 'fade-in 0.2s ease-out' }}
            onClick={() => setIsOpen(false)}
          />
          {/* Drawer */}
          <div
            className="relative bg-white rounded-t-3xl flex flex-col overflow-hidden"
            style={{
              maxHeight: '88vh',
              animation: 'slide-up 0.35s cubic-bezier(0.34,1.2,0.64,1)',
            }}
          >
            {/* Handle bar */}
            <div className="absolute top-0 left-0 right-0 flex justify-center pt-2.5 z-10 pointer-events-none">
              <div className="w-10 h-1 bg-white/40 rounded-full" />
            </div>
            <PanelContent />
          </div>
        </div>
      )}

      <style>{`
        @keyframes notif-pop {
          0% { transform: scale(0); opacity: 0; }
          65% { transform: scale(1.25); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes dropdown-in {
          from { opacity: 0; transform: translateY(-10px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes animate-bell {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(15deg); }
          30% { transform: rotate(-12deg); }
          45% { transform: rotate(8deg); }
          60% { transform: rotate(-5deg); }
          75% { transform: rotate(3deg); }
        }
        .animate-bell {
          animation: animate-bell 1s ease-in-out;
        }
      `}</style>
    </div>
  );
}
