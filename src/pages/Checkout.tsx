//checkout.tsx
import React, { useState, useEffect, useRef } from "react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createOrder } from "@/services/orderService";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";


import { fetchAddressByCep } from "@/services/cepService";
import { saveCustomerData, getCustomerByPhone } from "@/services/customerService";
import { calculateFreteByCep, calculateFreteSuperfrete, SuperfreteOpcao } from "@/services/freteService";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import ProductVariationDialog from "@/components/ProductVariationDialog";
import { getAllVariations } from "@/services/variationService";
import { CartItem, MenuItem, Variation, SelectedVariationGroup, PizzaBorder } from "@/types/menu";
import { trackPurchase, trackUpdateCheckoutQuantity, trackAbandonedCart, trackCheckoutFinalize } from "@/utils/trackingEvents";
import { getUtmParams } from "@/utils/utmCapture";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { phoneDigits as toPhoneDigits, phoneDigitsBr } from "@/utils/phoneUtils";
import { withComunicacaoMeta } from "@/utils/webhookPayload";
import CouponField from "@/components/CouponField";
import { trackCheckoutEvent } from "@/services/checkoutEventService";
import { useStoreOpen } from "@/hooks/useStoreOpen";
import { useUserRole } from "@/hooks/useUserRole";
import StoreClosedBanner from "@/components/StoreClosedBanner";
import { dismissPromoRequirementsToast, showPromoRequirementsToast } from "@/utils/promoRequirementsToast";
import { getFirstPurchaseCouponBlockMessage, validateFirstPurchaseCoupon } from "@/services/couponEligibilityService";

const Checkout = () => {
  const { cartItems, cartTotal, clearCart, removeFromCart, updateCartItemByIndex, appliedCoupon, setAppliedCoupon, discountAmount, finalTotal, isCouponRequirementsMet } = useCart();
  const { currentUser } = useAuth();
  const { isOpen: storeIsOpen, loading: storeOpenLoading } = useStoreOpen();
  const { role } = useUserRole();
  const canBypassHours = role === "admin" || role === "super-admin" || role === "moderator";
  const blockOrder = !storeOpenLoading && !storeIsOpen && !canBypassHours;
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "pix" | "stripe">("card");
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery");
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [cardDeliveryEnabled, setCardDeliveryEnabled] = useState(true);
  const [cashEnabled, setCashEnabled] = useState(true);
  const [observations, setObservations] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [valorFrete, setValorFrete] = useState<number>(0);
  const [distanciaKm, setDistanciaKm] = useState<number | null>(null);
  const [freteError, setFreteError] = useState<string | null>(null);
  const [freteCalculado, setFreteCalculado] = useState(false);
  const [superfreteOpcoes, setSuperfreteOpcoes] = useState<SuperfreteOpcao[]>([]);
  const [superfreteSelecionado, setSuperfreteSelecionado] = useState<number | null>(null);
  const [superfreteLoading, setSuperfreteLoading] = useState(false);
  
  // Verificar se algum item do carrinho tem frete grátis
  // Para pizza meio a meio, ambos os sabores precisam ter freteGratis
  const hasFreteGratis = (appliedCoupon?.tipo === "frete_gratis") || cartItems.some(item => {
    if (item.isHalfPizza) {
      return item.freteGratis === true;
    }
    return item.freteGratis === true;
  });
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  // Estado para edição de item
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAvailableVariations, setEditAvailableVariations] = useState<Variation[]>([]);
  const [editGroupVariations, setEditGroupVariations] = useState<{ [groupId: string]: Variation[] }>({});
  
  const numberInputRef = useRef<HTMLInputElement>(null);

  // Estado para detecção/atualização de número de telefone
  const [originalRegisteredPhone, setOriginalRegisteredPhone] = useState<string>("");
  const [phoneChangeDialogOpen, setPhoneChangeDialogOpen] = useState(false);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const pendingSubmitRef = useRef<null | (() => void)>(null);

  // Estado para detecção/atualização de endereço vs cadastro (users)
  const [registeredAddress, setRegisteredAddress] = useState<{
    cep: string; rua: string; numero: string; complemento: string; bairro: string; cidade: string;
  } | null>(null);
  const [addressChangeDialogOpen, setAddressChangeDialogOpen] = useState(false);
  const [updatingAddress, setUpdatingAddress] = useState(false);
  const oneTimeAddressRef = useRef<boolean>(false);

  // Marca o instante em que o checkout foi aberto (para medir tempo até finalizar)
  const checkoutStartRef = useRef<number>(Date.now());
  const abandonedFiredRef = useRef<boolean>(false);
  const finalizedRef = useRef<boolean>(false);
  const submittingRef = useRef<boolean>(false);

  // Dialog modal para "compre e ganhe" sem requisitos atendidos
  const [promoBlockOpen, setPromoBlockOpen] = useState(false);

  // Dispara "abandoned_cart" após o tempo configurado em "tempo_disparo_abandoned_cart" (minutos). Padrão: 25 min
  const [abandonMs, setAbandonMs] = useState<number>(25 * 60 * 1000);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("configuracoes")
          .select("valor")
          .eq("chave", "tempo_disparo_abandoned_cart")
          .maybeSingle();
        const minutes = parseFloat(data?.valor || "");
        if (!isNaN(minutes) && minutes > 0) setAbandonMs(minutes * 60 * 1000);
      } catch {}
      try {
        const { data: sData } = await supabase
          .from("configuracoes")
          .select("valor")
          .eq("chave", "stripe_enabled")
          .maybeSingle();
        setStripeEnabled(sData?.valor === "true");
      } catch {}
      try {
        const { data: cData } = await supabase
          .from("configuracoes")
          .select("valor")
          .eq("chave", "payment_card_delivery_enabled")
          .maybeSingle();
        setCardDeliveryEnabled(cData?.valor !== "false");
      } catch {}
      try {
        const { data: mData } = await supabase
          .from("configuracoes")
          .select("valor")
          .eq("chave", "payment_cash_enabled")
          .maybeSingle();
        setCashEnabled(mData?.valor !== "false");
      } catch {}
    })();
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (finalizedRef.current || abandonedFiredRef.current) return;
      if (cartItems.length === 0) return;
      abandonedFiredRef.current = true;
      try {
        trackAbandonedCart([...cartItems], finalTotal);
        import("@/utils/abandonedCartWebhook").then(({ fireAbandonedCartWebhook }) => {
          fireAbandonedCartWebhook(currentUser);
        });
      } catch (e) {
        console.error("Erro ao disparar abandoned_cart:", e);
      }
    }, abandonMs);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abandonMs]);

  // Ajustar método de pagamento padrão quando opções são desabilitadas
  useEffect(() => {
    if (!cardDeliveryEnabled && paymentMethod === "card") {
      if (cashEnabled) setPaymentMethod("cash");
      else setPaymentMethod("pix");
    }
    if (!cashEnabled && paymentMethod === "cash") {
      if (cardDeliveryEnabled) setPaymentMethod("card");
      else setPaymentMethod("pix");
    }
  }, [cardDeliveryEnabled, cashEnabled]);

  // Preencher dados automaticamente se o usuário estiver logado
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) return;

      try {
        const emailKey = (currentUser.email || "").toLowerCase();
        const orParts = [`firebase_id.eq.${currentUser.uid}`, `id.eq.${currentUser.id}`];
        if (emailKey) orParts.push(`email.ilike.${emailKey}`);
        const { data: profileRows } = await supabase
          .from('users')
          .select('*')
          .or(orParts.join(","))
          .limit(1);
        const profile = profileRows?.[0];



        const rawPhone =
          profile?.phone || currentUser.phoneNumber || "";
        const displayName =
          profile?.name || currentUser.displayName || "";

        setCustomerName(displayName);
        setCustomerPhone(rawPhone ? formatPhoneWithCountryCode(rawPhone) : "+55 ");
        setOriginalRegisteredPhone(rawPhone || "");

        // Preencher endereço a partir do cadastro (tabela users)
        const p: any = profile || {};
        const hasRegistered =
          p.cep || p.rua || p.numero || p.complemento || p.bairro || p.cidade;
        if (hasRegistered) {
          const regCep = (p.cep || "").toString();
          setCep(regCep);
          setStreet(p.rua || "");
          setNumber(p.numero || "");
          setComplement(p.complemento || "");
          setNeighborhood(p.bairro || "");
          setCity(p.cidade || "");
          setRegisteredAddress({
            cep: regCep,
            rua: p.rua || "",
            numero: p.numero || "",
            complemento: p.complemento || "",
            bairro: p.bairro || "",
            cidade: p.cidade || "",
          });
          // Calcular frete automaticamente se CEP válido
          const cleanCep = regCep.replace(/\D/g, "");
          if (cleanCep.length === 8) {
            try { await calculateFreteForCep(regCep); } catch (e) { console.error(e); }
          }
        } else if (rawPhone) {
          await loadSavedCustomerData(rawPhone);
        }
      } catch (error) {
        console.error("Erro ao carregar dados do usuário:", error);
        setCustomerName(currentUser.displayName || "");
        const rawPhone = currentUser.phoneNumber || "";
        setCustomerPhone(rawPhone ? formatPhoneWithCountryCode(rawPhone) : "+55 ");
        setOriginalRegisteredPhone(rawPhone || "");
        if (rawPhone) {
          await loadSavedCustomerData(rawPhone);
        }
      }
    };

    loadUserData();
  }, [currentUser]);

  // Função para carregar dados salvos do cliente
  const loadSavedCustomerData = async (phone: string) => {
    try {
      const customerData = await getCustomerByPhone(phone);
      if (customerData) {
        // Preencher os campos com os dados salvos apenas se estiverem vazios
        if (!customerName) setCustomerName(customerData.name || "");
        if (!cep) setCep(customerData.cep || "");
        if (!street) setStreet(customerData.street || "");
        if (!number) setNumber(customerData.number || "");
        if (!complement) setComplement(customerData.complement || "");
        if (!neighborhood) setNeighborhood(customerData.neighborhood || "");
        if (!city) setCity(customerData.city || "");
        if (!state) setState(customerData.state || "");

        // Recalcular frete quando o CEP vem preenchido automaticamente
        if (customerData.cep && customerData.cep.replace(/\D/g, "").length === 8) {
          try {
            await calculateFreteForCep(customerData.cep);
          } catch (freteErr: any) {
            console.error("Erro ao calcular frete automaticamente:", freteErr);
            const errorMsg = freteErr.message || "Não foi possível calcular o frete";
            setFreteError(errorMsg);
            toast({
              title: "Aviso",
              description: errorMsg,
              variant: "destructive",
            });
            setValorFrete(0);
            setDistanciaKm(null);
            setFreteCalculado(false);
          }
        }
        
      }
    } catch (error) {
      console.error("Erro ao buscar dados do cliente:", error);
    }
  };

  const formatPhoneWithCountryCode = (raw: string) => {
    // Sempre garante prefixo 55
    let digits = raw.replace(/\D/g, "");
    if (!digits.startsWith("55")) {
      digits = "55" + digits;
    }
    // Limita a 13 dígitos (55 + DDD2 + 9 dígitos)
    digits = digits.slice(0, 13);

    const country = digits.slice(0, 2);
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);

    let formatted = `+${country}`;
    if (ddd) formatted += ` (${ddd}`;
    if (ddd.length === 2) formatted += ")";
    if (rest.length > 0) {
      if (rest.length <= 4) {
        formatted += ` ${rest}`;
      } else if (rest.length <= 8) {
        // fixo: 4-4
        formatted += ` ${rest.slice(0, 4)}-${rest.slice(4)}`;
      } else {
        // mobile: 5-4
        formatted += ` ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
      }
    }
    return formatted;
  };

  const handlePhoneChange = async (value: string) => {
    const formatted = formatPhoneWithCountryCode(value);
    setCustomerPhone(formatted);

    // Buscar dados do cliente apenas quando o telefone estiver completo:
    // - 13 dígitos se o primeiro dígito do número (após 55+DD) for 9 (mobile)
    // - 12 dígitos caso contrário (fixo)
    const cleanPhone = formatted.replace(/\D/g, '');
    const firstSubscriberDigit = cleanPhone.charAt(4); // 55 + DD + [X]
    const isMobile = firstSubscriberDigit === "9";
    const complete = isMobile ? cleanPhone.length === 13 : cleanPhone.length === 12;
    if (complete) {
      setPhoneLoading(true);
      try {
        const customerData = await getCustomerByPhone(value);
        if (customerData) {
          // Preencher os campos com os dados salvos
          setCustomerName(customerData.name || "");
          setCep(customerData.cep || "");
          setStreet(customerData.street || "");
          setNumber(customerData.number || "");
          setComplement(customerData.complement || "");
          setNeighborhood(customerData.neighborhood || "");
          setCity(customerData.city || "");
          setState(customerData.state || "");

          // Recalcular frete quando o CEP é preenchido via busca pelo telefone
          if (customerData.cep && customerData.cep.replace(/\D/g, "").length === 8) {
            try {
              await calculateFreteForCep(customerData.cep);
            } catch (freteErr: any) {
              console.error("Erro ao calcular frete pelo telefone:", freteErr);
              const errorMsg = freteErr.message || "Não foi possível calcular o frete";
              setFreteError(errorMsg);
              toast({
                title: "Aviso",
                description: errorMsg,
                variant: "destructive",
              });
              setValorFrete(0);
              setDistanciaKm(null);
              setFreteCalculado(false);
            }
          }
          
        }
      } catch (error) {
        console.error("Erro ao buscar dados do cliente:", error);
      } finally {
        setPhoneLoading(false);
      }
    }
  };

  const calculateFreteForCep = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, "");
    console.log("calculateFreteForCep chamado com CEP:", cepValue, "| limpo:", cleanCep);

    if (cleanCep.length !== 8) {
      return;
    }

    setFreteError(null);
    setSuperfreteOpcoes([]);
    setSuperfreteSelecionado(null);

    // Buscar dados completos da empresa (inclui campos Superfrete)
    const { data: empresaData, error: empresaError } = await supabase
      .from("empresa_info")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (empresaError) throw empresaError;
    if (!empresaData?.cep || !empresaData?.user_id) {
      throw new Error("Empresa sem CEP configurado para cálculo de frete");
    }

    const empresa = empresaData as any;
    const modelo = (empresa.modelo_frete as string) || "km_direto";

    if (modelo === "superfrete") {
      if (!empresa.superfrete_token) {
        throw new Error("Token Superfrete não configurado. Configure em Logística.");
      }
      const servicos: number[] = Array.isArray(empresa.superfrete_servicos)
        ? empresa.superfrete_servicos
        : [];
      if (servicos.length === 0) {
        throw new Error("Nenhum serviço Superfrete habilitado. Configure em Logística.");
      }

      // Buscar dimensões dos itens do carrinho
      const itemIds = cartItems.map((i) => i.id).filter(Boolean);
      let dimensoesPorId: Record<string, any> = {};
      if (itemIds.length > 0) {
        const { data: menuRows } = await supabase
          .from("menu_items")
          .select("id, weight_g, length_cm, width_cm, height_cm")
          .in("id", itemIds as string[]);
        (menuRows || []).forEach((m: any) => {
          dimensoesPorId[m.id] = m;
        });
      }

      const itens = cartItems.map((ci) => {
        const d = dimensoesPorId[ci.id] || {};
        return {
          weightG: d.weight_g ?? null,
          lengthCm: d.length_cm ?? null,
          widthCm: d.width_cm ?? null,
          heightCm: d.height_cm ?? null,
          quantity: ci.quantity || 1,
        };
      });

      setSuperfreteLoading(true);
      try {
        const opcoes = await calculateFreteSuperfrete({
          cepOrigem: empresa.cep,
          cepDestino: cepValue,
          itens,
          defaults: {
            weightG: Number(empresa.default_peso_g) || 300,
            lengthCm: Number(empresa.default_comprimento_cm) || 16,
            widthCm: Number(empresa.default_largura_cm) || 11,
            heightCm: Number(empresa.default_altura_cm) || 2,
          },
          token: empresa.superfrete_token,
          sandbox: empresa.superfrete_sandbox ?? true,
          services: servicos,
        });
        if (opcoes.length === 0) {
          throw new Error("Nenhuma opção de frete disponível para este CEP.");
        }
        setSuperfreteOpcoes(opcoes);
        // Seleciona automaticamente a opção mais barata
        const maisBarata = [...opcoes].sort((a, b) => a.price - b.price)[0];
        setSuperfreteSelecionado(maisBarata.id);
        setValorFrete(maisBarata.price);
        setDistanciaKm(null);
        setFreteCalculado(true);
      } finally {
        setSuperfreteLoading(false);
      }
      return;
    }

    // Fluxo original (km_direto / cep_distancia)
    const freteData = await calculateFreteByCep(
      cepValue,
      empresa.cep,
      empresa.user_id
    );

    setValorFrete(freteData.valorFrete);
    setDistanciaKm(freteData.distanciaKm);
    setFreteCalculado(true);
  };


  const handleCepChange = async (value: string) => {
    setCep(value);

    const cleanCep = value.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      setValorFrete(0);
      setDistanciaKm(null);
      setFreteCalculado(false);
      return;
    }

    // Limpar número e focar no campo quando um novo CEP válido for inserido
    setNumber("");

    setCepLoading(true);
    try {
      // Buscar informações do endereço pelo CEP (se falhar, ainda tentamos calcular o frete)
      try {
        const cepInfo = await fetchAddressByCep(value);
        if (cepInfo) {
          setStreet(cepInfo.street || "");
          setNeighborhood(cepInfo.neighborhood || "");
          setCity(cepInfo.city || "");
          setState(cepInfo.state || "");
          
          // Focar no campo de número após buscar o endereço
          setTimeout(() => {
            numberInputRef.current?.focus();
          }, 100);
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
        toast({
          title: "Erro",
          description: "Não foi possível buscar as informações do CEP",
          variant: "destructive",
        });
      }

      try {
        await calculateFreteForCep(value);
      } catch (freteErr: any) {
        console.error("Erro ao calcular frete:", freteErr);
        const errorMsg = freteErr.message || "Não foi possível calcular o frete";
        setFreteError(errorMsg);
        toast({
          title: "Aviso",
          description: errorMsg,
          variant: "destructive",
        });
        setValorFrete(0);
        setDistanciaKm(null);
        setFreteCalculado(false);
      }
    } finally {
      setCepLoading(false);
    }
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (blockOrder) {
    toast({
      title: "Loja fechada",
      description: "Pedidos só podem ser finalizados dentro do horário de funcionamento.",
      variant: "destructive",
    });
    return;
  }

  // Bloquear se cupom "compre e ganhe" estiver sem requisitos atendidos
  if (appliedCoupon?.tipo === "compre_e_ganhe" && !isCouponRequirementsMet()) {
    dismissPromoRequirementsToast();
    setPromoBlockOpen(true);
    return;
  }

  // Bloquear se cupom "compre e ganhe" foi aplicado mas o brinde não foi incluído no pedido
  if (appliedCoupon?.tipo === "compre_e_ganhe") {
    const hasGiftInCart = cartItems.some((i: any) => !!i.__couponGiftId);
    if (!hasGiftInCart) {
      const desc =
        appliedCoupon.produto_brinde?.modo === "escolha"
          ? "Escolha seu brinde antes de finalizar o pedido."
          : "O brinde da promoção ainda não foi incluído no pedido.";
      toast({
        title: "Selecione o brinde da promoção",
        description: desc,
        variant: "destructive",
      });
      return;
    }
  }

  // Validação do telefone: código país 55 + DDD (2) + número (8 fixo / 9 mobile)
  // Se o primeiro dígito após o DDD for 9, é mobile e exige 13 dígitos no total
  const phoneDigits = customerPhone.replace(/\D/g, "");
  const isValidLength = phoneDigits.length === 12 || phoneDigits.length === 13;
  const firstSubscriberDigit = phoneDigits.charAt(4); // 55 + DD + [X]
  const isMobileStart = firstSubscriberDigit === "9";
  const mobileOk = !isMobileStart || phoneDigits.length === 13;

  if (!phoneDigits.startsWith("55") || !isValidLength || !mobileOk) {
    toast({
      title: "Telefone inválido",
      description: isMobileStart && phoneDigits.length !== 13
        ? "Números de celular (iniciados com 9) devem ter 13 dígitos. Ex: +55 (11) 91234-5678"
        : "Informe um número de WhatsApp brasileiro válido com DDD. Ex: +55 (11) 91234-5678",
      variant: "destructive",
    });
    return;
  }

  if (appliedCoupon) {
    const { data: freshCoupon, error: couponRefreshError } = await supabase
      .from("cupons" as any)
      .select("id, nome, primeira_compra_apenas")
      .eq("id", appliedCoupon.id)
      .maybeSingle();

    const couponForValidation = (freshCoupon as any) || appliedCoupon;
    if (couponRefreshError || couponForValidation?.primeira_compra_apenas) {
      const validation = couponRefreshError
        ? { eligible: false, reason: "validation_error" as const, hasPreviousPurchase: false }
        : await validateFirstPurchaseCoupon(couponForValidation, currentUser, { customerPhone });

      if (!validation.eligible) {
        setAppliedCoupon(null);
        toast({
          title: validation.reason === "login_required" ? "Login necessário" : "Cupom removido",
          description: getFirstPurchaseCouponBlockMessage(validation.reason),
          variant: "destructive",
        });
        return;
      }
    }
  }

  // Se o usuário está logado e mudou o número, pedir confirmação antes de prosseguir
  if (currentUser && originalRegisteredPhone) {
    const originalDigits = toPhoneDigits(originalRegisteredPhone).replace(/^55/, "");
    const currentDigits = phoneDigits.replace(/^55/, "");
    if (originalDigits && currentDigits && originalDigits !== currentDigits) {
      pendingSubmitRef.current = () => { void proceedWithOrder(); };
      setPhoneChangeDialogOpen(true);
      return;
    }
  }

  // Se o usuário está logado e mudou algum dado do endereço, pedir confirmação
  if (deliveryMethod === "delivery" && currentUser && registeredAddress && isAddressDifferentFromRegistered()) {
    pendingSubmitRef.current = () => { void proceedWithOrder(); };
    setAddressChangeDialogOpen(true);
    return;
  }

  await proceedWithOrder();
};

const normalizeStr = (v: string) => (v || "").trim().toLowerCase();
const normalizeCep = (v: string) => (v || "").replace(/\D/g, "");
const isAddressDifferentFromRegistered = () => {
  if (!registeredAddress) return false;
  return (
    normalizeCep(cep) !== normalizeCep(registeredAddress.cep) ||
    normalizeStr(street) !== normalizeStr(registeredAddress.rua) ||
    normalizeStr(number) !== normalizeStr(registeredAddress.numero) ||
    normalizeStr(complement) !== normalizeStr(registeredAddress.complemento) ||
    normalizeStr(neighborhood) !== normalizeStr(registeredAddress.bairro) ||
    normalizeStr(city) !== normalizeStr(registeredAddress.cidade)
  );
};

const updateRegisteredAddress = async () => {
  if (!currentUser) return;
  setUpdatingAddress(true);
  try {
    const { error } = await supabase
      .from("users")
      .update({
        cep: cep || null,
        rua: street || null,
        numero: number || null,
        complemento: complement || null,
        bairro: neighborhood || null,
        cidade: city || null,
        firebase_id: currentUser.uid,
      })
      .or(`firebase_id.eq.${currentUser.uid},id.eq.${currentUser.id}`);
    if (error) throw error;

    setRegisteredAddress({
      cep, rua: street, numero: number, complemento: complement,
      bairro: neighborhood, cidade: city,
    });
    toast({ title: "Cadastro atualizado!", description: "Seu endereço foi atualizado." });
  } catch (e: any) {
    console.error("Erro ao atualizar cadastro:", e);
    toast({ title: "Erro ao atualizar cadastro", description: e.message, variant: "destructive" });
  } finally {
    setUpdatingAddress(false);
  }
};

const proceedWithOrder = async () => {
  // Guard re-entrante síncrono — evita duplicação por duplo clique / submit concorrente
  if (submittingRef.current) {
    console.warn("[CHECKOUT] proceedWithOrder ignorado: já em execução");
    return;
  }
  submittingRef.current = true;
  setIsLoading(true);

  // ===== VALIDAÇÃO DE ESTOQUE =====
  try {
    // Agrupar quantidades por item (excluindo brindes de cupom)
    const cartByItemId = new Map<string, { name: string; qty: number }>();
    for (const item of cartItems) {
      if ((item as any).__couponGiftId) continue; // brindes não consomem estoque
      const existing = cartByItemId.get(item.id);
      if (existing) {
        existing.qty += item.quantity;
      } else {
        cartByItemId.set(item.id, { name: item.name, qty: item.quantity });
      }
    }

    const itemIds = Array.from(cartByItemId.keys());
    if (itemIds.length > 0) {
      const { data: stockData, error: stockError } = await supabase
        .from("menu_items")
        .select("id, name, stock")
        .in("id", itemIds);

      if (stockError) throw stockError;

      for (const row of stockData || []) {
        const cartItem = cartByItemId.get(row.id);
        if (!cartItem) continue;
        // stock === null significa ilimitado
        if (row.stock !== null && row.stock !== undefined && cartItem.qty > Number(row.stock)) {
          const available = Number(row.stock);
          toast({
            title: "Estoque insuficiente",
            description: `"${cartItem.name}" — quantidade no carrinho: ${cartItem.qty}. Quantidade disponível: ${available}. Ajuste a quantidade para finalizar o pedido.`,
            variant: "destructive",
          });
          setIsLoading(false);
          submittingRef.current = false;
          return;
        }
      }
    }
  } catch (stockErr: any) {
    console.error("Erro ao validar estoque:", stockErr);
    toast({
      title: "Erro ao validar estoque",
      description: stockErr.message || "Não foi possível verificar o estoque. Tente novamente.",
      variant: "destructive",
    });
    setIsLoading(false);
    submittingRef.current = false;
    return;
  }

  // Mede o tempo entre abrir o checkout e clicar em finalizar
  try {
    const durationMs = Date.now() - checkoutStartRef.current;
    finalizedRef.current = true;
    trackCheckoutFinalize([...cartItems], finalTotal, durationMs);
    trackCheckoutEvent({
      event_type: "checkout_advance",
      cart_total: cartTotal,
      discount_value: discountAmount || 0,
      cupom_id: appliedCoupon?.id ?? null,
      cupom_name: appliedCoupon?.nome ?? null,
    });
  } catch (e) {
    console.error("Erro ao rastrear checkout_finalize:", e);
  }

  try {
    const fullAddress = deliveryMethod === "pickup"
      ? "Retirada no Balcão"
      : `${street}, ${number}${complement ? `, ${complement}` : ""} - ${neighborhood}, ${city} - ${state}`;

    // Função auxiliar para calcular subtotal de cada item
    const calculateItemSubtotal = (item: any) => {
      if (item.isHalfPizza) {
        return (item.price || 0) * (item.quantity || 1);
      }

      const basePrice = (item.priceFrom ? 0 : (item.price || 0));
      let variationsTotal = 0;

      if (item.selectedVariations && Array.isArray(item.selectedVariations)) {
        item.selectedVariations.forEach((group: any) => {
          if (group.variations && Array.isArray(group.variations)) {
            group.variations.forEach((variation: any) => {
              const additionalPrice = variation.additionalPrice || 0;
              const quantity = variation.quantity || 1;
              // Para pizza meio a meio, "whole" cobra 2x o valor do adicional
              const halfMultiplier = variation.halfSelection === "whole" ? 2 : 1;
              variationsTotal += additionalPrice * quantity * halfMultiplier;
            });
          }
        });
      }

      return (basePrice + variationsTotal) * item.quantity;
    };

    // Montar itens já com subtotal
    const itemsWithSubtotal = cartItems.map(item => ({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      selectedVariations: item.selectedVariations || [],
      selectedBorder: item.selectedBorder || null,
      selectedSize: item.selectedSize || null,
      priceFrom: item.priceFrom || false,
      isHalfPizza: item.isHalfPizza || false,
      combination: item.combination || null,
      subtotal: calculateItemSubtotal(item), // 🔥 agora salva
      // Preserva marcadores de brinde para o orderService gravar isGift/giftProductId
      __couponGiftId: (item as any).__couponGiftId ?? null,
      category: (item as any).category,
    }));

    // Calcular total do pedido (incluindo frete, respeitando frete grátis)
    const subtotalPedido = itemsWithSubtotal.reduce((acc, item) => acc + item.subtotal, 0);
    const freteEfetivo = deliveryMethod === "pickup" || hasFreteGratis ? 0 : valorFrete;
    const totalComFrete = finalTotal + freteEfetivo;

    const utms = getUtmParams();

    const isStripe = paymentMethod === "stripe";
    const orderPaymentMethod = isStripe ? "card" : paymentMethod;

    // === FLUXO STRIPE: abre popup ANTES de criar o pedido ===
    // Cancelar fecha o popup e volta ao checkout sem criar pedido.
    // Apenas após confirmação do pagamento o pedido é criado/finalizado.
    if (isStripe) {
      try {
        const origin = window.location.origin;
        const tempRef =
          (typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`);

        const { data: stripeData, error: stripeErr } = await supabase.functions.invoke(
          "criar-stripe-checkout",
          {
            body: {
              orderId: tempRef,
              amount: totalComFrete,
              currency: "brl",
              customerEmail: currentUser?.email ?? undefined,
              customerName,
              description: `Pedido ${customerName || ""}`.trim() || "Pedido",
              successUrl: `${origin}/checkout?stripe=success`,
              cancelUrl: `${origin}/checkout?stripe=cancel`,
            },
          },
        );
        if (stripeErr || !stripeData?.url || !stripeData?.sessionId) {
          throw new Error(stripeErr?.message || stripeData?.error || "Falha ao criar sessão Stripe");
        }

        const w = 480;
        const h = 720;
        const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
        const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
        const popup = window.open(
          stripeData.url,
          "stripe-checkout",
          `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
        );
        if (!popup) {
          throw new Error("Não foi possível abrir a janela de pagamento. Permita pop-ups e tente novamente.");
        }

        const sessionId = stripeData.sessionId as string;
        const paid: boolean = await new Promise((resolve) => {
          const startedAt = Date.now();
          const timeoutMs = 15 * 60 * 1000; // 15 min
          const interval = window.setInterval(async () => {
            try {
              if (popup.closed) {
                window.clearInterval(interval);
                // Verifica uma última vez (usuário pode ter pago e fechado)
                try {
                  const { data: vData } = await supabase.functions.invoke(
                    "verificar-stripe-pagamento",
                    { body: { sessionId } },
                  );
                  resolve(!!vData?.paid);
                } catch {
                  resolve(false);
                }
                return;
              }
              if (Date.now() - startedAt > timeoutMs) {
                window.clearInterval(interval);
                try { popup.close(); } catch {}
                resolve(false);
                return;
              }
              const { data: vData } = await supabase.functions.invoke(
                "verificar-stripe-pagamento",
                { body: { sessionId } },
              );
              if (vData?.paid) {
                window.clearInterval(interval);
                try { popup.close(); } catch {}
                resolve(true);
              }
            } catch (e) {
              console.warn("Polling Stripe falhou:", e);
            }
          }, 2000);
        });

        if (!paid) {
          toast({
            title: "Pagamento cancelado",
            description: "Você voltou ao checkout. Nenhum pedido foi criado.",
          });
          setIsLoading(false);
          submittingRef.current = false;
          return;
        }
        // Marca o pedido como pago (recebido) ao criar
        (orderPaymentMethod as any);
      } catch (err: any) {
        console.error("Erro no fluxo Stripe:", err);
        toast({
          title: "Erro no pagamento",
          description: err.message || "Não foi possível iniciar o pagamento Stripe.",
          variant: "destructive",
        });
        setIsLoading(false);
        submittingRef.current = false;
        return;
      }
    }

    const orderData = {
      customerName,
      customerPhone,
      address: fullAddress,
      bairro: deliveryMethod === "pickup" ? "Retirada no Balcão" : neighborhood,
      cidade: deliveryMethod === "pickup" ? "Retirada no Balcão" : city,
      paymentMethod: orderPaymentMethod as "card" | "cash" | "pix",
      observations,
      items: itemsWithSubtotal,
      subtotal: finalTotal, // Subtotal com desconto mas sem frete
      frete: freteEfetivo, // Valor do frete (0 se frete grátis)
      total: totalComFrete, // Total com desconto e frete aplicados
      discount: discountAmount,
      couponCode: appliedCoupon?.nome ?? null,
      firebaseId: currentUser?.uid ?? null,
      userName: currentUser?.displayName ?? null,
      userEmail: currentUser?.email ?? null,
      utm_source: utms.utm_source,
      utm_medium: utms.utm_medium,
      utm_campaign: utms.utm_campaign,
      utm_content: utms.utm_content,
      utm_term: utms.utm_term,
    };

    console.log("[CHECKOUT] Dados do pedido sendo enviados:", JSON.stringify(orderData, null, 2));

    const order = await createOrder(orderData);

    // Pedido já é salvo no Supabase (pedidos_sabor_delivery) pelo createOrder.
    // O insert duplicado aqui foi removido para evitar pedidos duplicados sem frete/desconto.


    // Registrar uso do cupom via Edge Function (usa service role para bypass de RLS)
    if (appliedCoupon) {
      console.log("[CHECKOUT] Chamando Edge Function para registrar uso do cupom...");
      try {
        const { data: registroData, error: registroError } = await supabase.functions.invoke(
          "registrar-uso-cupom",
          {
            body: {
              cupom_id: appliedCoupon.id,
              firebase_id: currentUser?.uid || null,
              pedido_id: order.id,
            },
          }
        );

        if (registroError) {
          console.error("[CHECKOUT] Erro ao chamar Edge Function:", registroError);
        } else {
          console.log("[CHECKOUT] Resposta da Edge Function:", registroData);
          if (registroData?.atingiu_limite) {
            console.log("[CHECKOUT] Cupom atingiu limite e foi desativado automaticamente");
          }
        }
      } catch (fnError) {
        console.error("[CHECKOUT] Erro ao invocar Edge Function de cupom:", fnError);
      }
    }

    // Salvar dados do cliente após criar o pedido
    // Se "só nesta entrega", não sobrescreve endereço do auto-fill; apenas nome/telefone.
    if (oneTimeAddressRef.current && registeredAddress) {
      await saveCustomerData({
        name: customerName,
        phone: customerPhone,
        cep: registeredAddress.cep,
        street: registeredAddress.rua,
        number: registeredAddress.numero,
        complement: registeredAddress.complemento,
        neighborhood: registeredAddress.bairro,
        city: registeredAddress.cidade,
        state,
      });
    } else {
      await saveCustomerData({
        name: customerName,
        phone: customerPhone,
        cep,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
      });
    }
    oneTimeAddressRef.current = false;

    // Atualizar nome/telefone do perfil do usuário (Supabase)
    if (currentUser?.id) {
      try {
        await supabase.from("profiles").upsert(
          {
            id: currentUser.id,
            name: customerName,
            phone: phoneDigitsBr(customerPhone) || null,
            email: currentUser.email ?? null,
          },
          { onConflict: "id" }
        );
        console.log("[CHECKOUT] Perfil do usuário atualizado no Supabase");
      } catch (supaErr) {
        console.error("[CHECKOUT] Erro ao atualizar perfil:", supaErr);
      }
    }

    // Fidelidade será contabilizada apenas quando o pedido for entregue (status "delivered")

    // Track Purchase event
    try {
      trackPurchase({
        orderId: order.id,
        cartItems: [...cartItems], // copy before clearing
        total: totalComFrete,
        subtotal: subtotalPedido,
        frete: freteEfetivo,
        discount: discountAmount,
        couponCode: appliedCoupon?.nome ?? null,
        paymentMethod,
      });
    } catch (e) {
      console.error("Erro ao rastrear Purchase:", e);
    }

    clearCart();

    toast({
      title: isStripe ? "Pagamento aprovado!" : "Pedido realizado com sucesso!",
      description: `Seu pedido #${order.id.substring(0, 6)} foi enviado para o restaurante.`,
    });

    navigate("/");
    window.scrollTo({ top: 0, behavior: "auto" });
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    toast({
      title: "Erro",
      description: "Não foi possível processar seu pedido. Tente novamente.",
      variant: "destructive",
    });
  } finally {
    setIsLoading(false);
    submittingRef.current = false;
  }
  };

  // === Atualização de número de telefone do cadastro ===

  const triggerWhatsappAuthWebhook = async (phone: string) => {
    try {
      const { data } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "webhook_autenticacao")
        .maybeSingle();
      const url = data?.valor;
      if (!url) {
        console.warn("Webhook de autenticação não configurado.");
        return false;
      }
      // Busca o id interno do usuário (tabela users) pelo firebase_id
      let userIdDb: string | null = null;
      if (currentUser?.uid) {
        const { data: u } = await supabase
          .from("users")
          .select("id")
          .eq("firebase_id", currentUser.uid)
          .maybeSingle();
        userIdDb = (u as any)?.id || null;
      }
      const enriched = await withComunicacaoMeta({
        phone,
        phone_cadastrado: originalRegisteredPhone || null,
        user_id: userIdDb,
        firebase_id: currentUser?.uid || null,
      });
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enriched),
      });
      return true;
    } catch (err) {
      console.error("Erro ao acionar webhook de autenticação:", err);
      return false;
    }
  };

  const updateRegisteredPhone = async (newPhone: string) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from("users")
        .update({ phone: phoneDigitsBr(newPhone) || null })
        .eq("firebase_id", currentUser.uid);
      if (error) console.error("Erro ao atualizar telefone do usuário:", error);
    } catch (e) {
      console.error("Erro ao atualizar telefone:", e);
    }
  };

  const handleConfirmPhoneChange = async () => {
    setPhoneChangeDialogOpen(false);
    // Verifica se a verificação por WhatsApp está habilitada
    const { data: toggleData } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "whatsapp_verification_enabled")
      .maybeSingle();
    const verificationEnabled = toggleData?.valor !== "false";

    if (!verificationEnabled) {
      // Atualiza direto e prossegue
      await updateRegisteredPhone(customerPhone);
      setOriginalRegisteredPhone(customerPhone);
      toast({ title: "Número atualizado", description: "Seu WhatsApp foi atualizado no cadastro." });
      const next = pendingSubmitRef.current;
      pendingSubmitRef.current = null;
      next?.();
      return;
    }

    // Aciona webhook e abre OTP
    setSendingOtp(true);
    setOtpCode("");
    setOtpError("");
    const ok = await triggerWhatsappAuthWebhook(customerPhone);
    setSendingOtp(false);
    if (ok) {
      toast({ title: "Código enviado", description: "Enviamos um código de verificação para o seu WhatsApp." });
    } else {
      toast({
        title: "Atenção",
        description: "Não foi possível enviar o código. Verifique a configuração do webhook.",
        variant: "destructive",
      });
    }
    setOtpDialogOpen(true);
  };

  const handleCancelPhoneChange = () => {
    setPhoneChangeDialogOpen(false);
    // Restaurar número original e prosseguir com pedido
    setCustomerPhone(formatPhoneWithCountryCode(originalRegisteredPhone));
    const next = pendingSubmitRef.current;
    pendingSubmitRef.current = null;
    // Pequeno timeout para garantir o setState antes do submit
    setTimeout(() => next?.(), 0);
  };

  const handleVerifyOtp = async () => {
    setOtpError("");
    if (!otpCode.trim()) {
      setOtpError("Digite o código enviado para seu WhatsApp.");
      return;
    }
    setVerifyingOtp(true);
    try {
      // Procura o código pelo id do usuário logado
      if (!currentUser?.uid) {
        setOtpError("Usuário não identificado. Faça login novamente.");
        setVerifyingOtp(false);
        return;
      }
      const { data, error: dbError } = await supabase
        .from("users")
        .select("whatsapp_auth_code, id")
        .eq("firebase_id", currentUser.uid)
        .maybeSingle();

      if (dbError) throw dbError;

      const normalizedInput = otpCode.trim().toUpperCase();
      const savedCode = (data as any)?.whatsapp_auth_code?.trim().toUpperCase();
      if (savedCode && savedCode === normalizedInput) {
        await updateRegisteredPhone(customerPhone);
        setOriginalRegisteredPhone(customerPhone);
        setOtpDialogOpen(false);
        toast({
          title: "WhatsApp confirmado!",
          description: "Seu número foi atualizado no cadastro com sucesso.",
        });
        const next = pendingSubmitRef.current;
        pendingSubmitRef.current = null;
        next?.();
      } else {
        setOtpError("Código inválido. Verifique e tente novamente.");
      }
    } catch (err) {
      setOtpError("Não foi possível validar o código. Tente novamente.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    setSendingOtp(true);
    setOtpError("");
    const ok = await triggerWhatsappAuthWebhook(customerPhone);
    setSendingOtp(false);
    if (ok) toast({ title: "Código reenviado", description: "Verifique seu WhatsApp." });
  };


  const handleEditItem = async (index: number) => {
    const item = cartItems[index];
    if (!item.hasVariations || !item.variationGroups?.length) return;

    try {
      const allVariations = await getAllVariations();
      setEditAvailableVariations(allVariations);

      const groupVars: { [groupId: string]: Variation[] } = {};
      for (const group of item.variationGroups!) {
        // Respect the order defined in group.variations
        groupVars[group.id] = group.variations
          .map(varId => allVariations.find(v => v.id === varId))
          .filter((v): v is Variation => !!v && v.available);
      }
      setEditGroupVariations(groupVars);
      setEditingItemIndex(index);
      setEditDialogOpen(true);
    } catch (error) {
      console.error("Erro ao carregar variações para edição:", error);
    }
  };

  const handleEditConfirm = (
    _item: MenuItem & { quantity?: number },
    selectedVariationGroups: SelectedVariationGroup[],
    selectedBorder?: PizzaBorder | null
  ) => {
    if (editingItemIndex === null) return;
    const currentItem = cartItems[editingItemIndex];
    updateCartItemByIndex(editingItemIndex, {
      selectedVariations: selectedVariationGroups,
      selectedBorder: selectedBorder || undefined,
    });

    // Track checkout quantity/details update
    trackUpdateCheckoutQuantity({
      id: currentItem.id,
      name: currentItem.name,
      price: currentItem.price,
      quantity: currentItem.quantity,
      category: currentItem.category,
      variations: selectedVariationGroups?.flatMap(group =>
        group.variations.map(v => ({ name: v.name, price: v.additionalPrice }))
      ),
      border: selectedBorder
        ? { name: selectedBorder.name, price: selectedBorder.additionalPrice }
        : undefined,
      isHalfPizza: currentItem.isHalfPizza,
      combination: currentItem.combination,
    });

    setEditDialogOpen(false);
    setEditingItemIndex(null);
    toast({
      title: "Item atualizado",
      description: "As alterações foram aplicadas ao seu pedido.",
      duration: 2000,
    });
  };

  if (cartItems.length === 0) {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <h2 className="text-xl font-semibold mb-4">Seu carrinho está vazio</h2>
            <Button onClick={() => navigate("/")} variant="outline">
              Voltar ao cardápio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Button
          type="button"
          variant="outline"
          className="border-gray-300 text-gray-700 hover:bg-gray-100"
          onClick={() => navigate(-1)}
          disabled={isLoading}
        >
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">Finalizar Pedido</h1>
      </div>
      {blockOrder && <div className="mb-4"><StoreClosedBanner /></div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="customerPhone">Telefone/WhatsApp</Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+55 (11) 91234-5678"
                  value={customerPhone}
                  onFocus={() => {
                    if (!customerPhone) setCustomerPhone("+55 ");
                  }}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  disabled={phoneLoading}
                  maxLength={20}
                  required
                />
                {phoneLoading && <p className="text-sm text-gray-500 mt-1">Buscando dados...</p>}
              </div>
              
              <div>
                <Label htmlFor="customerName">Nome completo</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <Separator />

              <div>
                <Label className="mb-3 block">Forma de Recebimento</Label>
                <RadioGroup
                  value={deliveryMethod}
                  onValueChange={(value: "delivery" | "pickup") => setDeliveryMethod(value)}
                  className="flex items-center gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="delivery" id="delivery" />
                    <Label htmlFor="delivery" className="font-normal cursor-pointer">Entrega</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pickup" id="pickup" />
                    <Label htmlFor="pickup" className="font-normal cursor-pointer">Retirada no Balcão</Label>
                  </div>
                </RadioGroup>
              </div>

              <h3 className="text-lg font-semibold">Endereço de Entrega</h3>
              
              {deliveryMethod === "delivery" && (
                <div className="space-y-4">
                  <div>
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  value={cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  disabled={cepLoading}
                  required
                />
                {cepLoading && <p className="text-sm text-gray-500 mt-1">Buscando CEP...</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-1">
                  <Label htmlFor="street">Rua</Label>
                  <Input
                    id="street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-1">
                  <Label htmlFor="number">Número</Label>
                  <Input
                    id="number"
                    ref={numberInputRef}
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  placeholder="Apto, bloco, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>
              </div>
                </div>
              )}

              <Separator />

              <div>
                <Label>Forma de Pagamento</Label>
                <RadioGroup value={paymentMethod} onValueChange={(value: "card" | "cash" | "pix" | "stripe") => setPaymentMethod(value)}>
                  {cardDeliveryEnabled && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="card" id="card" />
                      <Label htmlFor="card">Cartão (na entrega)</Label>
                    </div>
                  )}
                  {cashEnabled && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cash" id="cash" />
                      <Label htmlFor="cash">Dinheiro</Label>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pix" id="pix" />
                    <Label htmlFor="pix">PIX</Label>
                  </div>
                  {stripeEnabled && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="stripe" id="stripe" />
                      <Label htmlFor="stripe"> Pagamento Online com Cartão</Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="observations">Observações</Label>
                <Textarea
                  id="observations"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Observações sobre o pedido..."
                />
              </div>

              {freteError && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm text-center">
                  {freteError}
                </div>
              )}

            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo do Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {cartItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-0 border-b pb-4 mb-2 last:border-b-0 last:pb-0 relative group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-lg">{item.name}</p>
                      {item.isHalfPizza && item.combination ? (
                        <div className="text-sm text-gray-600">
                          <p>{item.quantity}x Pizza {item.combination.tamanho} - Meio a meio</p>
                          <p className="text-xs">1/2 {item.combination.sabor1.name} + 1/2 {item.combination.sabor2.name}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">
                          {item.quantity}x {item.priceFrom ? (
                            <span>
                              <span className="text-xs text-gray-500">a partir de</span> R$ 0,00
                            </span>
                          ) : (
                            `R$ ${item.price.toFixed(2)}`
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="text-right font-semibold text-lg">
                        {/* Exibe apenas o preço base da pizza/item */}
                        R$ {(() => {
                          const baseUnitPrice = item.isHalfPizza
                            ? (item.price ?? 0)
                            : (item.priceFrom ? 0 : (item.price ?? 0));
                          return (baseUnitPrice * item.quantity).toFixed(2);
                        })()}
                      </div>
                      {!(item as any).__couponGiftId && item.hasVariations && item.variationGroups && item.variationGroups.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleEditItem(index)}
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                          title="Editar item"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {!(item as any).__couponGiftId && (
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          title="Remover item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Exibir grupos de variações e suas quantidades/subtotais */}
                  {item.selectedVariations && item.selectedVariations.length > 0 && (
                    <div className="mt-2 ml-1 text-sm">
                      {item.selectedVariations.map((group, groupIndex) => (
                        <div key={groupIndex} className="mb-2">
                          <div className="font-semibold text-muted-foreground">{group.groupName}:</div>
                          <div className="ml-2 text-muted-foreground flex flex-col gap-0.5">
                            {group.variations.map((variation, varIndex) => {
                              // Para pizza meio a meio com "whole", multiplica por 2
                              const halfMultiplier = item.isHalfPizza && variation.halfSelection === "whole" ? 2 : 1;
                              const displayQuantity = (variation.quantity || 1) * halfMultiplier;
                              const variationTotal =
                                (variation.additionalPrice || 0) *
                                displayQuantity *
                                item.quantity;

                              // Mostrar quantidade sempre, mesmo se for 1
                              if (variation.quantity > 0) {
                                return (
                                  <div key={varIndex} className="flex items-center justify-between">
                                    <span>
                                      <span className="inline-block w-7">{displayQuantity}x</span>
                                      {variation.name || "Variação"}
                                      {variation.additionalPrice && variation.additionalPrice > 0 ? (
                                        <>
                                          {" "}
                                          <span className="text-muted-foreground/70">
                                            (+R$ {variation.additionalPrice.toFixed(2)})
                                          </span>
                                        </>
                                      ) : null}
                                    </span>
                                    {/* Mostrar subtotal apenas se houver preço */}
                                    {variation.additionalPrice && variation.additionalPrice > 0 && (
                                      <span className="text-green-600 font-semibold tabular-nums">
                                        +R$ {(variationTotal).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Exibir borda recheada selecionada */}
                  {item.selectedBorder && (
                    <div className="mt-2 ml-1 text-sm">
                      <div className="font-semibold text-muted-foreground">Borda:</div>
                      <div className="ml-2 text-muted-foreground flex items-center justify-between">
                        <span>
                          {item.selectedBorder.name}
                          {item.selectedBorder.additionalPrice > 0 && (
                            <span className="text-muted-foreground/70 ml-1">
                              (+R$ {item.selectedBorder.additionalPrice.toFixed(2)})
                            </span>
                          )}
                        </span>
                        {item.selectedBorder.additionalPrice > 0 && (
                          <span className="text-green-600 font-semibold tabular-nums">
                            +R$ {(item.selectedBorder.additionalPrice * item.quantity).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Subtotal do item */}
                  <div className="flex justify-end mt-2 pt-2 border-t border-dashed">
                    <span className="text-sm font-semibold">
                      Subtotal: R$ {(() => {
                        const basePrice = item.isHalfPizza
                          ? (item.price ?? 0)
                          : (item.priceFrom ? 0 : (item.price ?? 0));
                        
                        let variationsTotal = 0;
                        if (item.selectedVariations && item.selectedVariations.length > 0) {
                          item.selectedVariations.forEach((group) => {
                            group.variations.forEach((variation) => {
                              const halfMultiplier = item.isHalfPizza && variation.halfSelection === "whole" ? 2 : 1;
                              const additionalPrice = variation.additionalPrice || 0;
                              const quantity = variation.quantity || 1;
                              variationsTotal += additionalPrice * quantity * halfMultiplier;
                            });
                          });
                        }
                        
                        // Adicionar valor da borda selecionada
                        const borderPrice = item.selectedBorder?.additionalPrice || 0;
                        
                        return ((basePrice + variationsTotal + borderPrice) * item.quantity).toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>
              ))}
              
              <Separator />

              <CouponField />

              <Separator />

              <div className="space-y-2">
                {(() => {
                  const giftOriginalTotal = cartItems.reduce((s: number, it: any) => {
                    if (!it?.__couponGiftId) return s;
                    const op = Number(it.__originalPrice || 0);
                    return s + op * (it.quantity || 1);
                  }, 0);
                  return (
                    <div className="flex justify-between text-md items-center">
                      <span>Subtotal:</span>
                      <span className="flex items-center gap-2">
                        {giftOriginalTotal > 0 && (
                          <span className="line-through text-red-500 font-semibold">
                            R$ {(cartTotal + giftOriginalTotal).toFixed(2)}
                          </span>
                        )}
                        <span>R$ {cartTotal.toFixed(2)}</span>
                      </span>
                    </div>
                  );
                })()}
                
                {discountAmount > 0 && (
                  <div className="flex justify-between text-md text-green-600">
                    <span>Desconto ({appliedCoupon?.nome}):</span>
                    <span>- R$ {discountAmount.toFixed(2)}</span>
                  </div>
                )}

                {!hasFreteGratis && deliveryMethod === "delivery" && superfreteLoading && (
                  <div className="text-sm text-muted-foreground">Calculando opções de frete...</div>
                )}

                {!hasFreteGratis && deliveryMethod === "delivery" && superfreteOpcoes.length > 0 && (
                  <div className="space-y-2 border rounded-md p-3">
                    <div className="text-sm font-semibold">Escolha a forma de envio:</div>
                    <RadioGroup
                      value={superfreteSelecionado?.toString() || ""}
                      onValueChange={(val) => {
                        const id = parseInt(val);
                        const op = superfreteOpcoes.find((o) => o.id === id);
                        if (op) {
                          setSuperfreteSelecionado(id);
                          setValorFrete(op.price);
                        }
                      }}
                    >
                      {superfreteOpcoes.map((op) => (
                        <div key={op.id} className="flex items-center justify-between py-1">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value={op.id.toString()} id={`sf-op-${op.id}`} />
                            <Label htmlFor={`sf-op-${op.id}`} className="font-normal cursor-pointer">
                              {op.name}
                              {op.delivery_time !== null && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({op.delivery_time} dias úteis)
                                </span>
                              )}
                            </Label>
                          </div>
                          <span className="text-sm font-medium">R$ {op.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {deliveryMethod === "pickup" ? (
                  <div className="flex justify-between text-md text-muted-foreground">
                    <span>Recebimento:</span>
                    <span>Retirada no Balcão</span>
                  </div>
                ) : hasFreteGratis ? (
                  <div className="flex justify-between text-md text-green-600">
                    <span>Frete:</span>
                    <span>🚚 Grátis!</span>
                  </div>
                ) : valorFrete > 0 ? (
                  <div className="flex justify-between text-md">
                    <span>Frete:</span>
                    <span>R$ {valorFrete.toFixed(2)}</span>
                  </div>
                ) : null}

                
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>R$ {(finalTotal + (hasFreteGratis || deliveryMethod === "pickup" ? 0 : valorFrete)).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full h-9 bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
            onClick={() => navigate("/")}
          >
            🍕 Adicionar mais itens
          </Button>

          {blockOrder && <StoreClosedBanner />}

          <Button
            type="button"
            className="w-full h-11"
            disabled={isLoading || (!!freteError && deliveryMethod === "delivery") || (!freteCalculado && !hasFreteGratis && deliveryMethod === "delivery") || blockOrder}
            onClick={(e) => {
              e.preventDefault();
              const form = document.querySelector('form');
              if (form) form.requestSubmit();
            }}
          >
            {blockOrder
              ? "Loja fechada — pedidos indisponíveis"
              : isLoading
                ? "Processando..."
                : (!freteCalculado && !hasFreteGratis && deliveryMethod === "delivery")
                  ? "Informe o CEP para calcular o frete"
                  : `Finalizar Pedido - ${formatCurrency(finalTotal + (hasFreteGratis || deliveryMethod === "pickup" ? 0 : valorFrete))}`}
          </Button>
        </div>
      </div>

      {/* Dialog de confirmação para deletar item */}
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item do pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este item do seu pedido?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (itemToDelete) {
                  removeFromCart(itemToDelete);
                  setItemToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de edição de item */}
      {editingItemIndex !== null && cartItems[editingItemIndex] && (
        <ProductVariationDialog
          item={cartItems[editingItemIndex]}
          isOpen={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setEditingItemIndex(null);
          }}
          onAddToCart={handleEditConfirm}
          availableVariations={editAvailableVariations}
          groupVariations={editGroupVariations}
          initialSelections={cartItems[editingItemIndex].selectedVariations}
          initialBorder={cartItems[editingItemIndex].selectedBorder}
          confirmLabel="Atualizar item"
        />
      )}

      {/* Dialog: confirmar atualização do número cadastrado */}
      <AlertDialog open={phoneChangeDialogOpen} onOpenChange={setPhoneChangeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualizar número de WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              O número informado <strong>{customerPhone}</strong> é diferente do que está no seu cadastro
              {originalRegisteredPhone ? <> (<strong>{formatPhoneWithCountryCode(originalRegisteredPhone)}</strong>)</> : null}.
              Deseja atualizar o seu cadastro com este novo número?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelPhoneChange}>
              Não, manter o atual
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPhoneChange}>
              Sim, atualizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: endereço diferente do cadastro */}
      <Dialog open={addressChangeDialogOpen} onOpenChange={setAddressChangeDialogOpen}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <button
            type="button"
            onClick={() => setAddressChangeDialogOpen(false)}
            aria-label="Fechar"
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-lg ring-2 ring-red-300 hover:bg-red-700 focus:outline-none focus:ring-4"
          >
            <span className="text-xl font-bold leading-none">×</span>
          </button>
          <DialogHeader>
            <DialogTitle>Endereço preenchido é diferente do cadastro</DialogTitle>
            <DialogDescription>
              Detectamos que o endereço informado no checkout está diferente do endereço salvo no seu cadastro.
              Como deseja prosseguir?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div><strong>Cadastro:</strong> {registeredAddress ? `${registeredAddress.rua}, ${registeredAddress.numero}${registeredAddress.complemento ? `, ${registeredAddress.complemento}` : ""} - ${registeredAddress.bairro}, ${registeredAddress.cidade}` : "-"}</div>
            <div><strong>Novo:</strong> {`${street}, ${number}${complement ? `, ${complement}` : ""} - ${neighborhood}, ${city}`}</div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={updatingAddress}
              onClick={() => {
                oneTimeAddressRef.current = true;
                setAddressChangeDialogOpen(false);
                const run = pendingSubmitRef.current;
                pendingSubmitRef.current = null;
                run?.();
              }}
            >
              Só nesta entrega
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={updatingAddress}
              onClick={async () => {
                await updateRegisteredAddress();
                oneTimeAddressRef.current = false;
                setAddressChangeDialogOpen(false);
                const run = pendingSubmitRef.current;
                pendingSubmitRef.current = null;
                run?.();
              }}
            >
              {updatingAddress ? "Atualizando..." : "Atualizar Cadastro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={otpDialogOpen} onOpenChange={(open) => { if (!verifyingOtp) setOtpDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verificação por WhatsApp</DialogTitle>
            <DialogDescription>
              Enviamos um código de verificação para <strong>{customerPhone}</strong>.
              Digite o código abaixo para confirmar a atualização do seu número.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Código de verificação"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              autoFocus
            />
            {otpError && <p className="text-sm text-destructive">{otpError}</p>}
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={sendingOtp}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {sendingOtp ? "Enviando..." : "Reenviar código"}
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtpDialogOpen(false)} disabled={verifyingOtp}>
              Cancelar
            </Button>
            <Button onClick={handleVerifyOtp} disabled={verifyingOtp}>
              {verifyingOtp ? "Validando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={promoBlockOpen}
        onOpenChange={(open) => {
          setPromoBlockOpen(open);
          if (!open && appliedCoupon?.tipo === "compre_e_ganhe" && !isCouponRequirementsMet()) {
            // Reexibe o toast amarelo no canto quando o modal é fechado sem ação
            showPromoRequirementsToast(
              (appliedCoupon.descricao || "").trim() ||
                "Adicione os produtos exigidos para receber o brinde desta promoção."
            );
          }
        }}
      >
        <DialogContent className="border-yellow-400 bg-yellow-50 text-yellow-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-yellow-900">Requisitos da Promoção:</DialogTitle>
            <DialogDescription className="text-yellow-900/90 whitespace-pre-line">
              {(appliedCoupon?.descricao || "").trim() ||
                "Adicione os produtos exigidos para receber o brinde desta promoção."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              className="w-full bg-yellow-500 text-yellow-950 hover:bg-yellow-600"
              onClick={() => {
                setPromoBlockOpen(false);
                dismissPromoRequirementsToast();
                const requeridos = (appliedCoupon?.produtos_requeridos || []) as any[];
                const first = requeridos[0];
                let target = "/";
                if (first) {
                  if (first.tipo === "categoria" && first.category_id) {
target = `/cardapio?cat=${encodeURIComponent(first.category_id)}`;
                  } else if (first.product_id) {
                    target = `/cardapio?item=${encodeURIComponent(first.product_id)}`;
                  }
                }
                // Reexibe o toast amarelo no cardápio
                if (appliedCoupon?.tipo === "compre_e_ganhe") {
                  showPromoRequirementsToast(
                    (appliedCoupon.descricao || "").trim() ||
                      "Adicione os produtos exigidos para receber o brinde desta promoção."
                  );
                }
                navigate(target);
              }}
            >
              Entendi ! Voltar ao Cardápio
            </Button>
            <Button
              variant="outline"
              className="w-full border-yellow-400 text-yellow-900 hover:bg-yellow-100"
              onClick={() => {
                setAppliedCoupon(null);
                dismissPromoRequirementsToast();
                setPromoBlockOpen(false);
                toast({
                  title: "Promoção removida",
                  description: "O cupom foi removido do seu pedido.",
                });
              }}
            >
              Não quero a promoção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Checkout;
