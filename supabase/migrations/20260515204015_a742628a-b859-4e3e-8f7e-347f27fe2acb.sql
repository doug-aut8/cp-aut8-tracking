INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super-admin'::public.app_role FROM auth.users WHERE email = 'dougmont68@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE role = 'user'::public.app_role
  AND user_id IN (SELECT id FROM auth.users WHERE email = 'dougmont68@gmail.com');