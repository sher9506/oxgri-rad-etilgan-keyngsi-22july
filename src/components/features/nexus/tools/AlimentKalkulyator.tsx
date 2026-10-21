import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Oila kodeksi 99-modda (lex.uz/docs/104720, element id 159206): 1 bola — 1/4, 2 bola — 1/3, 3+ — 1/2.
const SHARES = [
  { kids: 1, label: '1', num: 1, den: 4 },
  { kids: 2, label: '2', num: 1, den: 3 },
  { kids: 3, label: '3+', num: 1, den: 2 },
] as const;

const LEX = 'https://lex.uz/docs/104720';
const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(n).replace(/ /g, ' ');

export function alimentSum(income: number, kids: number) {
  const s = SHARES[Math.min(kids, 3) - 1];
  return Math.round((income * s.num) / s.den);
}

export default function AlimentKalkulyator({ onBack }: { onBack: () => void }) {
  const [kids, setKids] = useState<1 | 2 | 3>(1);
  const [income, setIncome] = useState(0);
  const [unknown, setUnknown] = useState(false);

  const share = SHARES[kids - 1];
  const result = alimentSum(income, kids);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Orqaga">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Aliment kalkulyatori</h1>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>Bolalar soni</Label>
            <div className="grid grid-cols-3 gap-2">
              {SHARES.map((s) => (
                <Button
                  key={s.kids}
                  type="button"
                  variant="outline"
                  className={kids === s.kids ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white' : ''}
                  onClick={() => setKids(s.kids)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="income">Ota/onaning oylik daromadi (so'm)</Label>
            <Input
              id="income"
              inputMode="numeric"
              placeholder="masalan, 5 000 000"
              disabled={unknown}
              value={income ? fmt(income) : ''}
              onChange={(e) => setIncome(Number(e.target.value.replace(/\D/g, '').slice(0, 12)))}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="unknown" checked={unknown} onCheckedChange={(v) => setUnknown(v === true)} />
            <Label htmlFor="unknown" className="font-normal">Daromad noma'lum / ishlamaydi</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-6">
          {unknown ? (
            <p className="text-sm">
              Daromad rasman yo'q yoki o'zgaruvchan bo'lsa, sud alimentni ulush emas, har oy to'lanadigan{' '}
              <b>qat'iy pul summasida</b> belgilashi mumkin (Oila kodeksi 102-modda). Shunda ham har bir bola
              uchun summa eng kam ish haqining 26,5 foizidan kam bo'lmasligi kerak (99-modda).
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Formula: {fmt(income)} × {share.num}/{share.den}
              </p>
              <p className="text-3xl font-bold">{fmt(result)} so'm</p>
              <p className="text-sm text-slate-500">
                oyiga — daromadning {share.num}/{share.den} qismi
              </p>
            </>
          )}
          <p className="text-xs text-slate-500">Taxminiy hisob. Aniq summani sud belgilaydi.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-6 text-xs text-slate-500">
          <p className="font-medium text-foreground">Asos</p>
          <p>
            <a className="underline" href={`${LEX}#159203`} target="_blank" rel="noopener noreferrer">
              Oila kodeksi 99-modda
            </a>
            : «...aliment sud tomonidan ota-onaning har oydagi ish haqi va (yoki) boshqa daromadining bir bola
            uchun — to'rtdan bir qismi; ikki bola uchun — uchdan bir qismi; uch va undan ortiq bola uchun — yarmisi
            miqdorida undiriladi. Bu to'lovlarning miqdori ... sud tomonidan kamaytirilishi yoki ko'paytirilishi
            mumkin.» Har bir bola uchun summa eng kam ish haqining 26,5 % idan kam bo'lmasligi kerak.
          </p>
          <p>
            <a className="underline" href={`${LEX}#159222`} target="_blank" rel="noopener noreferrer">
              102-modda
            </a>
            : daromad doimiy bo'lmasa yoki rasman ish haqi bo'lmasa, aliment har oy to'lanadigan qat'iy summada
            belgilanishi mumkin.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
