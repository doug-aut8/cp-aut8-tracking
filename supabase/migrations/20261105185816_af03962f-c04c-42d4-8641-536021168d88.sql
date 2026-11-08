CREATE TABLE public.size_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.size_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.size_templates TO authenticated;
GRANT ALL ON public.size_templates TO service_role;
ALTER TABLE public.size_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "size_templates public read" ON public.size_templates FOR SELECT USING (true);
CREATE POLICY "size_templates admin write" ON public.size_templates FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE TRIGGER size_templates_updated_at BEFORE UPDATE ON public.size_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.categories ADD COLUMN size_template_id uuid REFERENCES public.size_templates(id) ON DELETE SET NULL;
ALTER TABLE public.menu_items ADD COLUMN ignore_size_template boolean NOT NULL DEFAULT false;