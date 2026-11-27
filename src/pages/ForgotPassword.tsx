import AuthBrandHeader from '@/components/auth/AuthBrandHeader';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WhatsappField, PasswordField } from '@/components/auth/WhatsappFields';
import { resetPassword } from '@/services/authService';
import { whatsappAuthRequest, normalizeWhatsapp, whatsappError } from '@/services/whatsappAuthService';
const ForgotPassword = () => {
  const [params] = useSearchParams();
  const [emailMode, setEmailMode] = useState(params.get('mode') === 'email');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const requestCode = async () => {
    const result = await whatsappAuthRequest('reset-password-whatsapp', { action: 'start', phone: normalizeWhatsapp(phone) });
    if (result.status !== 'code_sent' || !result.challenge_id) { setError(whatsappError(result.status)); return; }
    setChallengeId(result.challenge_id); setCode(''); setResendAt(Date.now() + 60000);
    setMessage('Se este WhatsApp tiver cadastro, você receberá um código válido por 10 minutos.');
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      if (emailMode) {
        await resetPassword(email);
        setMessage('Se este e-mail tiver cadastro, você receberá as instruções para redefinir sua senha.');
      } else if (!challengeId) await requestCode();
      else {
        if (password !== confirmPassword) { setError('As senhas não coincidem.'); return; }
        const result = await whatsappAuthRequest('reset-password-whatsapp', { action: 'verify', challenge_id: challengeId, code, password });
        if (result.status !== 'ok') { setError(whatsappError(result.status)); return; }
        setMessage('Senha alterada com sucesso! Entre com seu WhatsApp e a nova senha.'); setDone(true);
      }
    } catch { setError('Não foi possível concluir. Confira seus dados e tente novamente.'); }
    finally { setLoading(false); }
  };
  return <div className="min-h-screen flex items-center justify-center bg-muted p-4"><div className="w-full max-w-md bg-card text-card-foreground p-6 sm:p-8 rounded-lg shadow-md space-y-6"><AuthBrandHeader />
    <h1 className="text-2xl font-extrabold text-center">Esqueceu sua senha?</h1>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}
    {!done && <form onSubmit={submit} className="space-y-5">
      {emailMode ? <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" /></div> : <WhatsappField value={phone} onChange={setPhone} disabled={Boolean(challengeId)} />}
      {challengeId && !emailMode && <><div className="space-y-1.5"><Label htmlFor="code">Código de 4 dígitos</Label><Input id="code" required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></div><PasswordField label="Nova senha" value={password} onChange={setPassword} newPassword /><PasswordField id="password-confirm" label="Confirmar nova senha" value={confirmPassword} onChange={setConfirmPassword} newPassword /></>}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Aguarde...' : emailMode ? 'Enviar link de recuperação' : challengeId ? 'Salvar nova senha' : 'Enviar código pelo WhatsApp'}</Button>
      {challengeId && <div className="flex justify-between"><Button variant="link" type="button" disabled={loading} onClick={async () => { if (Date.now() < resendAt) { setError('Aguarde 1 minuto entre os envios.'); return; } setLoading(true); setError(''); try { await requestCode(); } catch { setError('Não foi possível reenviar o código.'); } finally { setLoading(false); } }}>Reenviar código</Button><Button variant="link" type="button" disabled={loading} onClick={() => { setChallengeId(undefined); setMessage(''); setError(''); }}>Alterar WhatsApp</Button></div>}
    </form>}
    {!done && <Button variant="link" className="w-full" onClick={() => { setEmailMode(v => !v); setChallengeId(undefined); setMessage(''); setError(''); }}>{emailMode ? 'Recuperar pelo WhatsApp' : 'Recuperar por e-mail'}</Button>}
    <div className="text-center"><Link to={emailMode ? '/login?mode=email' : '/login'} className="text-primary underline">Voltar para o Login</Link></div>
  </div></div>;
};
export default ForgotPassword;
