import AuthBrandHeader from '@/components/auth/AuthBrandHeader';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { WhatsappField, PasswordField } from '@/components/auth/WhatsappFields';
import { whatsappAuthRequest, applyWhatsappSession, normalizeWhatsapp, whatsappError } from '@/services/whatsappAuthService';
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/contexts/CartContext';
import { trackCheckoutRegisterCompleted } from '@/utils/trackingEvents';
const Register = () => {
  const location = useLocation();
  const prefill = (location.state || {}) as { phone?: string };
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(prefill.phone || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmEnabled, setConfirmEnabled] = useState(true);
  useEffect(() => {
    supabase.from('configuracoes').select('valor').eq('chave', 'signup_password_confirmation_enabled').maybeSingle()
      .then(({ data }) => { if (data?.valor === 'false') setConfirmEnabled(false); });
  }, []);
  const [error, setError] = useState('');
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [challengeId, setChallengeId] = useState<string | undefined>();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const loginPath = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';
  const navigate = useNavigate();
  const { toast } = useToast();
  const { cartItems } = useCart();
  const finish = async (result: Parameters<typeof applyWhatsappSession>[0]) => {
    await applyWhatsappSession(result);
    trackCheckoutRegisterCompleted(cartItems, cartItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0));
    toast({ title: 'Conta criada!', description: 'Bem-vindo!' });
    navigate(redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : '/');
  };
  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError(''); setExists(false); setCodeError('');
    if (confirmEnabled && password !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      const result = await whatsappAuthRequest('signup-whatsapp', { action: 'start', name, phone: normalizeWhatsapp(phone), password });
      if (result.status === 'ok') await finish(result);
      else if (result.status === 'code_sent' && result.challenge_id) {
        setChallengeId(result.challenge_id); setCode(''); setResendAt(Date.now() + 60000);
        toast({ title: 'Código enviado para seu WhatsApp' });
      } else { setExists(result.status === 'exists'); setError(whatsappError(result.status)); setCodeError(whatsappError(result.status)); }
    } catch { setError('Não foi possível criar a conta. Confira o WhatsApp e tente novamente.'); }
    finally { setLoading(false); }
  };
  const verify = async () => {
    if (!/^\d{4}$/.test(code)) { setCodeError('Digite o código de 4 dígitos.'); return; }
    setLoading(true); setCodeError('');
    try {
      const result = await whatsappAuthRequest('signup-whatsapp', { action: 'verify', challenge_id: challengeId, code, password });
      if (result.status === 'ok') await finish(result);
      else setCodeError(whatsappError(result.status));
    } catch { setCodeError('Não foi possível confirmar o código. Tente novamente.'); }
    finally { setLoading(false); }
  };
  return <div className="min-h-screen flex items-center justify-center bg-muted p-4"><div className="w-full max-w-md space-y-6 bg-card text-card-foreground p-6 sm:p-8 rounded-lg shadow-md"><AuthBrandHeader subtitle="Crie seu cadastro para pedir mais rápido" />
    <div className="text-center"><h1 className="text-3xl font-extrabold">Criar Conta</h1><p className="mt-2 text-sm text-muted-foreground">Ou <Link to={loginPath} className="font-medium text-primary underline">faça login com sua conta existente</Link></p></div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {exists && <Button asChild variant="outline" className="w-full"><Link to={loginPath} state={{ phone }}>Entrar</Link></Button>}
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5"><Label htmlFor="name">Nome</Label><Input id="name" autoComplete="name" minLength={2} maxLength={100} required placeholder="Seu nome completo" value={name} onChange={e => setName(e.target.value)} /></div>
      <WhatsappField value={phone} onChange={setPhone} />
      <PasswordField value={password} onChange={setPassword} newPassword />
      {confirmEnabled && <PasswordField id="password-confirm" label="Confirmar Senha" value={confirmPassword} onChange={setConfirmPassword} newPassword />}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Criando conta...' : 'Criar Conta'}</Button>
      <p className="text-xs text-center text-muted-foreground">Ao criar sua conta, você concorda com nossa <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline">Política de Privacidade</a>.</p>
    </form>
  </div><Dialog open={Boolean(challengeId)} onOpenChange={open => { if (!open && !loading) setChallengeId(undefined); }}><DialogContent><DialogHeader><DialogTitle>Confirme seu WhatsApp</DialogTitle><DialogDescription>Digite o código de 4 dígitos enviado para {phone}. Ele é válido por 10 minutos.</DialogDescription></DialogHeader><Input aria-label="Código de verificação" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className="text-center text-lg" />{codeError && <Alert variant="destructive"><AlertDescription>{codeError}</AlertDescription></Alert>}<DialogFooter className="gap-2"><Button variant="outline" disabled={loading} onClick={() => { if (Date.now() < resendAt) { setCodeError('Aguarde 1 minuto entre os envios.'); return; } void submit(); }}>Reenviar código</Button><Button disabled={loading} onClick={verify}>{loading ? 'Verificando...' : 'Confirmar código'}</Button></DialogFooter></DialogContent></Dialog></div>;
};
export default Register;
