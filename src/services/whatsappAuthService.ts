import { supabase } from '@/integrations/supabase/client';
import { normalizeWhatsapp } from '../../supabase/functions/_shared/whatsappIdentity';
export { isInternalEmail, normalizeWhatsapp } from '../../supabase/functions/_shared/whatsappIdentity';
export type WhatsappResult = { status: string; challenge_id?: string; access_token?: string; refresh_token?: string };
export async function whatsappAuthRequest(functionName: 'login-whatsapp' | 'signup-whatsapp' | 'reset-password-whatsapp', body: Record<string, unknown>): Promise<WhatsappResult> {
  const { data, error } = await supabase.functions.invoke<WhatsappResult>(functionName, { body });
  if (error) {
    if ('context' in error && error.context instanceof Response) {
      const failure = await error.context.json().catch(() => null);
      if (failure?.status) return failure;
    }
    throw new Error('Não foi possível conectar. Tente novamente.');
  }
  if (!data?.status) throw new Error('Não foi possível processar sua solicitação.');
  return data;
}
export async function applyWhatsappSession(result: WhatsappResult) {
  if (result.status !== 'ok' || !result.access_token || !result.refresh_token) throw new Error('Não foi possível entrar na conta.');
  const { error } = await supabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
  if (error) throw error;
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) throw new Error('Não foi possível confirmar sua entrada.');
  return data.user;
}
export async function signInWhatsapp(phone: string, password: string) {
  return whatsappAuthRequest('login-whatsapp', { phone: normalizeWhatsapp(phone), password });
}
export function whatsappError(status: string) {
  switch (status) {
    case 'invalid_input': return 'Informe um WhatsApp válido com DDD e confira a senha (6 a 72 caracteres).';
    case 'duplicate': return 'Há mais de um cadastro com este WhatsApp. Fale com a loja para regularizar o acesso.';
    case 'not_found': return 'Não encontramos cadastro com este WhatsApp.';
    case 'delivery_error': return 'Não foi possível enviar o código pelo WhatsApp. Tente novamente ou fale com a loja.';
    case 'configuration_error': return 'O acesso por WhatsApp está temporariamente indisponível. Fale com a loja.';
    case 'exists': return 'Este WhatsApp já tem cadastro.';
    case 'wrong_password': return 'Senha incorreta. Confira e tente novamente ou toque em “Esqueceu sua senha?”.';
    case 'invalid_code': return 'Código inválido ou expirado. Solicite outro código se necessário.';
    case 'rate_limited': return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
    default: return 'Não foi possível concluir. Tente novamente ou fale com a loja.';
  }
}
