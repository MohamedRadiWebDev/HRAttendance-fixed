export const parseTimeToSeconds = (value: string) => {
  const [h = "0", m = "0", s = "0"] = String(value || "").split(":");
  const hh = Number(h);
  const mm = Number(m);
  const ss = Number(s);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return 0;
  return hh * 3600 + mm * 60 + ss;
};

export const secondsToTime = (seconds: number) => {
  const clamped = Math.max(0, Math.floor(seconds));
  const h = String(Math.floor(clamped / 3600)).padStart(2, "0");
  const m = String(Math.floor((clamped % 3600) / 60)).padStart(2, "0");
  const s = String(clamped % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

export const combineDateTime = (date: string, time: string) => `${date}T${secondsToTime(parseTimeToSeconds(time))}`;

const splitDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
};

const dateToDayIndex = (date: string) => {
  const { y, m, d } = splitDate(date);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};

const parseDateTime = (dateTime: string) => {
  const [date = "", time = "00:00:00"] = String(dateTime).split("T");
  return { day: dateToDayIndex(date), seconds: parseTimeToSeconds(time) };
};

export const diffHours = (dateTimeA: string, dateTimeB: string) => {
  const a = parseDateTime(dateTimeA);
  const b = parseDateTime(dateTimeB);
  return ((b.day - a.day) * 86400 + (b.seconds - a.seconds)) / 3600;
};
