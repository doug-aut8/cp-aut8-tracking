DROP POLICY IF EXISTS "Anon insert access" ON storage.objects;
DROP POLICY IF EXISTS "Anon update access" ON storage.objects;
DROP POLICY IF EXISTS "Anon delete access" ON storage.objects;

CREATE POLICY "Admins can upload menu images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'imagens-cardapio' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update menu images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'imagens-cardapio' AND public.is_admin_or_super(auth.uid()))
WITH CHECK (bucket_id = 'imagens-cardapio' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can delete menu images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'imagens-cardapio' AND public.is_admin_or_super(auth.uid()));
