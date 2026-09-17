import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function TezOradaSahifa({ sarlavha }: { sarlavha: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-8 py-14 shadow-[0_8px_30px_rgba(30,80,150,0.08)] sm:px-14">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-100/60 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-cyan-100/50 blur-2xl" />
        <div className="relative">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-lg shadow-blue-200">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{sarlavha}</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-500">
            Bu bo'lim hozirda ishlab chiqilmoqda. Tez orada foydalanishingizga taqdim etiladi.
          </p>
          <button
            onClick={() => navigate('/blog')}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[.99]"
          >
            <ArrowLeft className="h-4 w-4" /> Blogga qaytish
          </button>
        </div>
      </div>
    </div>
  );
}
