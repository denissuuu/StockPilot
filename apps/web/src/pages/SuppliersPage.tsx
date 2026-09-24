import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Edit3, Mail, MapPin, Phone, Plus, Search, Trash2, TriangleAlert, Truck, X } from "lucide-react";
import { getApiErrorMessage, suppliersApi } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import type { Supplier } from "../types/api";
import { Badge, Button, Card, EmptyState, ErrorState, InlineNotice, Input, LoadingState, Modal, PageHeader, Select } from "../components/ui";

const EMPTY_SUPPLIERS: Supplier[] = [];

type SupplierForm = { name: string; email: string; phone: string; address: string; status: "ACTIVE" | "INACTIVE" };
const initialForm: SupplierForm = { name: "", email: "", phone: "", address: "", status: "ACTIVE" };

export function SuppliersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const suppliersQuery = useQuery({ queryKey: queryKeys.suppliers, queryFn: () => suppliersApi.list() });
  const createMutation = useMutation({ mutationFn: suppliersApi.create, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers }); closeModal(); } });
  const updateMutation = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Partial<Supplier> }) => suppliersApi.update(id, payload), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers }); closeModal(); } });
  const deleteMutation = useMutation({ mutationFn: suppliersApi.remove, onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers }) });

  useEffect(() => {
    setForm(editingSupplier ? { name: editingSupplier.name, email: editingSupplier.email ?? "", phone: editingSupplier.phone ?? "", address: editingSupplier.address ?? "", status: editingSupplier.status ?? "ACTIVE" } : initialForm);
    setFormError(null);
  }, [editingSupplier, isModalOpen]);
  const closeModal = () => { setIsModalOpen(false); setEditingSupplier(null); setFormError(null); };
  const suppliers = suppliersQuery.data ?? EMPTY_SUPPLIERS;
  const filteredSuppliers = useMemo(() => { const needle = search.toLowerCase().trim(); return suppliers.filter((supplier) => !needle || [supplier.name, supplier.email, supplier.address].some((value) => value?.toLowerCase().includes(needle))); }, [suppliers, search]);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) { setFormError("Le nom du fournisseur est obligatoire."); return; }
    const payload = { ...form, name: form.name.trim() };
    if (editingSupplier) updateMutation.mutate({ id: editingSupplier.id, payload });
    else createMutation.mutate(payload);
  };
  const handleDelete = (supplier: Supplier) => { if (window.confirm(`Supprimer le fournisseur « ${supplier.name} » ?`)) deleteMutation.mutate(supplier.id); };

  if (suppliersQuery.isLoading) return <LoadingState label="Chargement des fournisseurs…" />;
  if (suppliersQuery.isError) return <ErrorState message="Les fournisseurs n'ont pas pu être chargés." onRetry={() => void suppliersQuery.refetch()} />;

  return <div className="page-stack">
    <PageHeader eyebrow="Partenaires" title="Fournisseurs" description={`${suppliers.length} partenaire${suppliers.length > 1 ? "s" : ""} dans votre réseau.`} actions={<Button leftIcon={<Plus size={17} />} onClick={() => { setEditingSupplier(null); setIsModalOpen(true); }}>Nouveau fournisseur</Button>} />
    {deleteMutation.isError ? <InlineNotice tone="danger"><TriangleAlert size={17} />{getApiErrorMessage(deleteMutation.error, "Impossible de supprimer ce fournisseur.")}</InlineNotice> : null}
    <Card className="table-card"><div className="table-toolbar"><div className="search-control"><Search size={17} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un fournisseur…" aria-label="Rechercher un fournisseur" />{search ? <button type="button" onClick={() => setSearch("")} aria-label="Effacer la recherche"><X size={15} /></button> : null}</div><span className="toolbar-result">{filteredSuppliers.length} résultat{filteredSuppliers.length > 1 ? "s" : ""}</span></div>
      {filteredSuppliers.length === 0 ? <EmptyState title="Aucun fournisseur" description={suppliers.length ? "Aucun fournisseur ne correspond à votre recherche." : "Ajoutez vos partenaires pour préparer vos commandes d'achat."} action={!suppliers.length ? <Button leftIcon={<Plus size={16} />} onClick={() => setIsModalOpen(true)}>Ajouter un fournisseur</Button> : undefined} icon={<Truck size={20} />} /> : <div className="supplier-grid">{filteredSuppliers.map((supplier) => <article className="supplier-card" key={supplier.id}><div className="supplier-card-head"><div className="supplier-avatar"><Building2 size={19} /></div><div className="supplier-card-actions"><Badge status={supplier.status ?? "ACTIVE"} /><button className="icon-button icon-button--small" type="button" onClick={() => { setEditingSupplier(supplier); setIsModalOpen(true); }} aria-label={`Modifier ${supplier.name}`}><Edit3 size={15} /></button></div></div><h2>{supplier.name}</h2><div className="supplier-meta">{supplier.email ? <span><Mail size={14} />{supplier.email}</span> : null}{supplier.phone ? <span><Phone size={14} />{supplier.phone}</span> : null}{supplier.address ? <span><MapPin size={14} />{supplier.address}</span> : null}</div><div className="supplier-card-footer"><span>{supplier.productCount ?? 0} référence{(supplier.productCount ?? 0) > 1 ? "s" : ""}</span><button className="text-button text-button--danger" type="button" onClick={() => handleDelete(supplier)}><Trash2 size={14} /> Supprimer</button></div></article>)}</div>}
    </Card>
    <Modal open={isModalOpen} onClose={closeModal} title={editingSupplier ? "Modifier le fournisseur" : "Nouveau fournisseur"} description="Centralisez vos contacts et conditions d'approvisionnement." size="lg"><form className="form-grid" onSubmit={handleSubmit}>{formError ? <InlineNotice tone="danger">{formError}</InlineNotice> : null}{createMutation.isError ? <InlineNotice tone="danger">{getApiErrorMessage(createMutation.error)}</InlineNotice> : null}{updateMutation.isError ? <InlineNotice tone="danger">{getApiErrorMessage(updateMutation.error)}</InlineNotice> : null}<Input label="Nom du fournisseur *" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex. Distribution Rhône-Alpes" required /><Input label="E-mail" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="contact@fournisseur.fr" /><Input label="Téléphone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+33 4 00 00 00 00" /><Select label="Statut" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SupplierForm["status"] }))}><option value="ACTIVE">Actif</option><option value="INACTIVE">Inactif</option></Select><Input label="Adresse" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="12 rue de l'Industrie" className="form-grid-full" /><div className="form-actions form-grid-full"><Button type="button" variant="ghost" onClick={closeModal}>Annuler</Button><Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>{editingSupplier ? "Enregistrer" : "Créer le fournisseur"}</Button></div></form></Modal>
  </div>;
}
