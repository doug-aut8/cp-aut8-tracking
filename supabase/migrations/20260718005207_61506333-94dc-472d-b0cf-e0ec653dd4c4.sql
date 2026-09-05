
-- Remover duplicatas por email (mantém o registro mais recente)
DELETE FROM public.users a
USING public.users b
WHERE a.ctid < b.ctid
  AND LOWER(a.email) = LOWER(b.email)
  AND a.email IS NOT NULL;

-- Índice único case-insensitive por email
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
  ON public.users (LOWER(email))
  WHERE email IS NOT NULL;
