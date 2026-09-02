export interface QoshimchaMezon {
  shart: string;   // Ustoz shartlari matni
  ball: number;    // Qo'shiladigan yoki ayiriladigan ball
}

// Standart mezon sozlamasi (ustoz tomonidan yoqish/o'chirish + ball o'zgartirish)
export interface StandartMezonSozlama {
  id: string;          // Mezon identifikatori
  nom: string;         // Mezon nomi
  faol: boolean;       // Yoqilgan yoki o'chirilgan
  ball: number;        // Maksimal ball (o'zgartirish mumkin)
  asl_ball: number;    // Asl standart ball (qayta tiklash uchun)
}

export interface Kazus {
  kazus: string;
  javob: string;
  mezon_sozlamalar?: StandartMezonSozlama[]; // Standart mezonlar sozlamalari
  qoshimcha_mezonlar?: QoshimchaMezon[];      // Ixtiyoriy qo'shimcha mezonlar (max 5 ta)
}

export interface Toplam {
  id: string;
  kod: string;
  ustoz_ismi: string;
  ustoz_id?: string;
  mavzu?: string;
  kazuslar: Kazus[];
  vaqt_daqiqa?: number;
  created_at: string;
}

export interface OquvchiJavob {
  kazus_index: number;
  javob: string;
  aflotun_guruh?: boolean;
}

export interface XatoQism {
  xato: string;
  togri: string;
  tur: 'imlo' | 'mazmun';
}

export interface MaxsusMezonTahlil {
  nom: string;
  ball: number;
  maksimal: number;
  sabab: string;
}

export interface BatafilTahlil {
  mazmun_moslik_foiz: number;
  mazmun_ball: number;
  mazmun_izoh: string;
  maxsus_mezonlar: MaxsusMezonTahlil[];
  imlo_xatolar: XatoQism[];
  yetishmayotganlar: string[];
  umumiy_xulosa: string;
}

export interface BahoNatija {
  kazus_index: number;
  ball: number;
  izoh: string;
  batafsil_tahlil: BatafilTahlil;
}

export interface Javob {
  id: string;
  toplam_id: string;
  toplam_kod: string;
  oquvchi_ismi: string;
  javoblar: OquvchiJavob[];
  baho: BahoNatija[];
  created_at: string;
}
