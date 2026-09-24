import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, FileText, Plus, Search, ShoppingCart, Trash2, TriangleAlert, UserRound, X } from "lucide-react";
import { customersApi, getApiErrorMessage, productsApi, salesOrdersApi } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { formatCurrency, formatDateTime, formatNumber } from "../lib/format";
import type { SalesOrder, SalesOrderPayload } from "../types/api";
import { Badge, Button, Card, EmptyState, ErrorState, InlineNotice, Input, LoadingState, Modal, PageHeader, Select } from "../components/ui";

interface SaleLine { productId: string; quantity: number; unitPrice: number }
interface SaleForm { customerId: string; items: SaleLine[]; notes: string }
const emptyLine = (): SaleLine => ({ productId: "", quantity: 1, unitPrice: 0 });
const EMPTY_SALES: SalesOrder[] = [];

const initialForm: SaleForm = { customerId: "", items: [emptyLine()], notes: "" };

export function SalesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SalesOrder | null>(null);
  const [form, setForm] = useState<SaleForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const salesQuery = useQuery({ queryKey: queryKeys.salesOrders(), queryFn: () => salesOrdersApi.list() });
  const productsQuery = useQuery({ queryKey: queryKeys.products(), queryFn: () => productsApi.list() });
  const customersQuery = useQuery({ queryKey: queryKeys.customers, queryFn: () => customersApi.list() });
  const createMutation = useMutation({ mutationFn: salesOrdersApi.create, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["sales-orders"] }); void queryClient.invalidateQueries({ queryKey: ["stock"] }); void queryClient.invalidateQueries({ queryKey: ["products"] }); void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }); setIsModalOpen(false); setForm(initialForm); } });
  const products = productsQuery.data ?? [];
  const customers = customersQuery.data ?? [];
  const sales = salesQuery.data ?? EMPTY_SALES;
  const filteredSales = useMemo(() => { const needle = search.toLowerCase().trim(); return sales.filter((sale) => { const text = `${sale.reference || ""} ${sale.customer?.name || ""}`.toLowerCase(); return (!needle || text.includes(needle)) && (statusFilter === "all" || (sale.status ?? "COMPLETED") === statusFilter); }); }, [sales, search, statusFilter]);
  const totalSales = sales.filter((sale) => sale.status === "COMPLETED").reduce((sum, sale) => sum + (sale.totalAmount ?? 0), 0);
  const updateLine = (index: number, patch: Partial<SaleLine>) => setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.customerId) { setFormError("Sélectionnez un client."); return; }
    if (form.items.length === 0 || form.items.some((line) => !line.productId || line.quantity <= 0)) { setFormError("Ajoutez au moins un produit valide à la vente."); return; }
    const payload: SalesOrderPayload = { customerId: form.customerId, items: form.items, notes: form.notes || undefined };
    createMutation.mutate(payload);
  };

  if (salesQuery.isLoading || productsQuery.isLoading || customersQuery.isLoading) return <LoadingState label="Chargement des ventes…" />;
  if (salesQuery.isError) return <ErrorState message="Les commandes clients n'ont pas pu être chargées." onRetry={() => void salesQuery.refetch()} />;

  return <div className="page-stack">
    <PageHeader eyebrow="Activité" title="Commandes clients" description="Créez vos ventes et suivez leur statut de la commande à l'expédition." actions={<Button leftIcon={<Plus size={17} />} onClick={() => { setForm(initialForm); setFormError(null); setIsModalOpen(true); }}>Nouvelle vente</Button>} />
    {createMutation.isError ? <InlineNotice tone="danger"><TriangleAlert size={17} />{getApiErrorMessage(createMutation.error, "Impossible de créer la vente.")}</InlineNotice> : null}
    <div className="mini-stat-grid mini-stat-grid--three"><Card className="mini-stat"><span>Commandes</span><strong>{formatNumber(sales.length)}</strong><small>sur la période</small></Card><Card className="mini-stat"><span>Chiffre d'affaires</span><strong>{formatCurrency(totalSales)}</strong><small>ventes enregistrées</small></Card><Card className="mini-stat"><span>Clients</span><strong>{formatNumber(customers.length)}</strong><small>dans le portefeuille</small></Card></div>
    <Card className="table-card"><div className="table-toolbar"><div className="search-control"><Search size={17} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une commande, un client…" aria-label="Rechercher une vente" />{search ? <button type="button" onClick={() => setSearch("")} aria-label="Effacer la recherche"><X size={15} /></button> : null}</div><Select aria-label="Filtrer par statut" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tous les statuts</option><option value="COMPLETED">Terminée</option><option value="CANCELLED">Annulée</option></Select></div>
      {filteredSales.length === 0 ? <EmptyState title="Aucune vente" description={sales.length ? "Aucune vente ne correspond à vos filtres." : "Créez une première commande client pour suivre vos ventes."} action={!sales.length ? <Button leftIcon={<Plus size={16} />} onClick={() => setIsModalOpen(true)}>Créer une vente</Button> : undefined} icon={<ShoppingCart size={20} />} /> : <div className="order-list">{filteredSales.map((sale) => <article className="order-row sale-row" key={sale.id}><div className="order-main"><div className="order-icon order-icon--blue"><ShoppingCart size={18} /></div><div><div className="order-title"><strong>{sale.reference || `Vente ${sale.id.slice(0, 8)}`}</strong><Badge status={sale.status ?? "PENDING"} /></div><span><UserRound size={13} /> {sale.customer?.name || "Client non renseigné"} · {formatDateTime(sale.createdAt)}</span></div></div><div className="sale-items-preview">{(sale.items ?? []).slice(0, 2).map((item) => item.product?.name || products.find((product) => product.id === item.productId)?.name).filter(Boolean).join(" · ")}{sale.itemCount && sale.itemCount > 2 ? ` +${sale.itemCount - 2}` : ""}</div><strong className="order-total">{formatCurrency(sale.totalAmount)}</strong><Button variant="secondary" size="sm" leftIcon={<FileText size={14} />} onClick={() => setSelectedSale(sale)}>Détails</Button></article>)}</div>}
      <div className="table-footer"><span>{filteredSales.length} vente{filteredSales.length > 1 ? "s" : ""}</span><span className="table-footer-hint"><ArrowUpRight size={13} /> Nouvelles ventes synchronisées</span></div>
    </Card>

    <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nouvelle vente" description="Enregistrez une commande pour un client." size="lg"><form className="form-grid" onSubmit={handleSubmit}>{formError ? <InlineNotice tone="danger">{formError}</InlineNotice> : null}{createMutation.isError ? <InlineNotice tone="danger">{getApiErrorMessage(createMutation.error)}</InlineNotice> : null}<Select label="Client *" value={form.customerId} onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}><option value="">Sélectionner un client</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</Select><div className="form-section-title form-grid-full"><span>Articles vendus</span><Button type="button" variant="soft" size="sm" leftIcon={<Plus size={14} />} onClick={() => setForm((current) => ({ ...current, items: [...current.items, emptyLine()] }))}>Ajouter un article</Button></div>{form.items.map((line, index) => <div className="order-line form-grid-full" key={index}><Select label={`Produit ${index + 1}`} value={line.productId} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); updateLine(index, { productId: event.target.value, unitPrice: product?.salePrice ?? line.unitPrice }); }}><option value="">Choisir un produit</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.sku}</option>)}</Select><Input label="Quantité" type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /><Input label="Prix unitaire (€)" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) })} /><button className="icon-button icon-button--danger line-remove" type="button" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} disabled={form.items.length === 1} aria-label="Supprimer l'article"><Trash2 size={16} /></button></div>)}<Input label="Note interne" className="form-grid-full" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Information utile pour l'équipe…" /><div className="order-form-total form-grid-full"><span>Total de la vente</span><strong>{formatCurrency(form.items.reduce((total, line) => total + line.quantity * line.unitPrice, 0))}</strong></div><div className="form-actions form-grid-full"><Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Annuler</Button><Button type="submit" isLoading={createMutation.isPending}>Créer la vente</Button></div></form></Modal>
    <Modal open={Boolean(selectedSale)} onClose={() => setSelectedSale(null)} title={selectedSale?.reference || "Détail de la vente"} description={selectedSale ? `${selectedSale.customer?.name || "Client non renseigné"} · ${formatDateTime(selectedSale.createdAt)}` : undefined}>
      <div className="order-detail">
        <div className="detail-banner"><div><span>Statut</span><Badge status={selectedSale?.status ?? "PENDING"} /></div><div><span>Montant total</span><strong>{formatCurrency(selectedSale?.totalAmount)}</strong></div></div>
        <div className="detail-lines"><div className="detail-line detail-line--head"><span>Produit</span><span>Quantité</span><span>PU</span><span>Total</span></div>{(selectedSale?.items ?? []).map((item, index) => <div className="detail-line" key={item.id ?? `${item.productId}-${index}`}><span>{item.product?.name || products.find((product) => product.id === item.productId)?.name || item.productId}</span><span>{formatNumber(item.quantity)}</span><span>{formatCurrency(item.unitPrice)}</span><strong>{formatCurrency(item.total ?? item.quantity * (item.unitPrice ?? 0))}</strong></div>)}</div>
        {!selectedSale?.items?.length ? <EmptyState title="Détail indisponible" description="L'API n'a pas renvoyé les lignes de cette vente." /> : null}
        <div className="form-actions"><Button variant="ghost" onClick={() => setSelectedSale(null)}>Fermer</Button></div>
      </div>
    </Modal>
  </div>;
}
