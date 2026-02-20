const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

const normalizeArabicLetters = (value: string) =>
  value
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه");

export const normalizeEffectDateKey = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const text = String(value ?? "").trim();
  if (!text) return "";

  const normalized = text
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[.]/g, "/")
    .replace(/\s+/g, "");

  const isoMatch = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const dmyMatch = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return "";
};

export const normalizeEffectTimeKey = (value: unknown): string => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const [h = "0", m = "0"] = text.split(":");
  const hour = Number(h);
  const minute = Number(m);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export const normalizeEffectType = (value: unknown): string => {
  const base = normalizeArabicLetters(String(value ?? ""))
    .replace(ARABIC_DIACRITICS, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) return "";

  const map: Record<string, string> = {
    "اذن صباحي": "اذن صباحي",
    "إذن صباحي": "اذن صباحي",
    "اذن مسائي": "اذن مسائي",
    "إذن مسائي": "اذن مسائي",
    "اذن": "اذن",
    "إذن": "اذن",
    "اذن عام": "اذن عام",
    "إذن عام": "اذن عام",
    "اجازه نصف يوم": "اجازة نصف يوم",
    "اجازة نصف يوم": "اجازة نصف يوم",
    "اجازه نص يوم": "اجازة نص يوم",
    "اجازة نص يوم": "اجازة نص يوم",
    "ماموريه": "مأمورية",
    "مأمورية": "مأمورية",
    "اجازه بالخصم": "اجازة بالخصم",
    "اجازة بالخصم": "اجازة بالخصم",
    "غياب بعذر": "غياب بعذر",
    "اجازه من الرصيد": "اجازة من الرصيد",
    "اجازة من الرصيد": "اجازة من الرصيد",
    "اجازه بدل": "اجازة بدل",
    "اجازة بدل": "اجازة بدل",
    "اجازه رسميه": "اجازة رسمية",
    "اجازة رسمية": "اجازة رسمية",
    "اجازه تحصيل": "اجازة تحصيل",
    "اجازة تحصيل": "اجازة تحصيل",
  };

  return map[base] || base;
};
