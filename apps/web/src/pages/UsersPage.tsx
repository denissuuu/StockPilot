import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Edit3, Mail, Plus, Search, ShieldCheck, Trash2, TriangleAlert, UserPlus, Users, X } from "lucide-react";
import { getApiErrorMessage, usersApi } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { formatDate, getDisplayName, getInitials } from "../lib/format";
import type { User, UserPayload } from "../types/api";
import { Badge, Button, Card, EmptyState, ErrorState, InlineNotice, Input, LoadingState, Modal, PageHeader, Select } from "../components/ui";

const EMPTY_USERS: User[] = [];

const initialForm: UserPayload = { email: "", firstName: "", lastName: "", role: "VIEWER", password: "", isActive: true };

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserPayload>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const usersQuery = useQuery({ queryKey: queryKeys.users, queryFn: () => usersApi.list() });
  const createMutation = useMutation({ mutationFn: usersApi.create, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.users }); closeModal(); } });
  const updateMutation = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Partial<UserPayload> }) => usersApi.update(id, payload), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.users }); closeModal(); } });
  const deleteMutation = useMutation({ mutationFn: usersApi.remove, onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.users }) });
  const users = usersQuery.data ?? EMPTY_USERS;
  const filteredUsers = useMemo(() => { const needle = search.toLowerCase().trim(); return users.filter((user) => !needle || [getDisplayName(user), user.email, user.role].some((value) => value.toLowerCase().includes(needle))); }, [users, search]);
  useEffect(() => { setForm(editingUser ? { email: editingUser.email, firstName: editingUser.firstName ?? "", lastName: editingUser.lastName ?? "", role: editingUser.role, password: "", isActive: editingUser.isActive ?? true } : initialForm); setFormError(null); }, [editingUser, isModalOpen]);
  const closeModal = () => { setIsModalOpen(false); setEditingUser(null); setFormError(null); };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) { setFormError("L'e-mail, le prénom et le nom sont obligatoires."); return; }
    if (!editingUser && !form.password) { setFormError("Définissez un mot de passe pour le nouvel utilisateur."); return; }
    const payload: Partial<UserPayload> = { email: form.email.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim(), role: form.role, ...(editingUser ? { isActive: form.isActive } : {}) };
    if (form.password) payload.password = form.password;
    if (editingUser) updateMutation.mutate({ id: editingUser.id, payload }); else createMutation.mutate(payload as UserPayload);
  };
  const handleDelete = (user: User) => { if (window.confirm(`Supprimer l'accès de ${getDisplayName(user)} ?`)) deleteMutation.mutate(user.id); };

  if (usersQuery.isLoading) return <LoadingState label="Chargement des utilisateurs…" />;
  if (usersQuery.isError) return <ErrorState message="Les utilisateurs n'ont pas pu être chargés." onRetry={() => void usersQuery.refetch()} />;

  return <div className="page-stack">
    <PageHeader eyebrow="Administration" title="Utilisateurs" description="Gérez les accès et les rôles de votre équipe." actions={<Button leftIcon={<UserPlus size={17} />} onClick={() => { setEditingUser(null); setIsModalOpen(true); }}>Inviter un utilisateur</Button>} />
    {deleteMutation.isError ? <InlineNotice tone="danger"><TriangleAlert size={17} />{getApiErrorMessage(deleteMutation.error, "Impossible de supprimer cet utilisateur.")}</InlineNotice> : null}
    <div className="mini-stat-grid mini-stat-grid--three"><Card className="mini-stat"><span>Utilisateurs</span><strong>{users.length}</strong><small>accès enregistrés</small></Card><Card className="mini-stat"><span>Actifs</span><strong className="text-green">{users.filter((user) => user.isActive !== false).length}</strong><small>peuvent se connecter</small></Card><Card className="mini-stat"><span>Rôles</span><strong>{new Set(users.map((user) => user.role)).size}</strong><small>niveaux d'accès utilisés</small></Card></div>
    <Card className="table-card"><div className="table-toolbar"><div className="search-control"><Search size={17} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un utilisateur…" aria-label="Rechercher un utilisateur" />{search ? <button type="button" onClick={() => setSearch("")} aria-label="Effacer la recherche"><X size={15} /></button> : null}</div><span className="toolbar-result">{filteredUsers.length} utilisateur{filteredUsers.length > 1 ? "s" : ""}</span></div>
      {filteredUsers.length === 0 ? <EmptyState title="Aucun utilisateur" description="Invitez vos collaborateurs pour travailler ensemble sur le stock." action={<Button leftIcon={<Plus size={16} />} onClick={() => setIsModalOpen(true)}>Inviter un utilisateur</Button>} icon={<Users size={20} />} /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th><th>Créé le</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredUsers.map((user) => <tr key={user.id}><td><div className="table-product"><span className="avatar avatar--table">{getInitials(getDisplayName(user))}</span><div><strong>{getDisplayName(user)}</strong><span><Mail size={12} /> {user.email}</span></div></div></td><td><span className="role-label"><ShieldCheck size={14} /> {user.role}</span></td><td><Badge tone={user.isActive === false ? "neutral" : "success"}>{user.isActive === false ? "Inactif" : "Actif"}</Badge></td><td><span className="muted-text">{formatDate(user.createdAt)}</span></td><td><div className="row-actions"><button className="icon-button icon-button--small" type="button" onClick={() => { setEditingUser(user); setIsModalOpen(true); }} aria-label={`Modifier ${getDisplayName(user)}`}><Edit3 size={16} /></button><button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => handleDelete(user)} aria-label={`Supprimer ${getDisplayName(user)}`}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>}
      <div className="table-footer"><span>Les rôles déterminent les actions disponibles dans l'application.</span><span className="table-footer-hint"><Check size={13} /> Accès sécurisé</span></div>
    </Card>
    <Modal open={isModalOpen} onClose={closeModal} title={editingUser ? "Modifier l'utilisateur" : "Inviter un utilisateur"} description={editingUser ? `Mettez à jour le profil de ${getDisplayName(editingUser)}.` : "Créez directement un accès pour un membre de votre équipe."}><form className="form-grid" onSubmit={handleSubmit}>{formError ? <InlineNotice tone="danger">{formError}</InlineNotice> : null}{createMutation.isError ? <InlineNotice tone="danger">{getApiErrorMessage(createMutation.error)}</InlineNotice> : null}{updateMutation.isError ? <InlineNotice tone="danger">{getApiErrorMessage(updateMutation.error)}</InlineNotice> : null}<Input label="Adresse e-mail *" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="prenom.nom@entreprise.com" required /><Input label="Prénom" required value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} placeholder="Prénom" /><Input label="Nom" required value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} placeholder="Nom" /><Select label="Rôle *" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserPayload["role"] }))}><option value="VIEWER">Lecteur</option><option value="EMPLOYEE">Employé</option><option value="MANAGER">Manager</option><option value="ADMIN">Administrateur</option></Select><Input label={editingUser ? "Nouveau mot de passe (optionnel)" : "Mot de passe *"} type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} hint="8 caractères minimum" required={!editingUser} />{editingUser ? <label className="checkbox-label form-grid-full"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /><span>Compte actif</span></label> : null}<div className="form-actions form-grid-full"><Button type="button" variant="ghost" onClick={closeModal}>Annuler</Button><Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>{editingUser ? "Enregistrer" : "Envoyer l'invitation"}</Button></div></form></Modal>
  </div>;
}
