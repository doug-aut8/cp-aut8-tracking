-- Helper for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Helper: is admin or super-admin
CREATE OR REPLACE FUNCTION public.is_admin_or_super(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('admin'::app_role, 'super-admin'::app_role)
  );
$$;

-- =================== categories ===================
CREATE TABLE public.categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  is_popular_category boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories admin insert" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "categories admin update" ON public.categories FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "categories admin delete" ON public.categories FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed popular category
INSERT INTO public.categories (id, name, "order", is_popular_category, visible)
VALUES ('popular-items', 'Produtos Mais Vendidos', 0, true, true)
ON CONFLICT (id) DO NOTHING;

-- =================== menu_items ===================
CREATE TABLE public.menu_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  cost numeric,
  image text NOT NULL DEFAULT '/placeholder.svg',
  category text NOT NULL,
  additional_categories text[] DEFAULT '{}'::text[],
  popular boolean DEFAULT false,
  available boolean DEFAULT true,
  has_variations boolean DEFAULT false,
  variation_groups jsonb DEFAULT '[]'::jsonb,
  price_from boolean DEFAULT false,
  tipo text DEFAULT 'padrao',
  permite_combinacao boolean DEFAULT false,
  max_sabores integer,
  is_half_pizza boolean DEFAULT false,
  combination jsonb,
  pizza_borders jsonb DEFAULT '[]'::jsonb,
  borders_position integer,
  frete_gratis boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menu_items_category_idx ON public.menu_items(category);
CREATE INDEX menu_items_popular_idx ON public.menu_items(popular) WHERE popular = true;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu_items public read" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "menu_items admin insert" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "menu_items admin update" ON public.menu_items FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "menu_items admin delete" ON public.menu_items FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE TRIGGER menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================== variations ===================
CREATE TABLE public.variations (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  additional_price numeric NOT NULL DEFAULT 0,
  available boolean NOT NULL DEFAULT true,
  category_ids text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.variations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variations public read" ON public.variations FOR SELECT USING (true);
CREATE POLICY "variations admin insert" ON public.variations FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "variations admin update" ON public.variations FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "variations admin delete" ON public.variations FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE TRIGGER variations_updated_at BEFORE UPDATE ON public.variations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================== variation_groups ===================
CREATE TABLE public.variation_groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  internal_name text DEFAULT '',
  min_required integer NOT NULL DEFAULT 0,
  max_allowed integer NOT NULL DEFAULT 1,
  variations text[] NOT NULL DEFAULT '{}'::text[],
  custom_message text DEFAULT '',
  apply_to_half_pizza boolean DEFAULT false,
  allow_per_half boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.variation_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variation_groups public read" ON public.variation_groups FOR SELECT USING (true);
CREATE POLICY "variation_groups admin insert" ON public.variation_groups FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "variation_groups admin update" ON public.variation_groups FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "variation_groups admin delete" ON public.variation_groups FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE TRIGGER variation_groups_updated_at BEFORE UPDATE ON public.variation_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================== pizza_borders ===================
CREATE TABLE public.pizza_borders (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  additional_price numeric NOT NULL DEFAULT 0,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pizza_borders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pizza_borders public read" ON public.pizza_borders FOR SELECT USING (true);
CREATE POLICY "pizza_borders admin insert" ON public.pizza_borders FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "pizza_borders admin update" ON public.pizza_borders FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "pizza_borders admin delete" ON public.pizza_borders FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE TRIGGER pizza_borders_updated_at BEFORE UPDATE ON public.pizza_borders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();