const toArabicDigitsNormalized = (value: string) => value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

const toHHmm = (hours: number, minutes: number) => `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

const fromExcelFraction = (fraction: number) => {
  const normalized = ((fraction % 1) + 1) % 1;
  const totalMinutes = Math.round(normalized * 24 * 60) % (24 * 60);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
};

export const parseTimeCell = (value: unknown): { ok: true; timeHHmm: string } | { ok: false; reason: string } => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { ok: false, reason: "القيمة فارغة" };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const fraction = value > 1 ? value % 1 : value;
    const { hours, minutes } = fromExcelFraction(fraction);
    return { ok: true, timeHHmm: toHHmm(hours, minutes) };
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { ok: true, timeHHmm: toHHmm(value.getHours(), value.getMinutes()) };
  }

  let text = toArabicDigitsNormalized(String(value)).trim();
  if (!text) return { ok: false, reason: "القيمة فارغة" };

  const hasPM = /(pm|p\.m|م|مساء)/i.test(text);
  const hasAM = /(am|a\.m|ص|صباح)/i.test(text);
  text = text
    .replace(/(pm|p\.m|am|a\.m|مساء|صباح|ص|م)/gi, "")
    .replace(/\./g, ":")
    .replace(/\s+/g, "")
    .trim();

  const parts = text.split(":").filter(Boolean);
  if (parts.length === 1 && /^\d+$/.test(parts[0])) {
    const h = Number(parts[0]);
    if (h < 0 || h > 23) return { ok: false, reason: "ساعة غير صالحة" };
    return { ok: true, timeHHmm: toHHmm(h, 0) };
  }

  if (parts.length >= 2) {
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return { ok: false, reason: "تنسيق وقت غير صالح" };

    let h = hour;
    if (hasPM && h < 12) h += 12;
    if (hasAM && h === 12) h = 0;

    if (h < 0 || h > 23 || minute < 0 || minute > 59) return { ok: false, reason: "وقت غير صالح" };
    return { ok: true, timeHHmm: toHHmm(h, minute) };
  }

  return { ok: false, reason: "تنسيق وقت غير معروف" };
};
