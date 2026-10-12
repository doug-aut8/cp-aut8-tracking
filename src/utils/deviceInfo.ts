/** Dados leves do dispositivo do visitante (sem bibliotecas externas). */
export interface DeviceInfo {
  device_type: "mobile" | "tablet" | "desktop";
  os: string;
  browser: string;
}

let cached: DeviceInfo | null = null;

export const getDeviceInfo = (): DeviceInfo => {
  if (cached) return cached;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIPadOS = /Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1;
  const tablet = isIPadOS || /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua);

  let os = "Outro";
  if (/iPhone|iPad|iPod/.test(ua) || isIPadOS) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Outro";
  if (/Instagram/i.test(ua)) browser = "Instagram";
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) browser = "Facebook";
  else if (/WhatsApp/i.test(ua)) browser = "WhatsApp";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Firefox|FxiOS/.test(ua)) browser = "Firefox";
  else if (/Chrome|CriOS/.test(ua)) browser = "Chrome";
  else if (/Safari/.test(ua)) browser = "Safari";

  cached = { device_type: tablet ? "tablet" : mobile ? "mobile" : "desktop", os, browser };
  return cached;
};
