import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Boxes, CircleDollarSign, PackageCheck, RefreshCw, ShoppingCart, TrendingUp, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dashboardApi, productsApi } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { formatCurrency, formatLongDate, formatNumber, formatPercent, isLowStock } from "../lib/format";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, InlineNotice, LoadingState, PageHeader, StatDelta } from "../components/ui";

const chartTooltipStyle = {
  backgroundColor: "#122238",
  border: "1px solid rgba(148, 163, 184, .16)",
  borderRadius: 10,
  color: "#f8fafc",
  fontSize: 12,
};

function KpiCard({ label, value, delta, icon, tone, detail }: { label: string; value: string; delta?: number; icon: ReactNode; tone: "green" | "blue" | "amber" | "purple"; detail: string }) {
  return (
    <Card className={`kpi-card kpi-card--${tone}`}>
      <div className="kpi-card-top"><span className="kpi-label">{label}</span><span className="kpi-icon">{icon}</span></div>
      <strong className="kpi-value">{value}</strong>
      <div className="kpi-footer"><StatDelta value={delta} /><span className="kpi-detail">{detail}</span></div>
    </Card>
  );
}

export function DashboardPage() {
  const summaryQuery = useQuery({ queryKey: queryKeys.dashboard, queryFn: () => dashboardApi.summary({ from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), granularity: "month" }) });
  const alertsQuery = useQuery({ queryKey: queryKeys.stockAlerts, queryFn: () => productsApi.alerts() });

  if (summaryQuery.isLoading) return <LoadingState label="Analyse de votre activité…" />;
  if (summaryQuery.isError) return <ErrorState message="Les indicateurs ne sont pas disponibles pour le moment." onRetry={() => void summaryQuery.refetch()} />;

  const summary = summaryQuery.data;
  if (!summary) return <EmptyState title="Aucune donnée" description="Le tableau de bord sera alimenté dès que l'API répondra." icon={<TrendingUp size={20} />} />;
  const stockAlerts = summary.stockAlerts.length > 0 ? summary.stockAlerts : (alertsQuery.data ?? []);
  const hasChartData = summary.revenueSeries.length > 0;
  const hasMarginData = summary.categoryMargins.length > 0;
  const hasProducts = summary.topProducts.length > 0;
  const hasAlerts = stockAlerts.length > 0;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={formatLongDate()}
        title="Bonjour, et bienvenue"
        description="Voici ce qui se passe dans votre stock aujourd'hui."
        actions={<Button variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={() => void summaryQuery.refetch()} isLoading={summaryQuery.isFetching}>Actualiser</Button>}
      />

      <div className="kpi-grid">
        <KpiCard label="Chiffre d'affaires" value={formatCurrency(summary.kpis.revenue)} delta={summary.kpis.revenueChange} icon={<CircleDollarSign size={20} />} tone="green" detail="ce mois-ci" />
        <KpiCard label="Valeur du stock" value={formatCurrency(summary.kpis.stockValue)} delta={summary.kpis.stockValueChange} icon={<Boxes size={20} />} tone="blue" detail="valorisation actuelle" />
        <KpiCard label="Marge brute" value={formatPercent(summary.kpis.grossMargin)} delta={summary.kpis.grossMarginChange} icon={<TrendingUp size={20} />} tone="purple" detail="sur les ventes" />
        <KpiCard label="Achats du mois" value={formatCurrency(summary.kpis.purchases)} delta={summary.kpis.purchasesChange} icon={<ShoppingCart size={20} />} tone="amber" detail="commandes passées" />
      </div>

      {stockAlerts.length > 0 ? <InlineNotice tone="warning"><TriangleAlert size={17} /><span><strong>{stockAlerts.length} alerte{stockAlerts.length > 1 ? "s" : ""} stock</strong> nécessitent votre attention. <Link to="/app/stock">Voir les alertes</Link></span></InlineNotice> : null}

      <div className="dashboard-grid dashboard-grid--main">
        <Card className="chart-card chart-card--wide">
          <CardHeader title="EVP · Évolution du chiffre d'affaires" description="Performance des 12 derniers mois" action={<span className="chart-legend"><i className="legend-dot legend-dot--green" />CA <i className="legend-dot legend-dot--muted" />Achats</span>} />
          {hasChartData ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={summary.revenueSeries} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.12)" vertical={false} /><XAxis dataKey="label" tick={{ fill: "#718096", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#718096", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number, name: string) => [formatCurrency(value), name === "revenue" ? "CA" : "Achats"]} /><Line type="monotone" dataKey="revenue" stroke="#5ee7b7" strokeWidth={3} dot={{ r: 3, fill: "#5ee7b7", strokeWidth: 0 }} activeDot={{ r: 5 }} /><Line type="monotone" dataKey="purchases" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} /></LineChart></ResponsiveContainer></div> : <EmptyState title="Pas encore de données" description="L'évolution du chiffre d'affaires apparaîtra ici." icon={<TrendingUp size={20} />} />}
        </Card>
        <Card className="chart-card">
          <CardHeader title="Marge par catégorie" description="Répartition de la rentabilité" />
          {hasMarginData ? <div className="chart-area chart-area--bars"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.categoryMargins.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.12)" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={{ fill: "#718096", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${value}%`} /><YAxis type="category" dataKey="name" width={90} tick={{ fill: "#a8b6c8", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [formatPercent(value), "Marge"]} /><Bar dataKey="margin" radius={[0, 5, 5, 0]} barSize={16}>{summary.categoryMargins.slice(0, 6).map((item, index) => <Cell key={`${item.name}-${index}`} fill={["#5ee7b7", "#4f9cf9", "#a78bfa", "#f5b85b", "#f27d7d", "#38bdf8"][index % 6]} />)}</Bar></BarChart></ResponsiveContainer></div> : <EmptyState title="Marges indisponibles" description="Les données de marge seront visibles après vos premières ventes." icon={<PackageCheck size={20} />} />}
        </Card>
      </div>

      <div className="dashboard-grid dashboard-grid--bottom">
        <Card>
          <CardHeader title="Produits les plus vendus" description="Sur la période sélectionnée" action={<Link className="text-link" to="/app/products">Tous les produits <ArrowUpRight size={14} /></Link>} />
          {hasProducts ? <div className="product-ranking">{summary.topProducts.slice(0, 5).map((product, index) => <div className="ranking-row" key={product.id ?? `${product.name}-${index}`}><span className="ranking-number">{String(index + 1).padStart(2, "0")}</span><div className="ranking-product"><strong>{product.name}</strong><span>{product.sku || "Sans référence"}</span></div><div className="ranking-sales"><strong>{formatNumber(product.quantity)}</strong><span>vendus</span></div><strong className="ranking-revenue">{formatCurrency(product.revenue)}</strong></div>)}</div> : <EmptyState title="Pas de classement" description="Les meilleures ventes apparaîtront ici." icon={<PackageCheck size={20} />} />}
        </Card>
        <Card>
          <CardHeader title="Alertes de stock" description="Produits à surveiller" action={<Link className="text-link" to="/app/stock">Gérer le stock <ArrowUpRight size={14} /></Link>} />
          {hasAlerts ? <div className="alert-list">{stockAlerts.slice(0, 5).map((alert) => <div className="alert-row" key={alert.id}><div className={`stock-alert-icon ${isLowStock(alert.currentStock, alert.minStock) ? "stock-alert-icon--danger" : "stock-alert-icon--warning"}`}><TriangleAlert size={16} /></div><div className="alert-copy"><strong>{alert.productName}</strong><span>{alert.sku || "Sans référence"}</span></div><div className="alert-quantity"><strong>{formatNumber(alert.currentStock)}</strong><span>min. {formatNumber(alert.minStock)}</span></div><Badge status={alert.severity} /></div>)}</div> : <EmptyState title="Tout est sous contrôle" description="Aucune alerte de stock active." icon={<PackageCheck size={20} />} />}
        </Card>
      </div>
    </div>
  );
}
