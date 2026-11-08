import { supabase } from "@/integrations/supabase/client";
import { phoneVariants } from "@/utils/phoneUtils";

type AuthLikeUser = {
  id?: string | null;
  uid?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  phone?: string | null;
};

type CouponLike = {
  id?: string | null;
  primeira_compra_apenas?: boolean | null;
};

type ValidationReason = "eligible" | "not_first_purchase" | "login_required" | "validation_error";

export type CouponFirstPurchaseValidation = {
  eligible: boolean;
  reason: ValidationReason;
  hasPreviousPurchase: boolean;
};

const CANCELLED_ORDER_STATUSES = new Set([
  "cancelado",
  "cancelada",
  "cancelled",
  "canceled",
]);

const isUuid = (value?: string | null) =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizeEmail = (value?: string | null) => (value || "").trim().toLowerCase();

const isValidPurchaseStatus = (status?: string | null) => {
  const normalized = (status || "").trim().toLowerCase();
  return !CANCELLED_ORDER_STATUSES.has(normalized);
};

const unique = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => (value || "").trim()).filter(Boolean)));

export const validateFirstPurchaseCoupon = async (
  coupon: CouponLike | null | undefined,
  currentUser: AuthLikeUser | null | undefined,
  options?: { customerPhone?: string | null }
): Promise<CouponFirstPurchaseValidation> => {
  if (!coupon?.primeira_compra_apenas) {
    return { eligible: true, reason: "eligible", hasPreviousPurchase: false };
  }

  const authId = currentUser?.id || currentUser?.uid || null;
  if (!authId) {
    return { eligible: false, reason: "login_required", hasPreviousPurchase: false };
  }

  try {
    const emails = new Set<string>();
    const userIds = new Set<string>();
    const legacyIds = new Set<string>();
    const phones = new Set<string>();

    if (isUuid(authId)) userIds.add(authId);
    legacyIds.add(authId);

    const authEmail = normalizeEmail(currentUser?.email);
    if (authEmail) emails.add(authEmail);

    const authPhone = currentUser?.phoneNumber || currentUser?.phone || null;
    for (const variant of phoneVariants(authPhone)) phones.add(variant);
    for (const variant of phoneVariants(options?.customerPhone)) phones.add(variant);

    const userLookupParts = [`firebase_id.eq.${authId}`];
    if (isUuid(authId)) {
      userLookupParts.push(`id.eq.${authId}`, `user_id.eq.${authId}`);
    }
    if (authEmail) userLookupParts.push(`email.ilike.${authEmail}`);

    const { data: userRows, error: userError } = await supabase
      .from("users" as any)
      .select("id, user_id, firebase_id, email, phone")
      .or(userLookupParts.join(","))
      .limit(20);

    if (userError) throw userError;

    for (const row of userRows || []) {
      const userRow = row as any;
      if (isUuid(userRow.id)) userIds.add(userRow.id);
      if (isUuid(userRow.user_id)) userIds.add(userRow.user_id);
      if (userRow.firebase_id) legacyIds.add(String(userRow.firebase_id));
      const rowEmail = normalizeEmail(userRow.email);
      if (rowEmail) emails.add(rowEmail);
      for (const variant of phoneVariants(userRow.phone)) phones.add(variant);
    }

    const queries: Promise<{ data: any[] | null; error: any }>[] = [];
    const selected = "id, status_atual";
    const userIdList = unique(Array.from(userIds));
    const legacyIdList = unique(Array.from(legacyIds));
    const emailList = unique(Array.from(emails));
    const phoneList = unique(Array.from(phones));

    if (userIdList.length > 0) {
      queries.push(
        supabase.from("pedidos_sabor_delivery" as any).select(selected).in("user_id", userIdList).limit(10) as any
      );
    }
    if (legacyIdList.length > 0) {
      queries.push(
        supabase.from("pedidos_sabor_delivery" as any).select(selected).in("firebase_id", legacyIdList).limit(10) as any
      );
    }
    for (const email of emailList) {
      queries.push(
        supabase.from("pedidos_sabor_delivery" as any).select(selected).ilike("user_email", email).limit(10) as any
      );
    }
    if (phoneList.length > 0) {
      queries.push(
        supabase.from("pedidos_sabor_delivery" as any).select(selected).in("telefone_cliente", phoneList).limit(10) as any
      );
    }

    const results = await Promise.all(queries);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) throw firstError;

    const ordersById = new Map<string, any>();
    for (const result of results) {
      for (const order of result.data || []) {
        if (order?.id) ordersById.set(order.id, order);
      }
    }

    const hasPreviousPurchase = Array.from(ordersById.values()).some((order) =>
      isValidPurchaseStatus(order.status_atual)
    );

    return {
      eligible: !hasPreviousPurchase,
      reason: hasPreviousPurchase ? "not_first_purchase" : "eligible",
      hasPreviousPurchase,
    };
  } catch (error) {
    console.error("Erro ao validar cupom de primeira compra:", error);
    return { eligible: false, reason: "validation_error", hasPreviousPurchase: false };
  }
};

export const getFirstPurchaseCouponBlockMessage = (reason: ValidationReason) => {
  if (reason === "login_required") {
    return "Este cupom é válido apenas para a primeira compra. Faça login para usá-lo.";
  }
  if (reason === "validation_error") {
    return "Não foi possível validar se este é seu primeiro pedido. Tente novamente.";
  }
  return "Este cupom é válido apenas para clientes em sua primeira compra.";
};