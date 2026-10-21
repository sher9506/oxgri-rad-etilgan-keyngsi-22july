import { useMemo, useState } from "react";
import { ChevronLeft, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import sudlar from "@/data/sudlar.json";

type Sud = { viloyat: string; tuman?: string; nomi: string; turi: string; manzil: string; telefon: string; manba: string };

const HAMMASI = "hammasi";
const viloyatlar = [...new Set((sudlar as Sud[]).map((s) => s.viloyat))];
// "tuman" can list several served districts, comma-separated (tumanlararo sudlar)
const tumanlari = (s: Sud) => (s.tuman ? s.tuman.split(", ") : []);

export default function SudManzillari({ onBack }: { onBack: () => void }) {
  const [viloyat, setViloyat] = useState(HAMMASI);
  const [tuman, setTuman] = useState(HAMMASI);
  const [qidiruv, setQidiruv] = useState("");

  const tumanlar = useMemo(
    () => [...new Set((sudlar as Sud[]).filter((s) => s.viloyat === viloyat).flatMap(tumanlari))].sort(),
    [viloyat],
  );

  const royxat = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    return (sudlar as Sud[]).filter(
      (s) => (viloyat === HAMMASI || s.viloyat === viloyat) &&
        (tuman === HAMMASI || tumanlari(s).includes(tuman)) &&
        (!q || s.nomi.toLowerCase().includes(q)),
    );
  }, [viloyat, tuman, qidiruv]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3 p-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Orqaga">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Sud manzillari</h1>
      </header>

      <Select value={viloyat} onValueChange={(v) => { setViloyat(v); setTuman(HAMMASI); }}>
        <SelectTrigger aria-label="Viloyat">
          <SelectValue placeholder="Viloyat" />
        </SelectTrigger>
        <SelectContent className="bg-white text-slate-900">
          <SelectItem className="focus:bg-slate-100" value={HAMMASI}>Barcha hududlar</SelectItem>
          {viloyatlar.map((v) => (
            <SelectItem className="focus:bg-slate-100" key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {viloyat !== HAMMASI && tumanlar.length > 0 && (
        <Select value={tuman} onValueChange={setTuman}>
          <SelectTrigger aria-label="Tuman">
            <SelectValue placeholder="Tuman" />
          </SelectTrigger>
          <SelectContent className="bg-white text-slate-900">
            <SelectItem className="focus:bg-slate-100" value={HAMMASI}>Barcha tumanlar</SelectItem>
            {tumanlar.map((t) => (
              <SelectItem className="focus:bg-slate-100" key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Input placeholder="Sud nomi bo'yicha qidirish" value={qidiruv} onChange={(e) => setQidiruv(e.target.value)} />

      <p className="text-xs text-slate-500">
        {royxat.length} ta sud · Ma'lumot: sud.uz, adolatapi1.sud.uz, 2026-10-22
      </p>

      {royxat.map((s) => (
        <Card key={s.manba + s.nomi}>
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-snug">{s.nomi}</p>
              <Badge variant="secondary" className="shrink-0">{s.turi}</Badge>
            </div>
            {s.tuman && <p className="text-xs text-slate-500">Hudud: {s.tuman}</p>}
            {s.manzil && (
              <p className="flex gap-2 text-slate-500">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />{s.manzil}
              </p>
            )}
            {/* oxiridagi ichki raqam "(01707)" tashlanadi, "(55)" kabi kod qoladi */}
            {s.telefon && (
              <a href={`tel:${s.telefon.replace(/\s*\([\d ,]+\)\s*$/, "").replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 text-blue-600">
                <Phone className="h-4 w-4 shrink-0" />{s.telefon}
              </a>
            )}
            <a href={s.manba} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 underline">
              Manba
            </a>
          </CardContent>
        </Card>
      ))}
      {royxat.length === 0 && <p className="text-center text-sm text-slate-500">Hech narsa topilmadi</p>}
    </div>
  );
}
