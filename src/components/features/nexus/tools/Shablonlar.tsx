// Shablonlar — "Ariza namunalari" vositasi (Telegram Mini App)
import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SHABLONLAR, renderMatn, yuklabOlDocx, type Shablon } from './shablonlar-data';

export default function Shablonlar({ onBack }: { onBack: () => void }) {
  const [tanlangan, setTanlangan] = useState<Shablon | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [xabar, setXabar] = useState('');

  const ortga = () => (tanlangan ? (setTanlangan(null), setValues({}), setXabar('')) : onBack());

  const nusxala = async () => {
    if (!tanlangan) return;
    try {
      await navigator.clipboard.writeText(renderMatn(tanlangan, values));
      setXabar('Matn nusxalandi');
    } catch {
      setXabar("Nusxalab bo'lmadi — matnni qo'lda belgilab oling");
    }
  };

  const yukla = async () => {
    if (!tanlangan) return;
    try {
      await yuklabOlDocx(tanlangan, values);
      setXabar('Word fayli yuklandi');
    } catch (e) {
      console.error(e);
      setXabar("Word faylini yaratib bo'lmadi");
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={ortga} aria-label="Ortga">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Ariza namunalari</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Namuna. Vaziyatingizga moslang; zarur bo'lsa yurist bilan maslahatlashing.
      </p>

      {!tanlangan ? (
        <div className="space-y-3">
          {SHABLONLAR.map((sh) => (
            <Card key={sh.id} className="p-4 cursor-pointer active:bg-accent" onClick={() => setTanlangan(sh)}>
              <div className="font-medium">{sh.title}</div>
              <div className="text-sm text-muted-foreground">{sh.short}</div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-medium">{tanlangan.title}</h2>
          <div className="space-y-3">
            {tanlangan.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={f.key}>{f.label}</Label>
                {f.multiline ? (
                  <Textarea id={f.key} value={values[f.key] ?? ''} placeholder={f.placeholder}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                ) : (
                  <Input id={f.key} value={values[f.key] ?? ''} placeholder={f.placeholder}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={yukla} className="flex-1 bg-blue-600 text-white hover:bg-blue-700">Word (.docx) yuklab olish</Button>
            <Button onClick={nusxala} variant="outline" className="flex-1">Matnni nusxalash</Button>
          </div>
          {xabar && <p className="text-sm text-muted-foreground">{xabar}</p>}
          <Card className="p-4">
            <pre className="whitespace-pre-wrap font-serif text-sm">{renderMatn(tanlangan, values)}</pre>
          </Card>
        </div>
      )}
    </div>
  );
}
