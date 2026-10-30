/**
 * Admin panel uchun `settings` jadvali — supabase.from('settings') bilan bir xil zanjir
 * (select/eq/in/maybeSingle/upsert/update/delete), lekin so'rov `admin-settings` edge
 * funksiyasi orqali admin kodi bilan bajariladi. Brauzer anon kaliti bilan maxfiy
 * qiymatlarni (tokenlar, API kalitlar) ko'ra olmaydi va settings'ga yoza olmaydi.
 */
import { supabase } from './supabase';

let adminCode = '';

/** Admin kodini serverda tekshiradi; to'g'ri bo'lsa shu sessiya uchun eslab qoladi. */
export async function verifyAdminCode(code: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('admin-settings', { body: { code, verify: true } });
  if (error || !data?.ok) return false;
  adminCode = code;
  return true;
}

/** Admin kodi talab qiladigan boshqa edge funksiyalarga yuborish uchun (kod faqat xotirada). */
export function withAdminCode<T extends object>(body: T): T & { code: string } {
  return { ...body, code: adminCode };
}

export function forgetAdminCode() {
  adminCode = '';
}

type Filter = ['eq' | 'in', string, unknown];
interface Query {
  op?: 'select' | 'upsert' | 'update' | 'delete';
  columns?: string;
  payload?: unknown;
  filters: Filter[];
  single?: 'maybe' | 'one';
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result = { data: any; error: { message: string } | null };

class SettingsQuery implements PromiseLike<Result> {
  private q: Query = { filters: [] };

  select(columns = '*') {
    if (!this.q.op) this.q.op = 'select';
    this.q.columns = columns;
    return this;
  }
  upsert(payload: unknown, _opts?: unknown) {
    this.q.op = 'upsert';
    this.q.payload = payload;
    return this;
  }
  update(payload: unknown) {
    this.q.op = 'update';
    this.q.payload = payload;
    return this;
  }
  delete() {
    this.q.op = 'delete';
    return this;
  }
  eq(column: string, value: unknown) {
    this.q.filters.push(['eq', column, value]);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.q.filters.push(['in', column, values]);
    return this;
  }
  maybeSingle() {
    this.q.single = 'maybe';
    return this;
  }
  single() {
    this.q.single = 'one';
    return this;
  }

  private async run(): Promise<Result> {
    if (!adminCode) return { data: null, error: { message: 'Admin sifatida kirilmagan' } };
    const { data, error } = await supabase.functions.invoke('admin-settings', { body: { code: adminCode, query: this.q } });
    if (error) {
      console.error('[adminSettings]', this.q.op, error.message);
      return { data: null, error: { message: error.message } };
    }
    return { data: data?.data ?? null, error: data?.error ?? null };
  }

  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/** `supabase.from('settings')` o'rniga admin panelda ishlatiladi. */
export const adminSettings = () => new SettingsQuery();
