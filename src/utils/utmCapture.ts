const UTM_STORAGE_KEY = 'utm_params';

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

/** Capture UTM params from URL and persist in sessionStorage */
export const captureUtmParams = (): void => {
  const params = new URLSearchParams(window.location.search);
  const utmKeys: (keyof UtmParams)[] = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  const utms: UtmParams = {};
  let hasAny = false;
  for (const key of utmKeys) {
    const val = params.get(key);
    if (val) {
      utms[key] = val;
      hasAny = true;
    }
  }

  // Only overwrite if we have new UTMs (preserve earlier ones if user navigates internally)
  if (hasAny) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utms));
  }
};

/** Retrieve stored UTM params */
export const getUtmParams = (): UtmParams => {
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
