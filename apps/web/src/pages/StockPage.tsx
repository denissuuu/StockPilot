import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Download, History, Minus, Plus, Search, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import { downloadBlob, getApiErrorMessage, productsApi, stockApi } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { formatDateTime, formatNumber, isLowStock } from "../lib/format";
import type { Product, StockAdjustmentPayload, StockMovement } from "../types/api";
import { Badge, Button, Card, EmptyState, ErrorState, InlineNotice, Input, LoadingState, Modal, PageHeader, Select } from "../components/ui";

type AdjustmentForm = StockAdjustmentPayload;

const EMPTY_PRODUCTS: Product[] = [];
const EMPTY_MOVEMENTS: StockMovement[] = [];

const initialForm: AdjustmentForm = { productId: "", quantity: 0, reason: "OTHER", note: "" };

export function StockPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<AdjustmentForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const movementsQuery = useQuery({ queryKey: queryKeys.movements(), queryFn: () => stockApi.list() });
  const productsQuery = useQuery({ queryKey: queryKeys.products(), queryFn: () => productsApi.list() });
  const adjustmentMutation = useMutation({ mutationFn: stockApi.adjust, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["stock"] }); void queryClient.invalidateQueries({ queryKey: ["products"] }); void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }); setIsModalOpen(false); setForm(initialForm); } });
  const exportMutation = useMutation({ mutationFn: () => stockApi.exportCsv({ search, type: typeFilter === "all" ? undefined : typeFilter }), onSuccess: (blob) => downloadBlob(blob, `stockpilot-mouvements-${new Date().toISOString().slice(0, 10)}.csv`) });

  const products = productsQuery.data ?? EMPTY_PRODUCTS;
  const movements = movementsQuery.data ?? EMPTY_MOVEMENTS;
  const filteredMovements = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return movements.filter((movement) => {
      const productName = movement.product?.name || products.find((product) => product.id === movement.productId)?.name || "";
      const matchesSearch = !needle || `${productName} ${movement.product?.sku || ""} ${movement.reason || ""} ${movement.note || ""}`.toLowerCase().includes(needle);
      return matchesSearch && (typeFilter === "all" || movement.type === typeFilter);
    });
  }, [movements, products, search, typeFilter]);
  const stats = useMemo(() => ({ total: movements.length, entries: movements.filter((item) => item.quantity > 0).length, exits: movements.filter((item) => item.quantity < 0).length, lowStock: products.filter((product) => isLowStock(product.stockQuantity, product.minStock)).length }), [movements, products]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.productId) { setFormError("Sélectionnez un produit."); return; }
    if (!form.quantity) { setFormError("Saisissez une quantité différente de zéro."); return; }
    if (!form.note?.trim()) { setFormError("Précisez la raison de l'ajustement."); return; }
    adjustmentMutation.mutate({ ...form, note: form.note.trim() });
  };

  if (movementsQuery.isLoading || productsQuery.isLoading) return <LoadingState label="Chargement des mouvements de stock…" />;
  if (movementsQuery.isError) return <ErrorState message="L'historique des mouvements n'a pas pu être chargé." onRetry={() => void movementsQuery.refetch()} />;

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Inventaire" title="Mouvements de stock" description="Suivez chaque entrée, sortie et ajustement en temps réel." actions={<><Button variant="secondary" leftIcon={<Download size={16} />} onClick={() => exportMutation.mutate()} isLoading={exportMutation.isPending}>Exporter CSV</Button><Button leftIcon={<SlidersHorizontal size={17} />} onClick={() => setIsModalOpen(true)}>Ajuster le stock</Button></>} />
      {adjustmentMutation.isError ? <InlineNotice tone="danger"><TriangleAlert size={17} />{getApiErrorMessage(adjustmentMutation.error, "L'ajustement n'a pas pu être enregistré.")}</InlineNotice> : null}
      {exportMutation.isError ? <InlineNotice tone="danger"><TriangleAlert size={17} />{getApiErrorMessage(exportMutation.error, "L'export n'a pas pu être généré.")}</InlineNotice> : null}
      <div className="mini-stat-grid mini-stat-grid--three"><Card className="mini-stat"><span>Mouvements</span><strong>{formatNumber(stats.total)}</strong><small>sur l'historique chargé</small></Card><Card className="mini-stat"><span>Entrées</span><strong className="text-green">{formatNumber(stats.entries)}</strong><small>réceptions et entrées</small></Card><Card className="mini-stat"><span>Alertes</span><strong className={stats.lowStock ? "text-amber" : "text-green"}>{formatNumber(stats.lowStock)}</strong><small>produits sous le seuil</small></Card></div>

      <Card className="table-card">
        <div className="table-toolbar"><div className="search-control"><Search size={17} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un produit, une référence…" aria-label="Rechercher dans les mouvements" />{search ? <button type="button" onClick={() => setSearch("")} aria-label="Effacer la recherche"><X size={15} /></button> : null}</div><Select aria-label="Filtrer par type de mouvement" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Tous les mouvements</option><option value="INITIAL">Stock initial</option><option value="PURCHASE_RECEIPT">Réceptions</option><option value="SALE">Ventes</option><option value="ADJUSTMENT_IN">Ajustements positifs</option><option value="ADJUSTMENT_OUT">Ajustements négatifs</option></Select></div>
        {filteredMovements.length === 0 ? <EmptyState title="Aucun mouvement" description={movements.length ? "Aucun mouvement ne correspond à vos critères." : "Les entrées et sorties de stock apparaîtront ici."} icon={<History size={20} />} /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Produit</th><th>Type</th><th>Quantité</th><th>Note</th><th>Motif</th></tr></thead><tbody>{filteredMovements.map((movement) => { const product = products.find((item) => item.id === movement.productId); const positive = movement.quantity >= 0; return <tr key={movement.id}><td><span className="date-cell">{formatDateTime(movement.createdAt)}</span></td><td><div className="table-product"><span className="product-thumb"><PackageIcon /></span><div><strong>{movement.product?.name || product?.name || "Produit supprimé"}</strong><span>{movement.product?.sku || product?.sku || "—"}</span></div></div></td><td><Badge status={movement.type} /></td><td><span className={positive ? "quantity-positive" : "quantity-negative"}>{positive ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}{positive ? "+" : ""}{formatNumber(movement.quantity)}</span></td><td><span className="muted-text reason-cell">{movement.note || "—"}</span></td><td><span className="muted-text">{movement.reason || "—"}</span></td></tr>; })}</tbody></table></div>}
        <div className="table-footer"><span>{filteredMovements.length} mouvement{filteredMovements.length > 1 ? "s" : ""}</span><span className="table-footer-hint"><History size={13} /> Journal d'audit</span></div>
      </Card>

      <Modal open={isModalOpen} onClose={() => { setIsModalOpen(false); setFormError(null); }} title="Ajuster le stock" description="Utilisez un ajustement pour corriger un écart d'inventaire.">
        <form className="form-grid" onSubmit={handleSubmit}>
          {formError ? <InlineNotice tone="danger">{formError}</InlineNotice> : null}
          <Select label="Produit *" value={form.productId} onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))}><option value="">Sélectionner un produit</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.sku} ({formatNumber(product.stockQuantity)} en stock)</option>)}</Select>
          <Select label="Motif de l'ajustement" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value as AdjustmentForm["reason"] }))}><option value="COUNT_CORRECTION">Correction d'inventaire</option><option value="DAMAGE">Produit endommagé</option><option value="EXPIRY">Produit périmé</option><option value="THEFT">Perte / vol</option><option value="FOUND">Produit retrouvé</option><option value="OTHER">Autre</option></Select>
          <Input label="Quantité *" type="number" step="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))} hint="Utilisez un nombre négatif pour retirer du stock." />
          <Input label="Note / référence *" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Ex. Écart inventaire annuel" />
          <div className="adjustment-preview form-grid-full"><div><Minus size={15} /> Stock actuel</div><strong>{formatNumber(products.find((product) => product.id === form.productId)?.stockQuantity)}</strong><div><Plus size={15} /> Après ajustement</div><strong className={form.quantity < 0 ? "text-amber" : "text-green"}>{formatNumber((products.find((product) => product.id === form.productId)?.stockQuantity ?? 0) + form.quantity)}</strong></div>
          <div className="form-actions form-grid-full"><Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Annuler</Button><Button type="submit" isLoading={adjustmentMutation.isPending}>Enregistrer l'ajustement</Button></div>
        </form>
      </Modal>
    </div>
  );
}

function PackageIcon() {
  return <span className="mini-package-icon" aria-hidden="true"><span /><span /></span>;
}
