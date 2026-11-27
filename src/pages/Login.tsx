import AuthBrandHeader from '@/components/auth/AuthBrandHeader';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { trackCheckoutLoginCompleted } from '@/utils/trackingEvents';
import EmailDomainShortcuts from '@/components/auth/EmailDomainShortcuts';
import { WhatsappField, PasswordField } from '@/components/auth/WhatsappFields';
import { signInWhatsapp, applyWhatsappSession, whatsappError } from '@/services/whatsappAuthService';

const Login = () => {
  const [params] = useSearchParams();
  const location = useLocation();
  const [emailMode, setEmailMode] = useState(params.get('mode') === 'email');
  const [phone, setPhone] = useState((location.state as { phone?: string } | null)?.phone || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { cartItems } = useCart();
  const navigate = useNavigate();
  const redirect = params.get('redirect');
  const registerPath = redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register';
  const { toast } = useToast();

  const switchToEmail = (prefill = '') => { setEmailMode(true); setEmail(prefill); setError(''); setNotFound(false); };
  const handlePhoneChange = (value: string) => {
    if (value.includes('@')) { switchToEmail(value.trim()); return; }
    setPhone(value);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setNotFound(false); setLoading(true);
    try {
      let user;
      if (emailMode) {
        user = (await signIn(email.trim(), password)).data.user;
      } else {
        const result = await signInWhatsapp(phone, password);
        if (result.status !== 'ok') {
          setNotFound(result.status === 'not_found');
          setError(whatsappError(result.status));
          return;
        }
        user = await applyWhatsappSession(result);
      }
      if (!user) throw new Error('Não foi possível confirmar sua entrada.');
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      const isAdmin = roles?.some(row => row.role === 'admin' || row.role === 'super-admin');
      trackCheckoutLoginCompleted(cartItems, cartItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0));
      if (!emailMode) toast({ title: 'Login realizado com sucesso', description: 'Bem-vindo!' });
      navigate(redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : isAdmin ? '/admin-dashboard' : '/');
    } catch {
      setError(emailMode ? 'Não foi possível entrar. Confira seu e-mail e senha.' : 'Não foi possível entrar. Confira seu WhatsApp e senha e tente novamente.');
    } finally { setLoading(false); }
  };

  return <div className="min-h-screen flex flex-col items-center justify-center bg-muted p-4">
    <div className="w-full max-w-md space-y-5 bg-card text-card-foreground p-6 rounded-lg shadow-md">
<AuthBrandHeader />      <div className="border-2 rounded-lg border-primary bg-primary/10 p-3 text-center space-y-2">
        <h2 className="text-lg font-extrabold">Primeira vez pedindo por aqui?</h2>
        <Button asChild size="lg" className="w-full h-11 font-bold"><Link to={registerPath}>Criar meu cadastro agora</Link></Button>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>ou entre com sua conta</span><span className="h-px flex-1 bg-border" /></div>
      {!emailMode && <Alert className="border-primary/40 bg-primary/5 px-3 py-2 [&>svg]:left-3 [&>svg]:top-2.5 [&>svg~*]:pl-5"><Info className="h-3 w-3" /><AlertDescription className="space-y-0.5 text-[10px] leading-snug">
        <p><strong>Novidade para facilitar seus pedidos:</strong> agora o acesso é feito com seu número de <strong>WhatsApp</strong> e a mesma senha que você já usava com o e-mail.</p>
        <button type="button" className="font-medium text-primary underline" onClick={() => switchToEmail()}>Ainda prefere usar e-mail? Toque aqui</button>
      </AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {notFound && <Button asChild variant="outline" className="w-full"><Link to={registerPath} state={{ phone }}>Criar conta com este WhatsApp</Link></Button>}
      {notFound && <Button type="button" variant="ghost" className="w-full" onClick={() => switchToEmail()}>Já tinha conta com e-mail? Entrar com e-mail</Button>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        {emailMode ? <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" /><EmailDomainShortcuts value={email} onChange={setEmail} /></div> : <WhatsappField value={phone} onChange={handlePhoneChange} />}
        <PasswordField value={password} onChange={setPassword} />
        <Link to={emailMode ? '/forgot-password?mode=email' : '/forgot-password'} className="block text-sm font-medium text-primary underline">Esqueceu sua senha?</Link>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
      </form>
      <Button type="button" variant="link" className="w-full" disabled={loading} onClick={() => { setEmailMode(v => !v); setError(''); setNotFound(false); setPassword(''); }}>{emailMode ? 'Entrar com WhatsApp' : 'Entrar com e-mail'}</Button>
    </div>
  </div>;
};
export default Login;
