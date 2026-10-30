/** Ilmiy ishlar (Google Scholar) — `ilmiy-ishlar` edge funksiyasi bilan ishlash. */
import { supabase } from './supabase';

export interface IlmiyIsh {
  id: string;
  slug: string;
  sarlavha: string;
  mualliflar: string[];
  annotatsiya: string;
  kalit_sozlar: string[];
  nashr_turi: 'maqola' | 'tezis' | 'dissertatsiya' | 'preprint';
  nashr_nomi: string | null;
  nashr_sanasi: string;
  til: 'uz' | 'ru' | 'en';
  pdf_path: string;
  scholar: boolean;
  huquq_tasdiq: boolean;
  holat: 'kutilmoqda' | 'tasdiqlangan' | 'rad';
  rad_sababi: string | null;
  created_at: string;
  ustoz_id: string;
  ustoz?: { full_name: string } | null;
}

export const NASHR_TURLARI: Record<IlmiyIsh['nashr_turi'], string> = {
  maqola: 'Ilmiy maqola',
  tezis: 'Konferensiya tezisi',
  dissertatsiya: 'Dissertatsiya / bitiruv ishi',
  preprint: 'Preprint',
};

export const HOLATLAR: Record<IlmiyIsh['holat'], string> = {
  kutilmoqda: 'Tekshiruvda',
  tasdiqlangan: 'Tasdiqlangan',
  rad: 'Rad etilgan',
};

export class ReloginError extends Error {}

/** Funksiyani chaqiradi; kutilgan xatoni Error qilib otadi. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ilmiyInvoke<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ilmiy-ishlar', { body });
  if (error) throw new Error("Server bilan bog'lanib bo'lmadi. Qayta urinib ko'ring.");
  if (data?.relogin) throw new ReloginError(data.error);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/** PDF'ni signed URL orqali to'g'ridan-to'g'ri omborga yuklaydi, yo'lini qaytaradi. */
export async function uploadIlmiyPdf(token: string, file: File, nom: string): Promise<string> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Faqat PDF fayl yuklang');
  const { path, token: uploadToken } = await ilmiyInvoke<{ path: string; token: string }>({ action: 'upload_url', token, size: file.size, nom });
  const { error } = await supabase.storage.from('blog-files').uploadToSignedUrl(path, uploadToken, file, { contentType: 'application/pdf' });
  if (error) throw new Error("PDF yuklanmadi: " + error.message);
  return path;
}

export const pdfPublicUrl = (slug: string) => `/ilmiy/${slug}.pdf`;
