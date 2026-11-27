CREATE OR REPLACE FUNCTION public.protect_whatsapp_account_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role()='authenticated' AND NOT public.is_admin_or_super(auth.uid()) THEN
  IF TG_OP='INSERT' THEN
   IF NEW.id IS DISTINCT FROM auth.uid() OR NEW.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Account identity cannot be changed'; END IF;
  ELSE
   IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.email IS DISTINCT FROM OLD.email THEN RAISE EXCEPTION 'Account identity cannot be changed'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_whatsapp_account_identity() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.protect_whatsapp_account_identity() TO service_role;
CREATE TRIGGER protect_whatsapp_identity BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.protect_whatsapp_account_identity();