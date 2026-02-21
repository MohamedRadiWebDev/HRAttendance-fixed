const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const EXT_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g;
const INVISIBLE_CHARS = /[\u200B-\u200D\uFEFF\u2060]/g;

const toAsciiDigit = (char: string) => {
  const code = char.charCodeAt(0);
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
  if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
  return char;
};

export const normalizeEmployeeCode = (value: unknown) => {
  const raw = String(value ?? "");
  if (!raw) return "";
  return raw
    .replace(INVISIBLE_CHARS, "")
    .replace(ARABIC_INDIC_DIGITS, toAsciiDigit)
    .replace(EXT_ARABIC_INDIC_DIGITS, toAsciiDigit)
    .trim();
};
