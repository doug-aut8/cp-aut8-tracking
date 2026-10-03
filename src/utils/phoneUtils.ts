// Utilitários de normalização e variações de telefone (BR)
export const phoneDigits = (raw?: string | null): string => {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
};

// Garante prefixo 55 nos dígitos (BR)
export const phoneDigitsBr = (raw?: string | null): string => {
  let d = phoneDigits(raw);
  if (!d) return "";
  if (!d.startsWith("55")) d = "55" + d;
  return d.slice(0, 13);
};

// Formata "+55 (DD) XXXXX-XXXX" / fixo "+55 (DD) XXXX-XXXX"
export const formatPhoneBr = (raw?: string | null): string => {
  const digits = phoneDigitsBr(raw);
  if (!digits) return "";
  const country = digits.slice(0, 2);
  const ddd = digits.slice(2, 4);
  const rest = digits.slice(4);
  let out = `+${country}`;
  if (ddd) out += ` (${ddd}`;
  if (ddd.length === 2) out += ")";
  if (rest.length > 0) {
    if (rest.length <= 4) out += ` ${rest}`;
    else if (rest.length <= 8) out += ` ${rest.slice(0, 4)}-${rest.slice(4)}`;
    else out += ` ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
  }
  return out;
};

// Gera todas as variantes possíveis para busca em bases legadas
export const phoneVariants = (raw?: string | null): string[] => {
  if (!raw) return [];
  const digits = phoneDigits(raw);
  if (!digits) return [];
  const withCc = digits.startsWith("55") ? digits : "55" + digits;
  const withoutCc = digits.startsWith("55") ? digits.slice(2) : digits;

  const variants = new Set<string>();
  variants.add(raw);                    // como veio
  variants.add(digits);                 // só dígitos
  variants.add(withCc);                 // 55 + DD + numero
  variants.add(withoutCc);              // DD + numero
  variants.add("+" + withCc);           // E.164: +5511...
  variants.add(formatPhoneBr(withCc));  // +55 (DD) XXXXX-XXXX
  // formato sem código país: (DD) XXXXX-XXXX
  if (withoutCc.length >= 10) {
    const dd = withoutCc.slice(0, 2);
    const rest = withoutCc.slice(2);
    if (rest.length === 9) variants.add(`(${dd}) ${rest.slice(0, 5)}-${rest.slice(5)}`);
    else if (rest.length === 8) variants.add(`(${dd}) ${rest.slice(0, 4)}-${rest.slice(4)}`);
  }
  return Array.from(variants).filter(Boolean);
};
