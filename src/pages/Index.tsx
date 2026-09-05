import React, { useState, useEffect, useRef, useCallback } from "react";
import { getAllMenuItems } from "@/services/menuItemService";
import { getAllCategories } from "@/services/categoryService";
import { MenuItem, Category, POPULAR_CATEGORY_ID } from "@/types/menu";
import RestaurantHeader from "@/components/RestaurantHeader";
import CategoryNav from "@/components/CategoryNav";
import MenuSection from "@/components/MenuSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, MessageCircle, UserCircle2 } from "lucide-react";
import ChatAssistant from "@/components/ChatAssistant";
import PromoPopup from "@/components/PromoPopup";
import ProfileDrawer from "@/components/ProfileDrawer";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { trackViewItemList, trackMenuVisit } from "@/utils/trackingEvents";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { useActiveOrdersCount } from "@/hooks/useActiveOrdersCount";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import StoreClosedBanner from "@/components/StoreClosedBanner";
import { useBannerAction } from "@/hooks/useBannerAction";
import { getRecompensasCliente } from "@/services/fidelidadeService";
import { getProfile } from "@/services/profileService";
import { phoneVariants } from "@/utils/phoneUtils";

const Index = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [scrollSpyCategory, setScrollSpyCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [visibleSections, setVisibleSections] = useState(3);
  const { currentUser, logOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useLayoutSettings();
  const runBannerAction = useBannerAction();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [rewardsCount, setRewardsCount] = useState(0);
  const activeOrdersCount = useActiveOrdersCount();
  const itemRefs = useRef<Record<string, { triggerClick: () => void } | null>>({});
  const deepLinkHandled = useRef(false);
  const menuVisitTracked = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScroll = useRef(false);
  const pendingScrollCat = useRef<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [items, cats] = await Promise.all([getAllMenuItems(), getAllCategories()]);
        setMenuItems(items.filter(item => item.available !== false || (item.stock !== null && item.stock <= 0)));
        const visibleCats = cats.filter(c => c.visible !== false);
        setCategories(visibleCats);
        if (visibleCats.length > 0) {
          setActiveCategory(prev => prev || visibleCats[0].id);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
    if (!menuVisitTracked.current) {
      menuVisitTracked.current = true;
      trackMenuVisit();
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setRewardsCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const knownPhone = (currentUser as any).phoneNumber || null;
        const [profile, earlyRecompensas] = await Promise.all([
          getProfile(currentUser.id).catch(() => null),
          knownPhone
            ? getRecompensasCliente(phoneVariants(knownPhone)).catch(() => null)
            : Promise.resolve(null),
        ]);
        const phone = profile?.phone || knownPhone;
        if (!phone) {
          if (!cancelled && earlyRecompensas) setRewardsCount(earlyRecompensas.length);
          return;
        }
        const variants = phoneVariants(phone);
        // Se já buscamos com o mesmo telefone, reaproveita
        if (earlyRecompensas && knownPhone && profile?.phone === knownPhone) {
          if (!cancelled) setRewardsCount(earlyRecompensas.length);
          return;
        }
        const recompensas = await getRecompensasCliente(variants);
        if (!cancelled) setRewardsCount(recompensas.length);
      } catch (e) {
        console.error("Erro ao carregar recompensas (badge):", e);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    const stripeStatus = searchParams.get("stripe");
    const sessionId = searchParams.get("session_id");
    const orderId = searchParams.get("order");
    if (!stripeStatus) return;

    if (stripeStatus === "success" && sessionId) {
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke("verificar-stripe-pagamento", {
            body: { sessionId, orderId },
          });
          if (error) throw error;
          if (data?.paid) {
            toast({ title: "Pagamento confirmado!", description: "Seu pedido foi pago com sucesso." });
          } else {
            toast({
              title: "Pagamento pendente",
              description: `Status: ${data?.payment_status || "desconhecido"}`,
            });
          }
        } catch (e: any) {
          toast({
            title: "Erro ao verificar pagamento",
            description: e.message || "Tente novamente.",
            variant: "destructive",
          });
        } finally {
          searchParams.delete("stripe");
          searchParams.delete("session_id");
          searchParams.delete("order");
          setSearchParams(searchParams, { replace: true });
        }
      })();
    } else if (stripeStatus === "cancel") {
      toast({ title: "Pagamento cancelado", description: "Você cancelou o pagamento.", variant: "destructive" });
      searchParams.delete("stripe");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleDeepLink = useCallback(() => {
    if (deepLinkHandled.current) return;
    const itemId = searchParams.get("item");
    if (!itemId || menuItems.length === 0) return;
    const matchedItem = menuItems.find(i => i.id === itemId);
    if (!matchedItem) return;

    let attempts = 0;
    const tryOpen = () => {
      const el = document.querySelector(`[data-product-id="${itemId}"]`);
      const handle = itemRefs.current[itemId];
      if (el && handle) {
        deepLinkHandled.current = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          handle.triggerClick();
          searchParams.delete("item");
          setSearchParams(searchParams, { replace: true });
        }, 600);
      } else if (attempts++ < 50) setTimeout(tryOpen, 100);
    };
    tryOpen();
  }, [menuItems, searchParams, setSearchParams]);

  useEffect(() => { handleDeepLink(); }, [handleDeepLink]);

  // Deep link por categoria: ?cat=<id> seleciona a categoria e rola ao topo
  useEffect(() => {
    const catId = searchParams.get("cat");
    if (!catId || categories.length === 0) return;
    const found = categories.find((c) => c.id === catId);
    if (!found) return;
    setActiveCategory(catId);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
    searchParams.delete("cat");
    setSearchParams(searchParams, { replace: true });
  }, [categories, searchParams, setSearchParams]);

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = searchTerm === "" || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name, "pt-BR"));

  const groupedItems = categories.reduce((acc, category) => {
    const items = filteredItems.filter(item => category.id === POPULAR_CATEGORY_ID ? item.popular : (item.category === category.id || (item.additionalCategories || []).includes(category.id))).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name, "pt-BR"));
    if (items.length > 0) acc.push({ category, items });
    return acc;
  }, [] as Array<{ category: Category; items: MenuItem[] }>);

  // Scroll spy: destaca a categoria em foco enquanto o usuário rola a página
  useEffect(() => {
    if (groupedItems.length === 0) {
      setScrollSpyCategory(null);
      return;
    }
    const handleScroll = () => {
      if (isProgrammaticScroll.current) return;
      const navOffset = 120; // altura aproximada do sticky nav
      let currentId: string | null = null;
      for (const { category } of groupedItems) {
        const el = document.getElementById(`cat-section-${category.id}`);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top - navOffset <= 0) {
          currentId = category.id;
        } else {
          break;
        }
      }
      setScrollSpyCategory(currentId ?? groupedItems[0]?.category.id ?? null);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [groupedItems]);

  const highlightCategory = scrollSpyCategory ?? activeCategory;

  // Renderização progressiva: reveal mais seções quando o sentinel entra em viewport
  useEffect(() => {
    if (visibleSections >= groupedItems.length) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisibleSections((n) => Math.min(n + 3, groupedItems.length));
      }
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visibleSections, groupedItems.length]);

  // Se busca ativa ou navegação por deep link, revela tudo
  useEffect(() => {
    if (searchTerm || searchParams.get("item") || searchParams.get("cat")) {
      setVisibleSections(groupedItems.length || 3);
    }
  }, [searchTerm, searchParams, groupedItems.length]);

  // Rola até a categoria escolhida assim que a seção estiver renderizada
  useEffect(() => {
    const id = pendingScrollCat.current;
    if (!id) return;
    let tries = 0;
    let settleTimer: number | undefined;
    const tryScroll = () => {
      const el = document.getElementById(`cat-section-${id}`);
      if (!el) {
        if (tries++ < 40) window.setTimeout(tryScroll, 50);
        else {
          pendingScrollCat.current = null;
          isProgrammaticScroll.current = false;
        }
        return;
      }
      const y = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: "smooth" });
      // reajusta caso o layout mude (imagens carregando)
      settleTimer = window.setTimeout(() => {
        const el2 = document.getElementById(`cat-section-${id}`);
        if (el2) {
          const y2 = el2.getBoundingClientRect().top + window.scrollY - 100;
          if (Math.abs(y2 - window.scrollY) > 8) window.scrollTo({ top: y2, behavior: "smooth" });
        }
        window.setTimeout(() => {
          pendingScrollCat.current = null;
          isProgrammaticScroll.current = false;
        }, 500);
      }, 700);
    };
    tryScroll();
    return () => { if (settleTimer) window.clearTimeout(settleTimer); };
  }, [visibleSections, activeCategory]);



  if (isLoading) {
    return (
      <div style={{ backgroundColor: settings.cor_background, minHeight: '100vh' }}>
        <div className="w-full max-w-[1000px] mx-auto aspect-[4/1] bg-muted animate-pulse" />
        <div className="container mx-auto px-4 -mt-4 md:-mt-16 relative z-10">
          <div className="rounded-lg bg-muted animate-pulse h-24 md:h-28" />
        </div>
        <div className="container mx-auto px-4 mt-6 space-y-6">
          <div className="h-10 bg-muted animate-pulse rounded-xl" />
          <div className="h-8 w-40 bg-muted animate-pulse rounded" />
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-muted animate-pulse rounded-lg h-40" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: settings.cor_background, color: settings.cor_fonte, minHeight: '100vh' }}>
      
      
      {/* HEADER COMPACTADO */}
      <div className="mt-0 md:mt-0 relative z-20 w-full px-0">
        <RestaurantHeader
          onBannerClick={() =>
            runBannerAction(
              (settings as any).banner_principal_action_type,
              (settings as any).banner_principal_action_value,
              (settings as any).banner_principal_action_target
            )
          }
          actions={
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsChatOpen(true)}
                className="w-full px-2 text-[11px] md:text-sm h-9 flex items-center justify-center gap-1"
                style={{ backgroundColor: settings.cor_botoes, color: settings.cor_fonte_botoes }}
              >
                <MessageCircle className="h-3.5 w-3.5" /> Fale Conosco
              </Button>
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={() => (currentUser ? setIsProfileOpen(true) : navigate("/login"))}
                  className="w-full px-2 text-[11px] md:text-sm h-9 flex items-center justify-center gap-1"
                  style={{ backgroundColor: settings.cor_botoes, color: settings.cor_fonte_botoes }}
                >
                  <UserCircle2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{currentUser ? "Conta-Cupons-Pedidos" : "Entrar"}</span>
                </Button>
                {currentUser && (activeOrdersCount > 0 || rewardsCount > 0) && (
                  <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-white">
                    {activeOrdersCount + rewardsCount}
                  </span>
                )}
              </div>
            </div>
          }
        />
      </div>

      {/* ALTERADO: Ajustado o wrapper e adicionado -mt-1 no mobile para eliminar o espaço fantasma */}
      {(() => {
        const quantidade = (settings as any).banner_extra_quantidade || '2';
        const tamanho = (settings as any).banner_extra_tamanho || 'normal';
        const isSingle = quantidade === '1';
        const isLongo = isSingle && tamanho === 'longo';

        // Quando único, exibe apenas o banner 1
        const urls = isSingle
          ? [settings.empresa_banner_extra1_url]
          : [settings.empresa_banner_extra1_url, settings.empresa_banner_extra2_url];

        const hasAny = urls.some((u) => !!u);
        if (!hasAny) return null;

        const renderBanner = (url: string, i: number, ratio: string) =>
          url ? (
            <div
              key={i}
              className="w-full overflow-hidden rounded-lg bg-muted cursor-pointer shadow-sm"
              style={{ aspectRatio: ratio }}
              onClick={() =>
                runBannerAction(
                  (settings as any)[`banner_extra${i + 1}_action_type`],
                  (settings as any)[`banner_extra${i + 1}_action_value`],
                  (settings as any)[`banner_extra${i + 1}_action_target`]
                )
              }
            >
              <img
                src={url}
                alt={`Banner ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "low"}
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
          ) : null;

        return (
          <div className="w-full px-4 pt-1 pb-0 md:pt-1 md:pb-3 border-b border-muted/40 -mt-1 md:mt-0 relative z-10" style={{ backgroundColor: settings.cor_background }}>
            {isLongo ? (
              // Banner longo: mesma proporção 4:1 (1000x250) no mobile e desktop
              <div className="max-w-4xl mx-auto">
                {renderBanner(settings.empresa_banner_extra1_url, 0, "4 / 1")}
              </div>
            ) : isSingle ? (
              // Banner único normal: centralizado com a largura de um banner
              <div className="grid grid-cols-2 gap-3 max-w-4xl mx-auto">
                <div className="col-start-1 col-end-3 mx-auto w-[calc(50%-0.375rem)]">
                  {renderBanner(settings.empresa_banner_extra1_url, 0, "2 / 1")}
                </div>
              </div>
            ) : (
              // Dois banners lado a lado
              <div className="grid grid-cols-2 gap-3 max-w-4xl mx-auto">
                {urls.map((url, i) => renderBanner(url, i, "2 / 1"))}
              </div>
            )}
          </div>
        );
      })()}


      {/* BANNER DE LOJA FECHADA */}
      <div className="max-w-3xl mx-auto px-4">
        <StoreClosedBanner />
      </div>
        
      {/* BUSCA MOBILE */}
      <div className="order-1 md:order-3 px-4 z-10 mt-1 flex md:hidden mb-1">
        <div className="relative w-full max-w-4xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/60" />
          <Input
            type="text"
            placeholder="Busque por pizza ou ingredientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 h-12 text-sm border-2 border-muted bg-card shadow-md rounded-xl focus-visible:ring-primary"
          />
          {searchTerm && (
            <X
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer"
            />
          )}
        </div>
      </div>

      {/* MENU DE CATEGORIAS */}
      <CategoryNav 
        categories={categories.filter(c => c.showInCategoryNav !== false)} 
        activeCategory={highlightCategory}
        onSelectCategory={(id) => {
          setActiveCategory(id);
          setScrollSpyCategory(id);
          isProgrammaticScroll.current = true;
          pendingScrollCat.current = id;
          // garante que todas as seções estejam renderizadas antes de rolar
          setVisibleSections(groupedItems.length || 3);
        }}
      />

      {/* BUSCA DESKTOP */}
      <div className="px-4 z-10 mt-6 mb-6 hidden md:block">
        <div className="relative w-full max-w-4xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/60" />
          <Input
            type="text"
            placeholder="Busque por pizza ou ingredientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 h-12 text-sm border-2 border-muted bg-card shadow-md rounded-xl focus-visible:ring-primary"
          />
          {searchTerm && <X onClick={() => setSearchTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground cursor-pointer" />}
        </div>
      </div>

      {/* CONTAINER DE PRODUTOS */}
      <div className="container mx-auto px-4 pt-0 pb-8 md:pt-8">
        {groupedItems.slice(0, visibleSections).map(({ category, items }, idx) => (
          <MenuSection
            key={category.id}
            title={category.name}
            categoryId={category.id}
            category={category}
            items={items}
            itemRefs={itemRefs}
            priority={idx === 0}
          />
        ))}
        {visibleSections < groupedItems.length && (
          <div ref={loadMoreRef} style={{ minHeight: 400 }} aria-hidden="true" />
        )}
      </div>

      <PromoPopup />
      <ChatAssistant isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <ProfileDrawer open={isProfileOpen} onOpenChange={setIsProfileOpen} onRewardsCountChange={setRewardsCount} />
    </div>
  );
};

export default Index;
