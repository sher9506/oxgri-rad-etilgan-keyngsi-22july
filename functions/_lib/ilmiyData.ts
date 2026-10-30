/** Ilmiy ishlar — /ilmiy sahifalari va sitemap uchun (faqat tasdiqlanganlari, RLS shuni beradi). */
import { SUPABASE_URL, sb } from "./blogData";

export interface IlmiyIsh {
  slug: string;
  sarlavha: string;
  mualliflar: string[];
  annotatsiya: string;
  kalit_sozlar: string[];
  nashr_turi: string;
  nashr_nomi: string | null;
  nashr_sanasi: string;
  til: string;
  pdf_path: string;
  scholar: boolean;
  tasdiqlangan_at: string | null;
  updated_at: string;
}

const FIELDS = "slug,sarlavha,mualliflar,annotatsiya,kalit_sozlar,nashr_turi,nashr_nomi,nashr_sanasi,til,pdf_path,scholar,tasdiqlangan_at,updated_at";

export const fetchIlmiyIshlar = (env: Record<string, unknown>, filter = "") =>
  sb<IlmiyIsh>(`ilmiy_ishlar?holat=eq.tasdiqlangan${filter}&select=${FIELDS}&order=nashr_sanasi.desc`, env);

export const fetchIlmiyIsh = async (slug: string, env: Record<string, unknown>) =>
  (await fetchIlmiyIshlar(env, `&slug=eq.${encodeURIComponent(slug)}&limit=1`))[0] ?? null;

export const storagePdfUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/blog-files/${path}`;
