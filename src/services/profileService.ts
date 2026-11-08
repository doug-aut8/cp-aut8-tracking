import { supabase } from "@/integrations/supabase/client";

type ProfileRow = { id: string; phone: string | null } | null;

const profileCache = new Map<string, ProfileRow>();
const inflight = new Map<string, Promise<ProfileRow>>();

export const getProfile = (userId: string): Promise<ProfileRow> => {
  if (profileCache.has(userId)) {
    return Promise.resolve(profileCache.get(userId)!);
  }
  const existing = inflight.get(userId);
  if (existing) return existing;

  const p = (async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, phone")
      .eq("id", userId)
      .maybeSingle();
    const row = (data as ProfileRow) ?? null;
    profileCache.set(userId, row);
    inflight.delete(userId);
    return row;
  })();

  inflight.set(userId, p);
  return p;
};

export const invalidateProfile = (userId?: string) => {
  if (userId) {
    profileCache.delete(userId);
    inflight.delete(userId);
  } else {
    profileCache.clear();
    inflight.clear();
  }
};
