import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Edit3, Filter, Package, Plus, Search, Trash2, TriangleAlert, X } from "lucide-react";
import { categoriesApi, downloadBlob, getApiErrorMessage, productsApi } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { formatCurrency, formatNumber, isLowStock } from "../lib/format";
import type { Product, ProductPayload } from "../types/api";
import { Badge, Button, Card, EmptyState, ErrorState, Input, InlineNotice, LoadingState, Modal, PageHeader, Select, Textarea } from "../components/ui";

const EMPTY_PRODUCTS: Product[] = [];

const emptyForm: ProductPayload = {
  sku: "",
  name: "",
  description: "",
  categoryId: "",
  purchasePrice: 0,
  salePrice: 0,
  stockQuantity: 0,
  minStock: 5,
  unit: "unit",
  status: "ACTIVE",
};

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductPayload>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const productsQuery = useQuery({ queryKey: queryKeys.products(), queryFn: () => productsApi.list() });
  const categoriesQuery = useQuery({ queryKey: queryKeys.categories, queryFn: () => categoriesApi.list() });

  useEffect(() => {
    if (editingProduct) {
      setForm({
        sku: editingProduct.sku,
        name: editingProduct.name,
        description: editingProduct.description ?? "",
        categoryId: editingProduct.categoryId ?? editingProduct.category?.id ?? "",
        purchasePrice: editingProduct.purchasePrice ?? 0,
        salePrice: editingProduct.salePrice ?? 0,
        stockQuantity: editingProduct.stockQuantity ?? 0,
        minStock: editingProduct.minStock ?? 5,
        unit: editingProduct.unit ?? "unit",
        status: editingProduct.status ?? "ACTIVE",
      });
    } else {
      setForm(emptyForm);
    }
    setFormError(null);
  }, [editingProduct, isModalOpen]);

  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      closeModal();
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProductPayload> }) => productsApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      closeModal();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: productsApi.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
  const exportMutation = useMutation({
    mutationFn: () => productsApi.exportCsv({ search, categoryId: categoryFilter === "all" ? undefined : categoryFilter, status: statusFilter === "all" ? undefined : statusFilter }),
    onSuccess: (blob) => downloadBlob(blob, `stockpilot-produits-${new Date().toISOString().slice(0, 10)}.csv`),
  });

  const products = productsQuery.data ?? EMPTY_PRODUCTS;
  const categories = categoriesQuery.data ?? [];
  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !needle || [product.name, product.sku, product.description].some((value) => value?.toLowerCase().includes(needle));
      const matchesCategory = categoryFilter === "all" || product.categoryId === categoryFilter || product.category?.id === categoryFilter;
      const matchesStatus = statusFilter === "all" || (product.status ?? "ACTIVE") === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter((product) => (product.status ?? "ACTIVE") === "ACTIVE").length,
    lowStock: products.filter((product) => isLowStock(product.stockQuantity, product.minStock)).length,
    stockValue: products.reduce((total, product) => total + (product.stockQuantity ?? 0) * (product.purchasePrice ?? 0), 0),
  }), [products]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormError(null);
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) {
      setFormError("Le SKU et le nom du produit sont obligatoires.");
      return;
    }
    const payload: ProductPayload = {
      ...form,
      sku: form.sku.trim(),
      name: form.name.trim(),
      categoryId: form.categoryId || undefined,
      purchasePrice: Number(form.purchasePrice) || 0,
      salePrice: Number(form.salePrice) || 0,
      stockQuantity: Number(form.stockQuantity) || 0,
      minStock: Number(form.minStock) || 0,
    };
    if (editingProduct) updateMutation.mutate({ id: editingProduct.id, payload });
    else createMutation.mutate(payload);
  };

  const handleDelete = (product: Product) => {
    if (window.confirm(`Désactiver « ${product.name} » ? Son historique sera conservé.`)) deleteMutation.mutate(product.id);
  };

  if (productsQuery.isLoading) return <LoadingState label="Chargement du catalogue…" />;
  if (productsQuery.isError) return <ErrorState message="Le catalogue n'a pas pu être chargé." onRetry={() => void productsQuery.refetch()} />;

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Catalogue" title="Produits" description={`${formatNumber(stats.total)} références dans votre catalogue.`} actions={<><Button variant="secondary" leftIcon={<Download size={16} />} onClick={() => exportMutation.mutate()} isLoading={exportMutation.isPending}>Exporter CSV</Button><Button leftIcon={<Plus size={17} />} onClick={openCreateModal}>Nouveau produit</Button></>} />

      {deleteMutation.isError ? <InlineNotice tone="danger"><TriangleAlert size={17} />{getApiErrorMessage(deleteMutation.error, "Impossible de supprimer ce produit.")}</InlineNotice> : null}
      {exportMutation.isError ? <InlineNotice tone="danger"><TriangleAlert size={17} />{getApiErrorMessage(exportMutation.error, "L'export n'a pas pu être généré.")}</InlineNotice> : null}

      <div className="mini-stat-grid">
        <Card className="mini-stat"><span>Références</span><strong>{formatNumber(stats.total)}</strong><small>dans le catalogue</small></Card>
        <Card className="mini-stat"><span>Actifs</span><strong className="text-green">{formatNumber(stats.active)}</strong><small>{stats.total ? Math.round((stats.active / stats.total) * 100) : 0}% du catalogue</small></Card>
        <Card className="mini-stat"><span>Sous le seuil</span><strong className={stats.lowStock ? "text-amber" : "text-green"}>{formatNumber(stats.lowStock)}</strong><small>à réapprovisionner</small></Card>
        <Card className="mini-stat"><span>Valeur du stock</span><strong>{formatCurrency(stats.stockValue)}</strong><small>au prix d'achat</small></Card>
      </div>

      <Card className="table-card">
        <div className="table-toolbar">
          <div className="search-control"><Search size={17} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un produit, un SKU…" aria-label="Rechercher un produit" />{search ? <button type="button" onClick={() => setSearch("")} aria-label="Effacer la recherche"><X size={15} /></button> : null}</div>
          <div className="filter-controls"><div className="filter-label"><Filter size={15} /> Filtres</div><Select aria-label="Filtrer par catégorie" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Toutes les catégories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select><Select aria-label="Filtrer par statut" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tous les statuts</option><option value="ACTIVE">Actifs</option><option value="INACTIVE">Inactifs</option></Select></div>
        </div>
        {filteredProducts.length === 0 ? <EmptyState title="Aucun produit trouvé" description={products.length ? "Modifiez vos filtres ou votre recherche." : "Commencez par ajouter votre première référence."} action={products.length ? <Button variant="secondary" size="sm" onClick={() => { setSearch(""); setCategoryFilter("all"); setStatusFilter("all"); }}>Réinitialiser les filtres</Button> : <Button size="sm" leftIcon={<Plus size={15} />} onClick={openCreateModal}>Ajouter un produit</Button>} icon={<Package size={20} />} /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Produit</th><th>Catégorie</th><th>Prix de vente</th><th>Stock</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredProducts.map((product) => { const low = isLowStock(product.stockQuantity, product.minStock); return <tr key={product.id}><td><div className="table-product"><span className="product-thumb"><Package size={17} /></span><div><strong>{product.name}</strong><span>{product.sku}</span></div></div></td><td><span className="muted-text">{product.category?.name || "Non catégorisé"}</span></td><td><strong>{formatCurrency(product.salePrice)}</strong><span className="cell-subtext">Achat {formatCurrency(product.purchasePrice)}</span></td><td><div className="stock-cell"><strong className={low ? "text-amber" : ""}>{formatNumber(product.stockQuantity)}</strong><span>Seuil {formatNumber(product.minStock)}</span></div></td><td><Badge status={product.status ?? "ACTIVE"} /></td><td><div className="row-actions"><button className="icon-button icon-button--small" type="button" onClick={() => openEditModal(product)} aria-label={`Modifier ${product.name}`}><Edit3 size={16} /></button><button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => handleDelete(product)} aria-label={`Supprimer ${product.name}`}><Trash2 size={16} /></button></div></td></tr>; })}</tbody></table></div>}
        <div className="table-footer"><span>{filteredProducts.length} résultat{filteredProducts.length > 1 ? "s" : ""}</span><span className="table-footer-hint">Les modifications sont synchronisées avec l'API</span></div>
      </Card>

      <Modal open={isModalOpen} onClose={closeModal} title={editingProduct ? "Modifier le produit" : "Nouveau produit"} description={editingProduct ? `Mettez à jour les informations de ${editingProduct.name}.` : "Ajoutez une référence à votre catalogue."} size="lg">
        <form className="form-grid" onSubmit={handleSubmit}>
          {formError ? <InlineNotice tone="danger">{formError}</InlineNotice> : null}
          {createMutation.isError ? <InlineNotice tone="danger">{getApiErrorMessage(createMutation.error, "Impossible de créer le produit.")}</InlineNotice> : null}
          {updateMutation.isError ? <InlineNotice tone="danger">{getApiErrorMessage(updateMutation.error, "Impossible de mettre à jour le produit.")}</InlineNotice> : null}
          <Input label="Nom du produit *" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex. Casque audio Pro" required />
          <Input label="SKU *" value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} placeholder="SKU-001" required />
          <Select label="Catégorie" value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}><option value="">Non catégorisé</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select>
          <Select label="Unité" value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}><option value="unit">Unité</option><option value="kg">Kilogramme</option><option value="L">Litre</option><option value="carton">Carton</option><option value="pack">Pack</option></Select>
          <Input label="Prix d'achat (€)" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(event) => setForm((current) => ({ ...current, purchasePrice: Number(event.target.value) }))} />
          <Input label="Prix de vente (€)" type="number" min="0" step="0.01" value={form.salePrice} onChange={(event) => setForm((current) => ({ ...current, salePrice: Number(event.target.value) }))} />
          <Input label={editingProduct ? "Stock actuel" : "Stock initial"} type="number" min="0" step="1" value={form.stockQuantity} onChange={(event) => setForm((current) => ({ ...current, stockQuantity: Number(event.target.value) }))} disabled={Boolean(editingProduct)} hint={editingProduct ? "Modifiable uniquement via un mouvement de stock." : undefined} />
          <Input label="Seuil d'alerte" type="number" min="0" step="1" value={form.minStock} onChange={(event) => setForm((current) => ({ ...current, minStock: Number(event.target.value) }))} />
          <Select label="Statut" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProductPayload["status"] }))}><option value="ACTIVE">Actif</option><option value="INACTIVE">Inactif</option></Select>
          <Textarea label="Description" className="form-grid-full" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Une note interne sur cette référence…" />
          <div className="form-actions form-grid-full"><Button type="button" variant="ghost" onClick={closeModal}>Annuler</Button><Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>{editingProduct ? "Enregistrer les modifications" : "Créer le produit"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
