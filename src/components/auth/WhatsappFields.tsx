import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
export function WhatsappField({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <div className="space-y-1.5"><Label htmlFor="whatsapp">WhatsApp</Label><PhoneInput id="whatsapp" international defaultCountry="BR" countryCallingCodeEditable={false} countries={['BR']} autoComplete="tel" required disabled={disabled} value={value ? (`+${value.replace(/\D/g, '')}` as import('react-phone-number-input').Value) : undefined} onChange={v => onChange(v || '')} placeholder="(11) 99999-9999" className="phone-input-field flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring" /></div>;
}
export function PasswordField({ id = 'password', label = 'Senha', value, onChange, newPassword = false }: { id?: string; label?: string; value: string; onChange: (value: string) => void; newPassword?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id={id} required minLength={newPassword ? 6 : undefined} maxLength={72} autoComplete={newPassword ? 'new-password' : 'current-password'} type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} className="pl-10 pr-12" placeholder="••••••••" /><Button variant="ghost" size="icon" type="button" aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} className="absolute right-0 top-0 h-10 w-10" onClick={() => setVisible(v => !v)}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>;
}
