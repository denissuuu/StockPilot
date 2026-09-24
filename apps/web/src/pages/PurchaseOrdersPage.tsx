import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, ClipboardList, PackageCheck, Plus, RefreshCw, Search, Trash2, TriangleAlert, Truck, X } from "lucide-react";
import { getApiErrorMessage, productsApi, purchaseOrdersApi, suppliersApi } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { formatCurrency, formatDate, formatNumber } from "../lib/format";
import type { PurchaseOrder, PurchaseOrderPayload } from "../types/api";
import { Badge, Button, Card, EmptyState, ErrorState, InlineNotice, Input, LoadingState, Modal, PageHeader, Select } from "../components/ui";

interface OrderLine { productId: string; quantity: number; unitPrice: number }
interface OrderForm { supplierId: string; expectedAt: string; items: OrderLine[] }

const createEmptyLine = (): OrderLine => ({ productId: "", quantity: 1, unitPrice: 0 });
const EMPTY_ORDERS: PurchaseOrder[] = [];

const initialForm: OrderForm = { supplierId: "", expectedAt: "", items: [createEmptyLine()] };

export function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState<OrderForm>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const ordersQuery = useQuery({ queryKey: queryKeys.purchaseOrders(), queryFn: () => purchaseOrdersApi.list() });
  const suppliersQuery = useQuery({ queryKey: queryKeys.suppliers, queryFn: () => suppliersApi.list() });
  const productsQuery = useQuery({ queryKey: queryKeys.products(), queryFn: () => productsApi.list() });
  const createMutation = useMutation({ mutationFn: purchaseOrdersApi.create, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }); void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }); setIsCreateOpen(false); setForm(initialForm); } });
  const orderMutation = useMutation({ mutationFn: purchaseOrdersApi.order, onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }) });
  const receiveMutation = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: NonNullable<Parameters<typeof purchaseOrdersApi.receive>[1]> }) => purchaseOrdersApi.receive(id, payload), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }); void queryClient.invalidateQueries({ queryKey: ["stock"] }); void queryClient.invalidateQueries({ queryKey: ["products"] }); void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }); setSelectedOrder(null); } });

  const orders = ordersQuery.data ?? EMPTY_ORDERS;
  const suppliers = suppliersQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const filteredOrders = useMemo(() => { const needle = search.toLowerCase().trim(); return orders.filter((order) => { const text = `${order.reference || ""} ${order.supplier?.name || ""}`.toLowerCase(); return (!needle || text.includes(needle)) && (statusFilter === "all" || (order.status ?? "DRAFT") === statusFilter); }); }, [orders, search, statusFilter]);
  const pendingCount = orders.filter((order) => ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"].includes(order.status ?? "DRAFT")).length;

  const updateLine = (index: number, patch: Partial<OrderLine>) => setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.supplierId) { setFormError("Sélectionnez un fournisseur."); return; }
    if (form.items.length === 0 || form.items.some((item) => !item.productId || item.quantity <= 0)) { setFormError("Ajoutez au moins une ligne avec un produit et une quantité valide."); return; }
    const payload: PurchaseOrderPayload = { supplierId: form.supplierId, expectedAt: form.expectedAt || undefined, items: form.items };
    createMutation.mutate(payload);
  };
  const handleReceive = (order: PurchaseOrder) => {
    if (order.status === "DRAFT") { setFormError("Transmettez la commande avant de la réceptionner."); return; }
    if (!window.confirm(`Confirmer la réception de la commande ${order.reference || order.id} ? Le stock sera mis à jour.`)) return;
    const lines = (order.items ?? []).map((item) => ({ lineId: item.id ?? item.productId, quantity: Math.max(0, item.quantity - (item.receivedQuantity ?? 0)) })).filter((item) => item.quantity > 0);
    const items = (order.items ?? []).map((item) => ({ productId: item.productId, quantity: Math.max(0, item.quantity - (item.receivedQuantity ?? 0)) })).filter((item) => item.quantity > 0);
    receiveMutation.mutate({ id: order.id, payload: { items, lines } });
  };

  if (ordersQuery.isLoading || suppliersQuery.isLoading || productsQuery.isLoading) return <LoadingState label="Chargement des commandes d'achat…" />;
  if (ordersQuery.isError) return <ErrorState message="Les commandes d'achat n'ont pas pu être chargées." onRetry={() => void ordersQuery.refetch()} />;

  return <div className="page-stack">
    <PageHeader eyebrow="Approvisionnement" title="Commandes d'achat" description="Planifiez vos réceptions et gardez vos niveaux de stock sous contrôle." actions={<Button leftIcon={<Plus size={17} />} onClick={() => { setForm(initialForm); setFormError(null); setIsCreateOpen(true); }}>Nouvelle commande</Button>} />
    {receiveMutation.isError ? <InlineNotice tone="danger"><TriangleAlert size={17} />{getApiErrorMessage(receiveMutation.error, "La réception n'a pas pu être enregistrée.")}</InlineNotice> : null}
    <div className="mini-stat-grid mini-stat-grid--three"><Card className="mini-stat"><span>Commandes</span><strong>{formatNumber(orders.length)}</strong><small>dans l'historique</small></Card><Card className="mini-stat"><span>À traiter</span><strong className="text-amber">{formatNumber(pendingCount)}</strong><small>en attente ou partielles</small></Card><Card className="mini-stat"><span>Fournisseurs</span><strong>{formatNumber(suppliers.length)}</strong><small>partenaires actifs ou non</small></Card></div>
    <Card className="table-card"><div className="table-toolbar"><div className="search-control"><Search size={17} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une commande, un fournisseur…" aria-label="Rechercher une commande" />{search ? <button type="button" onClick={() => setSearch("")} aria-label="Effacer la recherche"><X size={15} /></button> : null}</div><Select aria-label="Filtrer par statut" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tous les statuts</option><option value="DRAFT">Brouillon</option><option value="ORDERED">Transmise</option><option value="PARTIALLY_RECEIVED">Partiellement reçue</option><option value="RECEIVED">Reçue</option><option value="CANCELLED">Annulée</option></Select></div>
      {filteredOrders.length === 0 ? <EmptyState title="Aucune commande" description={orders.length ? "Aucune commande ne correspond à vos filtres." : "Créez une commande pour réapprovisionner votre stock."} action={!orders.length ? <Button leftIcon={<Plus size={16} />} onClick={() => setIsCreateOpen(true)}>Créer une commande</Button> : undefined} icon={<ClipboardList size={20} />} /> : <div className="order-list">{filteredOrders.map((order) => <article className="order-row" key={order.id}><div className="order-main"><div className="order-icon"><Truck size={18} /></div><div><div className="order-title"><strong>{order.reference || `Commande ${order.id.slice(0, 8)}`}</strong><Badge status={order.status ?? "DRAFT"} /></div><span>{order.supplier?.name || "Fournisseur non renseigné"} · {order.itemCount ?? order.items?.length ?? 0} article{(order.itemCount ?? order.items?.length ?? 0) > 1 ? "s" : ""}</span></div></div><div className="order-date"><CalendarDays size={14} /><span>{formatDate(order.expectedAt ?? order.createdAt)}</span></div><strong className="order-total">{formatCurrency(order.totalAmount)}</strong><div className="order-actions"><Button variant="secondary" size="sm" onClick={() => setSelectedOrder(order)}>Détails</Button>{order.status === "DRAFT" ? <Button size="sm" leftIcon={<RefreshCw size={15} />} onClick={() => orderMutation.mutate(order.id)} isLoading={orderMutation.isPending && orderMutation.variables === order.id}>Transmettre</Button> : order.status === "ORDERED" || order.status === "PARTIALLY_RECEIVED" ? <Button size="sm" leftIcon={<PackageCheck size={15} />} onClick={() => handleReceive(order)} isLoading={receiveMutation.isPending && receiveMutation.variables?.id === order.id} disabled={receiveMutation.isPending}>Réceptionner</Button> : <span className="received-label"><CheckCircle2 size={15} /> {order.status === "CANCELLED" ? "Annulée" : "Reçue"}</span>}</div></article>)}</div>}
      <div className="table-footer"><span>{filteredOrders.length} commande{filteredOrders.length > 1 ? "s" : ""}</span><span className="table-footer-hint">Les réceptions mettent le stock à jour automatiquement</span></div>
    </Card>

    <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nouvelle commande d'achat" description="Sélectionnez un fournisseur et les produits à commander." size="lg"><form className="form-grid" onSubmit={handleSubmit}>{formError ? <InlineNotice tone="danger">{formError}</InlineNotice> : null}{createMutation.isError ? <InlineNotice tone="danger">{getApiErrorMessage(createMutation.error, "Impossible de créer la commande.")}</InlineNotice> : null}<Select label="Fournisseur *" value={form.supplierId} onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))}><option value="">Sélectionner un fournisseur</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</Select><Input label="Date de livraison souhaitée" type="date" value={form.expectedAt} onChange={(event) => setForm((current) => ({ ...current, expectedAt: event.target.value }))} /><div className="form-section-title form-grid-full"><span>Lignes de commande</span><Button type="button" variant="soft" size="sm" leftIcon={<Plus size={14} />} onClick={() => setForm((current) => ({ ...current, items: [...current.items, createEmptyLine()] }))}>Ajouter une ligne</Button></div>{form.items.map((line, index) => <div className="order-line form-grid-full" key={index}><Select label={`Produit ${index + 1}`} value={line.productId} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); updateLine(index, { productId: event.target.value, unitPrice: product?.purchasePrice ?? line.unitPrice }); }}><option value="">Choisir un produit</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.sku}</option>)}</Select><Input label="Quantité" type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /><Input label="Prix unitaire (€)" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) })} /><button className="icon-button icon-button--danger line-remove" type="button" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} disabled={form.items.length === 1} aria-label="Supprimer la ligne"><Trash2 size={16} /></button></div>)}<div className="order-form-total form-grid-full"><span>Total estimé</span><strong>{formatCurrency(form.items.reduce((total, line) => total + line.quantity * line.unitPrice, 0))}</strong></div><div className="form-actions form-grid-full"><Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Annuler</Button><Button type="submit" isLoading={createMutation.isPending}>Créer la commande</Button></div></form></Modal>

    <Modal open={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} title={selectedOrder?.reference || "Détail de la commande"} description={selectedOrder ? `${selectedOrder.supplier?.name || "Fournisseur"} · ${formatDate(selectedOrder.orderedAt ?? selectedOrder.createdAt)}` : undefined}><div className="order-detail"><div className="detail-banner"><div><span>Statut</span><Badge status={selectedOrder?.status ?? "DRAFT"} /></div><div><span>Montant total</span><strong>{formatCurrency(selectedOrder?.totalAmount)}</strong></div></div><div className="detail-lines"><div className="detail-line detail-line--head"><span>Produit</span><span>Reçu</span><span>Quantité</span><span>Total</span></div>{(selectedOrder?.items ?? []).map((item, index) => <div className="detail-line" key={item.id ?? `${item.productId}-${index}`}><span>{item.product?.name || products.find((product) => product.id === item.productId)?.name || item.productId}</span><span>{formatNumber(item.receivedQuantity ?? 0)} / {formatNumber(item.quantity)}</span><span>{formatNumber(item.quantity)}</span><strong>{formatCurrency(item.total ?? item.quantity * (item.unitPrice ?? 0))}</strong></div>)}</div>{!selectedOrder?.items?.length ? <EmptyState title="Détail indisponible" description="L'API n'a pas renvoyé les lignes de cette commande." /> : null}<div className="form-actions"><Button variant="ghost" onClick={() => setSelectedOrder(null)}>Fermer</Button>{selectedOrder && (selectedOrder.status === "ORDERED" || selectedOrder.status === "PARTIALLY_RECEIVED") ? <Button leftIcon={<RefreshCw size={15} />} onClick={() => handleReceive(selectedOrder)} isLoading={receiveMutation.isPending}>Confirmer la réception</Button> : null}</div></div></Modal>
  </div>;
}
