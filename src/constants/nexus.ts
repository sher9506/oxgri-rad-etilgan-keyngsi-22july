export const AI_NAME = "Nexus AI";
export const AI_TAGLINE = "Huquqiy savollar uchun AI yordamchi";
export const AI_SHORT = "Nexus AI";
export const MIN_CHAT_INPUT = 10;
export const MAX_CHAT_INPUT = 2500;
export const MAX_ACTIVE_CHATS = 15;
export const MAX_EXPIRED_CHATS = 30;

export const SAMPLE_QUESTIONS = [
  "Mehnat shartnomasini bekor qilish tartibi qanday?",
  "Ijara shartnomasining majburiy shartlari qanday?",
  "Da'vo muddati qachondan boshlanadi?",
  "Ish beruvchining javobgarligi qanday?",
];

export const NEXUS_NOTES = {
  NO_MEMORY: "Har savol alohida ko'rib chiqiladi, oldingi javoblar eslab qolinmaydi",
  DISCLAIMER: "Javob ma'lumot uchun va rasmiy yuridik maslahat o'rnini bosmaydi.",
  LOCAL_ONLY: "Suhbat tarixi hisobingizda saqlanadi",
  COLD_START: "Birinchi javob biroz kechikishi mumkin",
  MEMORY_ACTIVE: "Suhbat 5 soat davomida oldingi savollaringizni eslab qoladi",
  MEMORY_COLD: "Birinchi savoldan boshlab suhbat 5 soat davomida eslab qolinadi",
  MEMORY_EXPIRED_NOTE: "Bu suhbat xotirasi tugagan, faqat o'qish mumkin",
  MEMORY_EXPIRED_DIVIDER: "Bu suhbatning 5 soatlik xotirasi tugadi. Davom etish uchun yangi chat boshlang.",
  TIMER_POPOVER_TITLE: "Nega 5 soat?",
  TIMER_POPOVER_TEXT:
    "Bu suhbat 5 soat davomida oldingi savol va javoblaringizni eslab qoladi. Har bir suhbat uchun alohida xotira maydoni ajratiladi, bu cheklangan resurs, shuning uchun u 5 soatdan keyin tozalanadi. Muddat birinchi savoldan boshlanadi va uzaytirilmaydi. Tugagach suhbatni faqat o'qish mumkin, yangi savol yuborib bo'lmaydi. Davom etish uchun yangi chat oching. Bir vaqtda 15 tagacha faol suhbat ochish mumkin.",
  BANNER_WARNING: "Xotira {time} dan keyin tozalanadi.",
  CHAT_LIMIT_MSG: "Faol suhbatlar soni 15 taga yetdi. Birortasi tugashini kuting yoki eskisini o'chiring.",
  CHAT_LIST_TITLE: "Suhbatlar",
  NEW_CHAT: "Yangi chat",
  ACTIVE_CHATS: "Faol suhbatlar",
  EXPIRED_CHATS: "Muddati tugagan",
  EMPTY_CHATS: "Hali suhbat yo'q",
  DELETE_CONFIRM: "O'chirish?",
  DELETE_YES: "Ha, o'chirish",
  DELETE_CANCEL: "Bekor qilish",
  LIMIT_TOOLTIP: "Faol suhbatlar limiti 15 ga yetdi. Eskisini o'chiring yoki tugashini kuting.",
  EXPIRED_PLACEHOLDER: "Chat vaqti tugadi. Yangi chat oching",
  EXPIRED_COMPOSER_TITLE: "Bu chatning vaqti tugadi",
  EXPIRED_COMPOSER_TEXT: "Har bir chat xotirasi 5 soat ishlaydi. Bu chatniki tugadi, shuning uchun AI endi oldingi savollaringizni eslay olmaydi va bu yerga yangi savol yozib bo'lmaydi. Eski javoblarni o'qishingiz mumkin. Yangi savol berish uchun yangi chat oching.",
  EXPIRED_NEW_CHAT_BTN: "Yangi chat boshlash",
  EXPIRED_LIMIT_TEXT: "Faol suhbatlar soni 15 taga yetgan. Yangi chat ochish uchun avval eski suhbatni o'chiring.",
  OTHER_DEVICE_HINT: "Boshqa qurilmadagi faol suhbatlar ham hisobga olinadi",
};
