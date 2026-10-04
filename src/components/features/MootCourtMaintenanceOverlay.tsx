import { Wrench, Clock, Scale } from 'lucide-react';

const MAINTENANCE_TEXT = 'Funksiyaga admin tomonidan o\'zgartirish kiritilmoqda. Tez orada yangi funksiyalar bilan qaytamiz.';

interface Props {
  visible: boolean;
}

/**
 * Butun ekranni qoplaydigan maintenance qatlami.
 * position: fixed, z-index: [9999], backdrop-filter blur(14px).
 * aria-modal="true", role="alertdialog", inert ostidagi kontentga.
 */
export default function MootCourtMaintenanceOverlay({ visible }: Props) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
      role="alertdialog"
      aria-modal="true"
      aria-label="Moot Court texnik ishlar rejimida"
    >
      {/* Yarim shaffof qorong'u fon */}
      <div className="absolute inset-0 bg-slate-900/70" />

      {/* Matn kartochkasi */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-white/10 p-8 md:p-10 text-center">
          {/* Ikona */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                <Wrench className="h-7 w-7 text-white" />
              </div>
            </div>
          </div>

          {/* Sarlavha */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Scale className="h-5 w-5 text-amber-400" />
            <h2 className="text-xl font-black text-white">Moot Court</h2>
          </div>

          {/* Xabar */}
          <p className="text-sm md:text-base text-slate-200 leading-relaxed">
            {MAINTENANCE_TEXT}
          </p>

          {/* Status */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mt-6 bg-white/5 rounded-full border border-white/10">
            <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-slate-300">Vaqtinchalik texnik ishlar</span>
          </div>

          <p className="text-[10px] text-slate-500 mt-5">Boshqa sahifalar to'liq ishlayveradi</p>
        </div>
      </div>
    </div>
  );
}
