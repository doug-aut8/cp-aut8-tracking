import React from "react";

const DOMAINS = ["@gmail.com", "@hotmail.com", "@yahoo.com.br", "@outlook.com"];

export const completeEmail = (current: string, domain: string) => {
  const user = (current || "").split("@")[0].trim();
  return `${user}${domain}`;
};

const EmailDomainShortcuts: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Completar e-mail">
    {DOMAINS.map((d) => (
      <button
        key={d}
        type="button"
        onClick={() => onChange(completeEmail(value, d))}
        className="min-h-[28px] rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-xs font-medium text-foreground active:scale-95 hover:bg-primary/10"
      >
        {d}
      </button>
    ))}
  </div>
);

export default EmailDomainShortcuts;
