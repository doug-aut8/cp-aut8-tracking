CREATE TABLE public.whatsapp_auth_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), phone text NOT NULL, purpose text NOT NULL,
 ip_hash text NOT NULL, code_hash text, user_id uuid, name text,
 attempts integer NOT NULL DEFAULT 0, used_at timestamptz,
 expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_auth_challenges TO service_role;
ALTER TABLE public.whatsapp_auth_challenges ENABLE ROW LEVEL SECURITY;
CREATE INDEX whatsapp_challenge_phone_date ON public.whatsapp_auth_challenges(phone, created_at);
CREATE INDEX whatsapp_challenge_ip_date ON public.whatsapp_auth_challenges(ip_hash, created_at);
CREATE TRIGGER whatsapp_challenges_updated BEFORE UPDATE ON public.whatsapp_auth_challenges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE FUNCTION public.whatsapp_phone_key(raw text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 WITH d AS (SELECT regexp_replace(coalesce(raw,''), '[^0-9]', '', 'g') v), n AS (SELECT CASE WHEN length(v) IN (10,11) THEN '55'||v ELSE v END v FROM d)
 SELECT CASE WHEN length(v)=13 AND substr(v,5,1)='9' THEN substr(v,1,4)||substr(v,6) ELSE v END FROM n;
$$;
CREATE OR REPLACE FUNCTION public.whatsapp_find_users(p_phone text) RETURNS TABLE(id uuid,user_id uuid,email text,phone text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT u.id,u.user_id,u.email,u.phone FROM public.users u WHERE public.whatsapp_phone_key(u.phone)=public.whatsapp_phone_key(p_phone) AND u.email IS NOT NULL;
$$;
CREATE OR REPLACE FUNCTION public.whatsapp_reserve_challenge(p_phone text,p_purpose text,p_ip_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
 DECLARE result uuid; phone_limit int;
 BEGIN
 IF p_purpose NOT IN ('signup','reset','login') THEN RAISE EXCEPTION 'invalid purpose'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('whatsapp-ip:'||p_ip_hash,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('whatsapp-phone:'||public.whatsapp_phone_key(p_phone),0));
 phone_limit := CASE WHEN p_purpose='login' THEN 10 ELSE 5 END;
 IF (SELECT count(*) FROM public.whatsapp_auth_challenges WHERE public.whatsapp_phone_key(phone)=public.whatsapp_phone_key(p_phone) AND purpose=p_purpose AND created_at>now()-interval '15 minutes') >= phone_limit
 OR (SELECT count(*) FROM public.whatsapp_auth_challenges WHERE ip_hash=p_ip_hash AND created_at>now()-interval '15 minutes') >= 50 THEN RETURN NULL; END IF;
 IF p_purpose <> 'login' AND EXISTS(SELECT 1 FROM public.whatsapp_auth_challenges WHERE public.whatsapp_phone_key(phone)=public.whatsapp_phone_key(p_phone) AND purpose=p_purpose AND created_at>now()-interval '60 seconds') THEN RETURN NULL; END IF;
 INSERT INTO public.whatsapp_auth_challenges(phone,purpose,ip_hash) VALUES(p_phone,p_purpose,p_ip_hash) RETURNING id INTO result;
 RETURN result;
 END;
$$;
CREATE OR REPLACE FUNCTION public.whatsapp_consume_challenge(p_id uuid,p_purpose text,p_code_hash text) RETURNS TABLE(phone text,user_id uuid,name text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
 DECLARE c public.whatsapp_auth_challenges;
 BEGIN
 SELECT * INTO c FROM public.whatsapp_auth_challenges WHERE id=p_id AND purpose=p_purpose FOR UPDATE;
 IF NOT FOUND OR c.used_at IS NOT NULL OR c.expires_at<=now() OR c.attempts>=5 THEN RETURN; END IF;
 UPDATE public.whatsapp_auth_challenges SET attempts=attempts+1 WHERE id=c.id;
 IF c.code_hash IS NULL OR c.code_hash<>p_code_hash THEN RETURN; END IF;
 UPDATE public.whatsapp_auth_challenges SET used_at=now() WHERE id=c.id;
 RETURN QUERY SELECT c.phone,c.user_id,c.name;
 END;
$$;
REVOKE ALL ON FUNCTION public.whatsapp_phone_key(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_find_users(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_reserve_challenge(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_consume_challenge(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_phone_key(text),public.whatsapp_find_users(text),public.whatsapp_reserve_challenge(text,text,text),public.whatsapp_consume_challenge(uuid,text,text) TO service_role;