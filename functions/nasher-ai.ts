/**
 * Cloudflare Pages Function — /nasher-ai uchun SEO.
 *
 * Odam uchun: SPA (index.html) qaytadi va NaSher AI chati ochiladi.
 * Qidiruv tizimlari va AI qidiruvlar (JS ishlatmaydiganlar ham) uchun:
 * head'ga NaSher meta + JSON-LD, #root ichiga NaSher haqida matn qo'yiladi —
 * React yuklanganda bu matn chat bilan almashadi.
 */

const PAGE_URL = "https://fanfaster.uz/nasher-ai";
const TITLE = "NaSher AI — O'zbekiston qonunchiligi bo'yicha sun'iy intellekt huquqiy yordamchisi";
const DESCRIPTION =
  "NaSher AI — O'zbekiston qonunchiligi bo'yicha AI huquqiy yordamchi. Savolingizga lex.uz'dagi amaldagi qonun hujjatlari asosida, modda raqamlari va havolalari bilan javob beradi. Mualliflar: Azizov Nasimbek va Abdurashidov Sherzodbek.";
const OG_IMAGE = "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&h=630&fit=crop";

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "NaSher AI",
      alternateName: ["NaSher", "NaSher AI huquqiy yordamchi", "НаШер AI"],
      url: PAGE_URL,
      applicationCategory: "LegalService",
      operatingSystem: "Telegram, Web",
      inLanguage: ["uz", "ru"],
      description:
        "O'zbekiston qonunchiligi bo'yicha sun'iy intellekt huquqiy yordamchisi: savollarga lex.uz'dagi amaldagi qonun hujjatlari asosida, modda raqamlari va havolalari bilan javob beradi.",
      author: [
        { "@type": "Person", name: "Azizov Nasimbek" },
        { "@type": "Person", name: "Abdurashidov Sherzodbek" },
      ],
      offers: { "@type": "Offer", price: "0", priceCurrency: "UZS" },
      sameAs: ["https://t.me/NaSheraibot", "https://t.me/fanfasteruz", "https://www.wikidata.org/wiki/Q141936185"],
      // Akademiya yangiligi NaSher haqida (u faqat botga havola beradi) — Google bot, sayt va yangilikni bitta loyiha deb bog'lasin.
      subjectOf: {
        "@type": "NewsArticle",
        headline: "Akademiya innovatsiyalari: NaSher AI huquqiy yordamchi boti",
        url: "https://proacademy.uz/uz-lat/news/view?alias=3238",
        publisher: { "@type": "EducationalOrganization", name: "O'zbekiston Respublikasi Huquqni muhofaza qilish akademiyasi", url: "https://proacademy.uz" },
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        ["NaSher AI nima?", "NaSher AI — O'zbekiston qonunchiligi bo'yicha sun'iy intellekt huquqiy yordamchisi. U savolga lex.uz'dagi amaldagi qonun hujjatlari asosida javob beradi va har bir moddaga havola qo'yadi."],
        ["NaSher AI'ni kim yaratgan?", "NaSher AI mualliflari — Azizov Nasimbek va Abdurashidov Sherzodbek."],
        ["NaSher AI'dan qanday foydalanish mumkin?", "fanfaster.uz/nasher-ai sahifasida yoki Telegram'da @NaSheraibot botiga savolingizni yozing."],
        ["NaSher AI pullikmi?", "Yo'q, NaSher AI bepul. Savollar soniga vaqtinchalik limit qo'yilgan."],
      ].map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ],
};

const HEAD = `    <title>${TITLE}</title>
    <link rel="canonical" href="${PAGE_URL}" />
    <meta name="description" content="${DESCRIPTION}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${PAGE_URL}" />
    <meta property="og:title" content="NaSher AI — sun'iy intellekt huquqiy yordamchisi" />
    <meta property="og:description" content="${DESCRIPTION}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:locale" content="uz_UZ" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="NaSher AI — sun'iy intellekt huquqiy yordamchisi" />
    <meta name="twitter:description" content="${DESCRIPTION}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    <script type="application/ld+json">${JSON.stringify(JSON_LD).replace(/</g, "\\u003c")}</script>
  `;

// React yuklanguncha ko'rinadigan va JS ishlatmaydigan botlar o'qiydigan matn.
const BODY = `<div style="max-width:760px;margin:0 auto;padding:28px 16px;font:17px/1.6 system-ui,sans-serif;color:#1f2328">
<h1 style="color:#1d5c4a">NaSher AI — sun'iy intellekt huquqiy yordamchisi</h1>
<p>NaSher AI O'zbekiston qonunchiligi bo'yicha savollaringizga javob beradi. Javob lex.uz'dagi amaldagi qonun hujjatlariga tayanadi va har bir moddaga havola qo'yiladi, shuning uchun uni o'zingiz tekshira olasiz.</p>
<p><a href="https://t.me/NaSheraibot">Telegram'da savol berish — @NaSheraibot</a> · Bepul. 1 200 dan ortiq kishi foydalangan.</p>
<h2>NaSher AI nima qila oladi</h2>
<ul>
<li>Huquqiy savolga javob — mehnat, oila, meros, uy-joy, jinoyat, ma'muriy va boshqa sohalar bo'yicha.</li>
<li>Modda raqami va havola — Konstitutsiya, kodekslar, qonunlar va Oliy sud Plenumi qarorlaridan aniq modda yoki band ko'rsatiladi.</li>
<li>Kazus tahlili — talabalar uchun vaziyatni qonun asosida tahlil qilib beradi.</li>
<li>Ovozli savol — savolni Telegram'da ovozli xabar bilan yuborish mumkin.</li>
<li>Vositalar — aliment va davlat boji kalkulyatorlari, sud manzillari.</li>
<li>Ikki til — o'zbekcha va ruscha savollarga javob beradi.</li>
</ul>
<h2>Mualliflar</h2>
<p>NaSher AI mualliflari — Azizov Nasimbek va Abdurashidov Sherzodbek. Loyiha Huquqni muhofaza qilish akademiyasida tanishtirilgan: <a href="https://proacademy.uz/uz-lat/news/view?alias=3238">«Akademiya innovatsiyalari: NaSher AI huquqiy yordamchi boti»</a>.</p>
<h2>Ko'p beriladigan savollar</h2>
<p><b>NaSher AI pullikmi?</b> Yo'q, bepul. Savollar soniga vaqtinchalik limit qo'yilgan.</p>
<p><b>Javob qanchalik ishonchli?</b> NaSher AI javobni amaldagi qonun hujjatlari asosida yozadi va moddaga havola beradi. Muhim qaror qabul qilishdan oldin moddani lex.uz'da tekshiring yoki yurist bilan maslahatlashing.</p>
<p>NaSher AI — <a href="https://fanfaster.uz/">FanFaster</a> platformasining huquqiy yordamchisi. Telegram kanal: <a href="https://t.me/fanfasteruz">@fanfasteruz</a>.</p>
</div>`;

export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const res = await env.ASSETS.fetch(new Request(new URL("/", url.origin).toString(), { headers: request.headers }));
  if (!res.ok) {
    console.error("[nasher-ai-seo] index.html olinmadi, status:", res.status);
    return env.ASSETS.fetch(request);
  }
  const html = (await res.text())
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name=["']description["'][^>]*>/i, "")
    .replace(/<meta\b[^>]*(?:og:|twitter:)[^>]*>/gi, "")
    .replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace("</head>", `${HEAD}</head>`)
    .replace(/(<main id="root">)(<\/main>)/, `$1${BODY}$2`);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};
