import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Download as PageIcon } from "lucide-react";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, ArrowLeft, Users, Pizza, ShoppingBag, FileText, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getAllMenuItems } from "@/services/menuItemService";
import { getAllCategories } from "@/services/categoryService";
import { getAllVariations } from "@/services/variationService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const Exportacoes = () => {
  const { toast } = useToast();
  const [loadingSupabase, setLoadingSupabase] = useState(false);
  const [loadingMenuItems, setLoadingMenuItems] = useState(false);
  const [loadingVendas, setLoadingVendas] = useState<"csv" | "pdf" | null>(null);
  const [periodoVendas, setPeriodoVendas] = useState<"dia" | "semana" | "mes" | "personalizado">("dia");
  const [rangeVendas, setRangeVendas] = useState<DateRange | undefined>();

  const formatDateBR = (value: any) => {
    if (!value) return "";
    let d: Date;
    if (typeof value?.toDate === "function") {
      d = value.toDate();
    } else if (typeof value === "object" && "seconds" in value) {
      d = new Date(value.seconds * 1000);
    } else {
      d = new Date(value);
    }
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  };

  const escapeCsv = (value: unknown) => {
    if (value === null || value === undefined) return "";
    let str: string;
    if (typeof value === "object") {
      try {
        str = JSON.stringify(value);
      } catch {
        str = String(value);
      }
    } else {
      str = String(value);
    }
    if (str.includes(";") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const downloadCsv = (rows: string[], filename: string) => {
    const csvContent = rows.join("\r\n");
    // BOM UTF-8 para o Excel reconhecer acentos corretamente em PT-BR
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportUsers = async () => {
    setLoadingSupabase(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: "Não há clientes para exportar.",
        });
        setLoadingSupabase(false);
        return;
      }

      const headers = [
        { key: "name", label: "Nome" },
        { key: "email", label: "E-mail" },
        { key: "phone", label: "Telefone" },
        { key: "role", label: "Função" },
        { key: "created_at", label: "Criado em" },
        { key: "last_sign_in_at", label: "Último acesso" },
        { key: "firebase_id", label: "Firebase ID" },
        { key: "id", label: "ID" },
      ];

      const headerLine = headers.map((h) => escapeCsv(h.label)).join(";");
      const rows = data.map((row: any) =>
        headers
          .map((h) => {
            const value =
              h.key === "created_at" || h.key === "last_sign_in_at"
                ? formatDateBR(row[h.key])
                : row[h.key];
            return escapeCsv(value);
          })
          .join(";")
      );

      const today = new Date().toISOString().split("T")[0];
      downloadCsv([headerLine, ...rows], `clientes_supabase_${today}.csv`);

      toast({
        title: "Exportação concluída",
        description: `${data.length} cliente(s) exportado(s) com sucesso.`,
      });
    } catch (err: any) {
      console.error("Erro ao exportar clientes do Supabase:", err);
      toast({
        title: "Erro ao exportar",
        description: err.message || "Não foi possível exportar os clientes.",
        variant: "destructive",
      });
    } finally {
      setLoadingSupabase(false);
    }
  };



  // Escape para CSV separado por VÍRGULAS (compatível com import do Supabase)
  const escapeCsvComma = (value: unknown) => {
    if (value === null || value === undefined) return "";
    let str: string;
    if (typeof value === "object") {
      try {
        str = JSON.stringify(value);
      } catch {
        str = String(value);
      }
    } else {
      str = String(value);
    }
    if (
      str.includes(",") ||
      str.includes('"') ||
      str.includes("\n") ||
      str.includes("\r")
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const downloadCsvComma = (rows: string[], filename: string) => {
    const csvContent = rows.join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportMenuItems = async () => {
    setLoadingMenuItems(true);
    try {
      const [items, categories, variations] = await Promise.all([
        getAllMenuItems(),
        getAllCategories(),
        getAllVariations(),
      ]);

      if (!items || items.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: "Não há itens cadastrados para exportar.",
        });
        setLoadingMenuItems(false);
        return;
      }

      const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
      const variationMap = new Map(variations.map((v) => [v.id, v]));

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const headers = [
        "deeplink",
        "id",
        "nome",
        "descricao",
        "preco",
        "custo",
        "categoria_id",
        "categoria_nome",
        "categorias_adicionais_ids",
        "categorias_adicionais_nomes",
        "tipo_item",
        "permite_meio_a_meio",
        "max_sabores",
        "url_imagem",
        "produto_disponivel",
        "item_popular",
        "preco_a_partir_de",
        "frete_gratis",
        "grupos_variacoes",
        "variacoes",
        "mensagens_personalizadas",
      ];

      const headerLine = headers.map(escapeCsvComma).join(",");

      const rows = items.map((item) => {
        const additionalIds = item.additionalCategories || [];
        const additionalNames = additionalIds.map(
          (id) => categoryMap.get(id) || id
        );

        const variationGroups = (item.variationGroups || []).map((g) => ({
          id: g.id,
          name: g.name,
          internalName: g.internalName || "",
          minRequired: g.minRequired,
          maxAllowed: g.maxAllowed,
          customMessage: g.customMessage || "",
          applyToHalfPizza: !!g.applyToHalfPizza,
          allowPerHalf: !!g.allowPerHalf,
          variations: (g.variations || []).map((vid) => {
            const v = variationMap.get(vid);
            return v
              ? {
                  id: v.id,
                  name: v.name,
                  additionalPrice: v.additionalPrice ?? 0,
                  available: v.available !== false,
                }
              : { id: vid };
          }),
        }));

        const flatVariations = variationGroups.flatMap((g) =>
          g.variations.map((v: any) => v.name).filter(Boolean)
        );

        const customMessages = variationGroups
          .map((g) => g.customMessage)
          .filter((m) => m && m.trim() !== "");

        const row: Record<string, unknown> = {
          deeplink: origin ? `${origin}/cardapio?item=${item.id}` : `/cardapio?item=${item.id}`,
          id: item.id,
          nome: item.name,
          descricao: item.description,
          preco: item.price,
          custo: item.cost ?? "",
          categoria_id: item.category,
          categoria_nome: categoryMap.get(item.category) || "",
          categorias_adicionais_ids: JSON.stringify(additionalIds),
          categorias_adicionais_nomes: JSON.stringify(additionalNames),
          tipo_item: item.tipo || "padrao",
          permite_meio_a_meio: !!item.permiteCombinacao,
          max_sabores: item.maxSabores ?? "",
          url_imagem: item.image || "",
          produto_disponivel: item.available !== false,
          item_popular: !!item.popular,
          preco_a_partir_de: !!item.priceFrom,
          frete_gratis: !!item.freteGratis,
          grupos_variacoes: JSON.stringify(variationGroups),
          variacoes: JSON.stringify(flatVariations),
          mensagens_personalizadas: JSON.stringify(customMessages),
        };

        return headers.map((h) => escapeCsvComma(row[h])).join(",");
      });

      const today = new Date().toISOString().split("T")[0];
      downloadCsvComma([headerLine, ...rows], `itens_menu_${today}.csv`);

      toast({
        title: "Exportação concluída",
        description: `${items.length} item(s) exportado(s) com sucesso.`,
      });
    } catch (err: any) {
      console.error("Erro ao exportar itens do menu:", err);
      toast({
        title: "Erro ao exportar",
        description: err.message || "Não foi possível exportar os itens do menu.",
        variant: "destructive",
      });
    } finally {
      setLoadingMenuItems(false);
    }
  };

  const getPeriodoRange = (): { from: Date; to: Date } | null => {
    const now = new Date();
    if (periodoVendas === "dia") {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { from, to };
    }
    if (periodoVendas === "semana") {
      // Domingo a sábado da semana atual
      const day = now.getDay(); // 0 = domingo
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    if (periodoVendas === "mes") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { from, to };
    }
    if (periodoVendas === "personalizado") {
      if (!rangeVendas?.from || !rangeVendas?.to) return null;
      const from = new Date(rangeVendas.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(rangeVendas.to);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    return null;
  };

  const fetchVendas = async () => {
    const range = getPeriodoRange();
    if (!range) {
      toast({
        title: "Selecione um período",
        description: "Escolha as datas inicial e final para exportar.",
        variant: "destructive",
      });
      return null;
    }
    const { data, error } = await supabase
      .from("pedidos_sabor_delivery")
      .select("*")
      .gte("criado_em", range.from.toISOString())
      .lte("criado_em", range.to.toISOString())
      .order("criado_em", { ascending: true });
    if (error) throw error;
    return { data: data || [], range };
  };

  const handleExportVendasCsv = async () => {
    setLoadingVendas("csv");
    try {
      const result = await fetchVendas();
      if (!result) return;
      const { data, range } = result;
      if (data.length === 0) {
        toast({ title: "Nenhuma venda encontrada no período" });
        return;
      }
      const headers = Object.keys(data[0]);
      const headerLine = headers.map(escapeCsvComma).join(",");
      const rows = data.map((row: any) =>
        headers.map((h) => escapeCsvComma(row[h])).join(",")
      );
      const fname = `vendas_${format(range.from, "yyyy-MM-dd")}_a_${format(range.to, "yyyy-MM-dd")}.csv`;
      downloadCsvComma([headerLine, ...rows], fname);
      toast({ title: "Exportação concluída", description: `${data.length} venda(s) exportada(s).` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao exportar", description: err.message, variant: "destructive" });
    } finally {
      setLoadingVendas(null);
    }
  };

  const handleExportVendasPdf = async () => {
    setLoadingVendas("pdf");
    try {
      const result = await fetchVendas();
      if (!result) return;
      const { data, range } = result;
      if (data.length === 0) {
        toast({ title: "Nenhuma venda encontrada no período" });
        return;
      }
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const title = `Relatório de Vendas`;
      const subtitle = `${format(range.from, "dd/MM/yyyy")} - ${format(range.to, "dd/MM/yyyy")}`;
      doc.setFontSize(16);
      doc.text(title, 40, 40);
      doc.setFontSize(10);
      doc.text(subtitle, 40, 58);

      const cols = [
        { header: "Data", key: "criado_em" },
        { header: "Código", key: "codigo_pedido" },
        { header: "Cliente", key: "nome_cliente" },
        { header: "Telefone", key: "telefone_cliente" },
        { header: "Pagamento", key: "metodo_pagamento" },
        { header: "Status", key: "status_atual" },
        { header: "Subtotal", key: "subtotal" },
        { header: "Frete", key: "frete" },
        { header: "Desconto", key: "desconto" },
        { header: "Cupom", key: "cupom_desconto" },
        { header: "Total", key: "valor_total" },
      ];
      const fmtMoney = (v: any) =>
        v == null || v === "" ? "" : `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
      const body = data.map((row: any) =>
        cols.map((c) => {
          const v = row[c.key];
          if (c.key === "criado_em") return formatDateBR(v);
          if (["subtotal", "frete", "desconto", "valor_total"].includes(c.key))
            return fmtMoney(v);
          return v ?? "";
        })
      );
      const total = data.reduce((s: number, r: any) => s + (Number(r.valor_total) || 0), 0);

      autoTable(doc, {
        head: [cols.map((c) => c.header)],
        body,
        startY: 75,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [40, 40, 40] },
        margin: { left: 40, right: 40 },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 75;
      doc.setFontSize(11);
      doc.text(
        `Total de pedidos: ${data.length}   |   Valor total: ${fmtMoney(total)}`,
        40,
        finalY + 20
      );

      doc.save(
        `vendas_${format(range.from, "yyyy-MM-dd")}_a_${format(range.to, "yyyy-MM-dd")}.pdf`
      );
      toast({ title: "PDF gerado", description: `${data.length} venda(s) exportada(s).` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
    } finally {
      setLoadingVendas(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">

      <AdminPageHeader title="Exportações" icon={PageIcon} iconBg="bg-emerald-100" iconColor="text-emerald-600" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Exportar Clientes</CardTitle>
            <CardDescription>
              Baixe a lista completa de clientes (Supabase) em CSV compatível com Excel PT-BR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExportUsers} disabled={loadingSupabase} className="w-full">
              <Download className="h-4 w-4" />
              {loadingSupabase ? "Exportando..." : "Exportar CSV"}
            </Button>
          </CardContent>
        </Card>



        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-amber-100 rounded-full w-fit">
              <Pizza className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-xl">Exportar Itens do Menu</CardTitle>
            <CardDescription>
              Lista completa dos itens cadastrados em CSV separado por
              vírgulas, pronto para upload no Supabase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleExportMenuItems}
              disabled={loadingMenuItems}
              className="w-full"
            >
              <Download className="h-4 w-4" />
              {loadingMenuItems ? "Exportando..." : "Exportar CSV"}
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow md:col-span-2 lg:col-span-1">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-fit">
              <ShoppingBag className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-xl">Exportar Vendas</CardTitle>
            <CardDescription>
              Baixe as vendas do período selecionado em CSV ou PDF (paisagem)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={periodoVendas} onValueChange={(v: any) => setPeriodoVendas(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dia">Dia (hoje)</SelectItem>
                <SelectItem value="semana">Semana (dom a sáb)</SelectItem>
                <SelectItem value="mes">Mês atual</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {periodoVendas === "personalizado" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !rangeVendas && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rangeVendas?.from ? (
                      rangeVendas.to ? (
                        <>
                          {format(rangeVendas.from, "dd/MM/yyyy")} -{" "}
                          {format(rangeVendas.to, "dd/MM/yyyy")}
                        </>
                      ) : (
                        format(rangeVendas.from, "dd/MM/yyyy")
                      )
                    ) : (
                      <span>Selecionar datas</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={rangeVendas}
                    onSelect={setRangeVendas}
                    numberOfMonths={2}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleExportVendasCsv}
                disabled={loadingVendas !== null}
                className="w-full"
              >
                <Download className="h-4 w-4" />
                {loadingVendas === "csv" ? "Gerando..." : "Baixar em CSV"}
              </Button>
              <Button
                onClick={handleExportVendasPdf}
                disabled={loadingVendas !== null}
                variant="secondary"
                className="w-full"
              >
                <FileText className="h-4 w-4" />
                {loadingVendas === "pdf" ? "Gerando..." : "Baixar em PDF"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

};

export default Exportacoes;
