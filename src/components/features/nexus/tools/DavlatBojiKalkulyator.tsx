import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Manba: "Davlat boji to'g'risida"gi Qonun (O'RQ-600, 06.01.2020), Ilova, 1-band
// (fuqarolik ishlari bo'yicha sudlar). lex.uz: https://lex.uz/uz/docs/-4680944
const ASOS = "https://lex.uz/uz/docs/-4680944#-8113528";
// BHM: 2026-yil 1-sentabrdan 440 000 so'm (lex.uz/bhm, 22.10.2026 holatiga).
const BHM_DEFAULT = 440_000;

type Tur = "mulkiy" | "nomulkiy" | "nikoh" | "apellyatsiya" | "kassatsiya";

const TURLAR: { id: Tur; nom: string }[] = [
  { id: "mulkiy", nom: "Mulkiy da'vo" },
  { id: "nomulkiy", nom: "Nomulkiy da'vo" },
  { id: "nikoh", nom: "Nikohdan ajratish" },
  { id: "apellyatsiya", nom: "Apellyatsiya shikoyati" },
  { id: "kassatsiya", nom: "Kassatsiya shikoyati" },
];

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

/** Birinchi instansiya boji: mulkiy — 4%, lekin 1 BHM dan kam emas; nomulkiy — 2 BHM. */
function asosiyBoj(summa: number, bhm: number) {
  return summa > 0
    ? { boj: Math.max(summa * 0.04, bhm), band: "a", qoida: "da'vo bahosining 4 foizi, lekin 1 BHM dan kam emas" }
    : { boj: 2 * bhm, band: "e", qoida: "2 BHM (nomulkiy da'vo)" };
}

export function hisobla(tur: Tur, summa: number, bhm: number) {
  if (tur === "nikoh") return { boj: 2 * bhm, qoida: "2 BHM (Ilova, 1-band, «v»)" };
  const asos = asosiyBoj(tur === "nomulkiy" ? 0 : summa, bhm);
  if (tur === "mulkiy" || tur === "nomulkiy")
    return { boj: asos.boj, qoida: `${asos.qoida} (Ilova, 1-band, «${asos.band}»)` };
  return {
    boj: asos.boj / 2,
    qoida: `ariza berishda to'lanadigan stavkaning 50 foizi — ${asos.qoida} (Ilova, 1-band, «z»)`,
  };
}

export default function DavlatBojiKalkulyator({ onBack }: { onBack: () => void }) {
  const [tur, setTur] = useState<Tur>("mulkiy");
  const [summa, setSumma] = useState("");
  const [bhm, setBhm] = useState(String(BHM_DEFAULT));

  const summaNum = Number(summa.replace(/\D/g, ""));
  const bhmNum = Number(bhm.replace(/\D/g, ""));
  const summaKerak = tur === "mulkiy" || tur === "apellyatsiya" || tur === "kassatsiya";
  const tayyor = bhmNum > 0 && (tur !== "mulkiy" || summaNum > 0);
  const natija = tayyor ? hisobla(tur, summaNum, bhmNum) : null;

  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Orqaga">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Davlat boji kalkulyatori</h1>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>Ish turi</Label>
            <Select value={tur} onValueChange={(v) => setTur(v as Tur)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TURLAR.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {summaKerak && (
            <div className="space-y-2">
              <Label htmlFor="summa">
                Da'vo summasi (so'm){tur !== "mulkiy" && " — nomulkiy nizo bo'lsa bo'sh qoldiring"}
              </Label>
              <Input
                id="summa"
                inputMode="numeric"
                placeholder="0"
                value={summaNum ? fmt(summaNum) : ""}
                onChange={(e) => setSumma(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bhm">BHM (so'm)</Label>
            <Input
              id="bhm"
              inputMode="numeric"
              value={bhmNum ? fmt(bhmNum) : ""}
              onChange={(e) => setBhm(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">2026-yil 1-sentabrdan 440 000 so'm</p>
          </div>
        </CardContent>
      </Card>

      {natija && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p className="text-sm text-muted-foreground">Davlat boji</p>
            <p className="text-2xl font-bold">{fmt(natija.boj)} so'm</p>
            <p className="text-sm">Qoida: {natija.qoida}</p>
            <a href={ASOS} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
              Asos: O'RQ-600, Ilova, 1-band (lex.uz)
            </a>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">Taxminiy hisob. Imtiyozlar hisobga olinmagan.</p>
    </div>
  );
}
