import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, FolderKanban, Plus, Trash2, TriangleAlert } from "lucide-react";
import { categoriesApi, getApiErrorMessage } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import type { Category, CategoryPayload } from "../types/api";
import { Button, Card, EmptyState, ErrorState, InlineNotice, Input, LoadingState, Modal, PageHeader, Textarea } from "../components/ui";

const initialForm: CategoryPayload = { name: "", description: "" };

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryPayload>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const categoriesQuery = useQuery({ queryKey: queryKeys.categories, queryFn: () => categoriesApi.list() });

  useEffect(() => {
    setForm(editingCategory ? { name: editingCategory.name, description: editingCategory.description ?? "" } : initialForm);
    setFormError(null);
  }, [editingCategory, isModalOpen]);

  const createMutation = useMutation({ mutationFn: categoriesApi.create, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.categories }); closeModal(); } });
  const updateMutation = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Partial<CategoryPayload> }) => categoriesApi.update(id, payload), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.categories }); void queryClient.invalidateQueries({ queryKey: ["products"] }); closeModal(); } });
  const deleteMutation = useMutation({ mutationFn: categoriesApi.remove, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.categories }); void queryClient.invalidateQueries({ queryKey: ["products"] }); } });

  const closeModal = () => { setIsModalOpen(false); setEditingCategory(null); setFormError(null); };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) { setFormError("Le nom de la catégorie est obligatoire."); return; }
    const payload = { ...form, name: form.name.trim() };
    if (editingCategory) updateMutation.mutate({ id: editingCategory.id, payload });
    else createMutation.mutate(payload);
  };
  const handleDelete = (category: Category) => {
    if (window.confirm(`Supprimer la catégorie « ${category.name} » ?`)) deleteMutation.mutate(category.id);
  };

  if (categoriesQuery.isLoading) return <LoadingState label="Chargement des catégories…" />;
  if (categoriesQuery.isError) return <ErrorState message="Les catégories n'ont pas pu être chargées." onRetry={() => void categoriesQuery.refetch()} />;
  const categories = categoriesQuery.data ?? [];

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Catalogue" title="Catégories" description="Structurez votre catalogue et simplifiez vos analyses." actions={<Button leftIcon={<Plus size={17} />} onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}>Nouvelle catégorie</Button>} />
      {deleteMutation.isError ? <InlineNotice tone="danger"><TriangleAlert size={17} />{getApiErrorMessage(deleteMutation.error, "Impossible de supprimer cette catégorie.")}</InlineNotice> : null}
      {categories.length === 0 ? <Card><EmptyState title="Aucune catégorie" description="Créez des catégories pour organiser vos produits et afficher des marges plus fines." action={<Button leftIcon={<Plus size={16} />} onClick={() => setIsModalOpen(true)}>Créer ma première catégorie</Button>} icon={<FolderKanban size={20} />} /></Card> : <div className="category-grid">{categories.map((category) => <Card className="category-card" key={category.id}><div className="category-card-top"><span className="category-color" /><button className="icon-button icon-button--small" type="button" onClick={() => { setEditingCategory(category); setIsModalOpen(true); }} aria-label={`Modifier ${category.name}`}><Edit3 size={16} /></button></div><h2>{category.name}</h2><p>{category.description || "Aucune description"}</p><div className="category-card-footer"><span>{category.productCount ?? 0} produit{(category.productCount ?? 0) > 1 ? "s" : ""}</span><button className="text-button text-button--danger" type="button" onClick={() => handleDelete(category)}><Trash2 size={14} /> Supprimer</button></div></Card>)}</div>}

      <Modal open={isModalOpen} onClose={closeModal} title={editingCategory ? "Modifier la catégorie" : "Nouvelle catégorie"} description="Une catégorie facilite le suivi de vos marges et de vos inventaires.">
        <form className="form-grid" onSubmit={handleSubmit}>
          {formError ? <InlineNotice tone="danger">{formError}</InlineNotice> : null}
          {createMutation.isError ? <InlineNotice tone="danger">{getApiErrorMessage(createMutation.error)}</InlineNotice> : null}
          {updateMutation.isError ? <InlineNotice tone="danger">{getApiErrorMessage(updateMutation.error)}</InlineNotice> : null}
          <Input label="Nom de la catégorie *" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex. Électronique" required />
          <Textarea label="Description" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="À quoi sert cette catégorie ?" className="form-grid-full" />
          <div className="form-actions form-grid-full"><Button type="button" variant="ghost" onClick={closeModal}>Annuler</Button><Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>{editingCategory ? "Enregistrer" : "Créer la catégorie"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
