ALTER TABLE public.customer_data ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS customer_data_user_id_idx ON public.customer_data (user_id);

DROP POLICY IF EXISTS "customer_data anon insert" ON public.customer_data;

-- Guests (not signed in) may only create rows that are not attributed to any account
CREATE POLICY "customer_data guest insert"
ON public.customer_data
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND name IS NOT NULL
  AND phone IS NOT NULL
  AND length(phone) >= 8
  AND length(name) <= 200
  AND length(phone) <= 30
);

-- Signed-in users may only create rows bound to their own account (or unbound guest-style rows)
CREATE POLICY "customer_data own insert"
ON public.customer_data
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND name IS NOT NULL
  AND phone IS NOT NULL
  AND length(phone) >= 8
  AND length(name) <= 200
  AND length(phone) <= 30
);

CREATE POLICY "customer_data own read"
ON public.customer_data
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "customer_data own update"
ON public.customer_data
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
