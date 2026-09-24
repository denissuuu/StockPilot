import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Mail, MapPin, Phone, Search, UserRound, Users, X } from "lucide-react";
import { customersApi } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { formatNumber } from "../lib/format";
import type { Customer } from "../types/api";
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader } from "../components/ui";

const EMPTY_CUSTOMERS: Customer[] = [];

export function CustomersPage() {
  const [search, setSearch] = useState("");
  const customersQuery = useQuery({ queryKey: queryKeys.customers, queryFn: () => customersApi.list() });
  const customers = customersQuery.data ?? EMPTY_CUSTOMERS;
  const filteredCustomers = useMemo(() => { const needle = search.toLowerCase().trim(); return customers.filter((customer) => !needle || [customer.name, customer.email, customer.address].some((value) => value?.toLowerCase().includes(needle))); }, [customers, search]);

  if (customersQuery.isLoading) return <LoadingState label="Chargement des clients…" />;
  if (customersQuery.isError) return <ErrorState message="Les clients n'ont pas pu être chargés." onRetry={() => void customersQuery.refetch()} />;

  return <div className="page-stack">
    <PageHeader eyebrow="Partenaires" title="Clients" description={`${formatNumber(customers.length)} client${customers.length > 1 ? "s" : ""} dans votre portefeuille.`} />
    <Card className="table-card"><div className="table-toolbar"><div className="search-control"><Search size={17} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un client, une société…" aria-label="Rechercher un client" />{search ? <button type="button" onClick={() => setSearch("")} aria-label="Effacer la recherche"><X size={15} /></button> : null}</div><span className="toolbar-result">{filteredCustomers.length} résultat{filteredCustomers.length > 1 ? "s" : ""}</span></div>
      {filteredCustomers.length === 0 ? <EmptyState title="Aucun client" description={customers.length ? "Aucun client ne correspond à votre recherche." : "Vos clients apparaîtront ici dès que l'API en renseignera."} icon={<Users size={20} />} /> : <div className="customer-grid">{filteredCustomers.map((customer) => <article className="customer-card" key={customer.id}><div className="customer-card-top"><div className="customer-avatar"><UserRound size={19} /></div><Badge status={customer.status ?? "ACTIVE"} /></div><h2>{customer.name}</h2>{customer.address ? <span className="customer-company"><Building2 size={14} /> {customer.address}</span> : null}<div className="customer-meta">{customer.email ? <span><Mail size={14} />{customer.email}</span> : null}{customer.phone ? <span><Phone size={14} />{customer.phone}</span> : null}{customer.address ? <span><MapPin size={14} />{customer.address}</span> : null}</div><div className="customer-card-footer"><span>{formatNumber(customer.orderCount)} commande{(customer.orderCount ?? 0) > 1 ? "s" : ""}</span><Badge status={customer.status ?? "ACTIVE"} /></div></article>)}</div>}
    </Card>
  </div>;
}
