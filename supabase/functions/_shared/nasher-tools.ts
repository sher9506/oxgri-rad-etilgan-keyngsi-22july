// NaSher vositalari: har javob oxirida doim ko'rinadigan 4 ta tugma (bot, sayt va Mini App bir xil ro'yxatni ishlatadi).
// Toza TypeScript, importlarsiz — sayt (Vite) ham, edge funksiya (Deno) ham to'g'ridan-to'g'ri import qiladi.

export interface ToolButton {
  tool: "aliment" | "boj" | "shablon" | "sud";
  text: string;
}

export const TOOL_BUTTONS: ToolButton[] = [
  { tool: "aliment", text: "👶 Aliment kalkulyatori" },
  { tool: "boj", text: "🧮 Davlat boji" },
  // { tool: "shablon", text: "📄 Ariza namunalari" },   // vaqtincha yashirin (egasining so'rovi); kod joyida, ?tool=shablon ishlaydi
  { tool: "sud", text: "🏛 Sud manzillari" },
];

/** Mini App havolasi uchun so'rov qismi: ?tool=… */
export const toolQuery = (b: Pick<ToolButton, "tool">) => "tool=" + b.tool;
