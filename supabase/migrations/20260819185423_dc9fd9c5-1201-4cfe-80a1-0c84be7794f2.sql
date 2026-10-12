ALTER TABLE public.fidelidade_progresso ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.fidelidade_progresso.user_id IS 'ID do usuário autenticado no Supabase Auth vinculado ao progresso de fidelidade';