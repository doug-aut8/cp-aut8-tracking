import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Store } from 'lucide-react';
import { useLayoutSettings } from '@/hooks/useLayoutSettings';

export default function AuthBrandHeader({ subtitle }: { subtitle?: string }) {
  const { settings } = useLayoutSettings();
  const [logoFailed, setLogoFailed] = useState(false);
  const nome = settings.empresa_nome?.trim() || 'nossa loja';
  const logo = settings.empresa_logo_url?.trim();
  return (
    <div className="flex items-center gap-3">
      <Link to="/" aria-label={`Voltar ao cardápio de ${nome}`} className="shrink-0">
        {logo && !logoFailed ? (
          <img src={logo} alt={nome} onError={() => setLogoFailed(true)} className="h-11 w-11 rounded-full object-cover border bg-background" />
        ) : (
          <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Store className="h-5 w-5" /></div>
        )}
      </Link>
      <div className="min-w-0 flex-1 text-left leading-tight">
        <p className="text-sm font-bold truncate">Bem-vindo a {nome}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="h-3 w-3" />Voltar ao cardápio</Link>
      </div>
    </div>
  );
}
