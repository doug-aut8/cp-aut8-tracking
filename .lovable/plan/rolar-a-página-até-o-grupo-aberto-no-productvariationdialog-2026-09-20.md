# Rolar a página até o grupo aberto no ProductVariationDialog

## Objetivo
Quando um cliente, após abrir o produto, clica para expandir o accordion **"Bordas"** ou um **grupo de variações** colapsável, a página deve rolar automaticamente para deixar o cabeçalho do grupo clicado no topo da área visível.

## Contexto atual (confirmado em `src/components/ProductVariationDialog.tsx`)
- O conteúdo rola dentro de `<div className="flex-1 min-h-0 overflow-y-auto">` (linha 328).
- As seções são accordions:
  - **Bordas** — botão `toggleSection(BORDERS_KEY, false)` (linha 462).
  - **Grupos de variação colapsáveis** — botão `toggleSection(group.id, defaultExpanded)` (linha 558). Grupos não-colapsáveis não têm toggle (são `<div>`, não `<button>`), então não são afetados.
- `toggleSection` (linha 321) só inverte o estado em `expandedGroups`.

## Mudança
Tudo em `src/components/ProductVariationDialog.tsx`:

1. Criar `const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})`.
2. Atribuir `ref` ao `<div>` container de cada seção:
   - Bordas: `ref={el => (sectionRefs.current[BORDERS_KEY] = el)}` no `<div key="borders-section">`.
   - Grupos: `ref={el => (sectionRefs.current[group.id] = el)}` no `<div key={group.id}>`.
3. Atualizar `toggleSection` para, quando a seção for **expandir**, agendar um `requestAnimationFrame` que chama `sectionRefs.current[key]?.scrollIntoView({ block: 'start', behavior: 'smooth' })`.
   - Calcular `willExpand` a partir do estado atual antes do `setState`.
   - Só rolar ao expandir (nunca ao recolher).
4. Observação: `scrollIntoView` rola apenas o ancestral rolável mais próximo (o `overflow-y-auto` do dialog), sem afetar a página externa.

## Não incluído
- Sem mudanças no admin (`PizzaBordersSection` / `VariationGroupsSection`) — o pedido é só sobre o fluxo do cliente.
- Grupos não-colapsáveis continuam sem comportamento de clique/rolagem.
