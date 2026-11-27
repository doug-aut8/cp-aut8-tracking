import AuthBrandHeader from '@/components/auth/AuthBrandHeader';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PasswordField } from '@/components/auth/WhatsappFields';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ResetPassword() {
  const { isPasswordRecovery } = useAuth();
  const [valid, setValid] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (active) { setValid(Boolean(isPasswordRecovery && data.user && !error)); setChecking(false); }
    }).catch(() => { if (active) { setValid(false); setChecking(false); } });
    return () => { active = false; };
  }, [isPasswordRecovery]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!valid) return;
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      await supabase.auth.signOut();
    } catch { setError('Não foi possível alterar a senha. Solicite um novo link e tente novamente.'); }
    finally { setLoading(false); }
  };
  return <div className="min-h-screen flex items-center justify-center bg-muted p-4"><div className="w-full max-w-md bg-card text-card-foreground p-6 rounded-lg shadow-md space-y-5"><AuthBrandHeader />
    <h1 className="text-2xl font-bold text-center">Redefinir senha</h1>
    {checking ? <p>Verificando link...</p> : done ? <Alert><AlertDescription>Senha alterada com sucesso.</AlertDescription></Alert> : !valid ? <Alert variant="destructive"><AlertDescription>Este link é inválido ou expirou. Solicite um novo link de recuperação.</AlertDescription></Alert> : <form onSubmit={submit} className="space-y-5">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <PasswordField label="Nova senha" value={password} onChange={setPassword} newPassword />
      <PasswordField id="confirm-password" label="Confirmar nova senha" value={confirm} onChange={setConfirm} newPassword />
      <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Salvando...' : 'Salvar nova senha'}</Button>
    </form>}
    {!checking && !valid && !done && <Button asChild variant="outline" className="w-full"><Link to="/forgot-password?mode=email">Solicitar novo link</Link></Button>}
    <Link to="/login?mode=email" className="block text-center text-primary underline">Voltar para o Login</Link>
  </div></div>;
}
