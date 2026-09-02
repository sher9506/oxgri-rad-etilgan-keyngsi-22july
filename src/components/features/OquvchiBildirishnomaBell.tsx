import { useEffect, useRef, useCallback } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import NotificationBell from './NotificationBell';

interface OquvchiBildirishnomaBellProps {
  oquvchiIsm: string;
  oquvchiFamiliya: string;
  kurs?: string;
  guruh?: string;
  storageKey: string;
  onTestBoshlash?: (tur: 'toplam' | 'test', kod: string) => void;
}

// O'quvchi uchun databasedan bildirishnomalarni yuklovchi komponent
export default function OquvchiBildirishnomaBell({
  oquvchiIsm,
  oquvchiFamiliya,
  kurs,
  guruh,
  storageKey,
  onTestBoshlash,
}: OquvchiBildirishnomaBellProps) {
  const { addNotification, notifications } = useNotifications();
  const yuklangan = useRef<Set<string>>(new Set());

  // Dastlabki yuklangan IDlarni belgilash
  useEffect(() => {
    notifications.forEach(n => {
      if (n.data?.db_id) yuklangan.current.add(n.data.db_id);
    });
  }, []);

  const yuklash = useCallback(async () => {
    try {
      const oquvchiId = `${oquvchiIsm}|${oquvchiFamiliya}`;

      const { data, error } = await supabase
        .from('bildirishnomalar')
        .select('*')
        .eq('qabul_qiluvchi_tur', 'oquvchi')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) return;

      // Filterlash: ushbu o'quvchiga tegishli bildirishnomalar
      const tegishliBildirishnomalar = data.filter((b: any) => {
        // Barcha o'quvchilarga (hech qanday filter yo'q)
        if (!b.qabul_qiluvchi_id && !b.filter_kurs && !b.filter_guruh) return true;
        // Muayyan talabaga
        if (b.qabul_qiluvchi_id === oquvchiId) return true;
        // Kursga mos (guruh filteri yo'q)
        if (b.filter_kurs && b.filter_kurs === kurs && !b.filter_guruh) return true;
        // Kurs + guruhga mos
        if (b.filter_kurs && b.filter_kurs === kurs && b.filter_guruh && b.filter_guruh === guruh) return true;
        return false;
      });

      tegishliBildirishnomalar.forEach((b: any) => {
        if (!yuklangan.current.has(b.id)) {
          yuklangan.current.add(b.id);

          // META ma'lumotni ajratib olish
          let matn = b.matn || '';
          let meta: { tur?: 'toplam' | 'test'; kod?: string } | null = null;
          const metaIndex = matn.indexOf('||META:');
          if (metaIndex !== -1) {
            try {
              meta = JSON.parse(matn.slice(metaIndex + 7));
              matn = matn.slice(0, metaIndex);
            } catch (e) {
              // meta parse xatosi — davom etamiz
            }
          }

          addNotification({
            type: b.tur === 'muhim' ? 'muhim' : b.tur === 'ogohlantirish' ? 'warning' : 'info',
            title: b.sarlavha,
            message: matn,
            data: {
              db_id: b.id,
              ...(meta ? { actionTur: meta.tur, actionKod: meta.kod } : {}),
            },
          });
        }
      });
    } catch (e) {
      console.error("O'quvchi bildirishnomalar xatosi:", e);
    }
  }, [oquvchiIsm, oquvchiFamiliya, kurs, guruh]);

  useEffect(() => {
    yuklash();
    // 8 soniyada bir yangilash — sahifa yangilanmasdan real-time his qildiradi
    const interval = setInterval(yuklash, 8000);
    return () => clearInterval(interval);
  }, [yuklash]);

  return (
    <NotificationBell
      colorScheme="green"
      onActionClick={onTestBoshlash}
    />
  );
}
