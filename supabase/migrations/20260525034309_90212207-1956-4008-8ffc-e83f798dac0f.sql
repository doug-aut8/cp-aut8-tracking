CREATE POLICY "Anyone can insert checkout events" ON public.checkout_events FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Authenticated can read checkout events" ON public.checkout_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can read checkout events" ON public.checkout_events FOR SELECT TO anon USING (true);