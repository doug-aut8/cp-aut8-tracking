ALTER TABLE public.cupons ADD COLUMN IF NOT EXISTS utm_campaign text;
CREATE INDEX IF NOT EXISTS cupons_utm_campaign_idx ON public.cupons (lower(utm_campaign));