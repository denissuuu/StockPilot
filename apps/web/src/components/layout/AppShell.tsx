import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Boxes,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShoppingCart,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types/api";
import { cn, getDisplayName, getInitials } from "../../lib/format";

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  roles?: UserRole[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Pilotage",
    items: [{ label: "Vue d'ensemble", to: "/app/dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Catalogue",
    items: [
      { label: "Produits", to: "/app/products", icon: Package },
      { label: "Catégories", to: "/app/categories", icon: Boxes },
      { label: "Mouvements de stock", to: "/app/stock", icon: FileBarChart },
    ],
  },
  {
    label: "Partenaires",
    items: [
      { label: "Fournisseurs", to: "/app/fournisseurs", icon: Truck },
      { label: "Commandes d'achat", to: "/app/achats", icon: ClipboardList },
      { label: "Clients", to: "/app/clients", icon: Users },
    ],
  },
  {
    label: "Activité",
    items: [{ label: "Commandes clients", to: "/app/ventes", icon: ShoppingCart }],
  },
  {
    label: "Administration",
    items: [{ label: "Utilisateurs", to: "/app/utilisateurs", icon: Settings2, roles: ["ADMIN", "MANAGER"] }],
  },
];

const pageTitles: Record<string, string> = {
  "/app/dashboard": "Vue d'ensemble",
  "/app/products": "Produits",
  "/app/categories": "Catégories",
  "/app/stock": "Mouvements de stock",
  "/app/fournisseurs": "Fournisseurs",
  "/app/achats": "Commandes d'achat",
  "/app/clients": "Clients",
  "/app/ventes": "Commandes clients",
  "/app/utilisateurs": "Utilisateurs",
};

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>Stock<span>Pilot</span></strong>
        <small>Inventory OS</small>
      </div>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const initials = getInitials(user ? getDisplayName(user) : "");

  return (
    <>
      <div className={cn("sidebar-overlay", open && "sidebar-overlay--visible")} onClick={onClose} aria-hidden="true" />
      <aside className={cn("sidebar", open && "sidebar--open")} aria-label="Navigation principale">
        <div className="sidebar-top">
          <Brand />
          <button className="icon-button sidebar-close" type="button" onClick={onClose} aria-label="Fermer le menu">
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-avatar">SP</div>
          <div className="workspace-copy">
            <span>Workspace principal</span>
            <strong>StockPilot SAS</strong>
          </div>
          <ChevronRight size={15} aria-hidden="true" />
        </div>
        <nav className="sidebar-nav">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
            if (visibleItems.length === 0) return null;
            return (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    aria-label={item.label}
                    onClick={onClose}
                    className={({ isActive }) => cn("nav-item", isActive && "nav-item--active")}
                  >
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.label === "Mouvements de stock" ? <span className="nav-pill">Live</span> : null}
                  </NavLink>
                );
              })}
            </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-icon"><CircleUserRound size={17} aria-hidden="true" /></div>
            <div>
              <strong>Besoin d'aide ?</strong>
              <span>Consulter le centre d'aide</span>
            </div>
            <ChevronRight size={15} aria-hidden="true" />
          </div>
          <div className="sidebar-user">
            <div className="avatar avatar--small">{initials}</div>
            <div className="sidebar-user-copy">
              <strong>{user ? getDisplayName(user) : "Utilisateur"}</strong>
              <span>{user?.role ?? "Accès"}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ onMenu, onCollapse, collapsed }: { onMenu: () => void; onCollapse: () => void; collapsed: boolean }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const title = useMemo(() => pageTitles[location.pathname] ?? "StockPilot", [location.pathname]);
  const initials = getInitials(user ? getDisplayName(user) : "");

  const handleLogout = async () => {
    setShowMenu(false);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button mobile-menu-button" type="button" onClick={onMenu} aria-label="Ouvrir le menu">
          <Menu size={21} aria-hidden="true" />
        </button>
        <button className="icon-button desktop-collapse-button" type="button" onClick={onCollapse} aria-label={collapsed ? "Afficher la barre latérale" : "Réduire la barre latérale"}>
          {collapsed ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}
        </button>
        <div className="breadcrumbs">
          <span>Workspace</span>
          <ChevronRight size={14} aria-hidden="true" />
          <strong>{title}</strong>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="sync-status"><span className="sync-dot" /> Synchronisé à l'instant</div>
        <button className="icon-button notification-button" type="button" aria-label="Notifications">
          <Bell size={19} aria-hidden="true" />
          <span className="notification-dot" />
        </button>
        <div className="profile-menu">
          <button className="profile-trigger" type="button" onClick={() => setShowMenu((value) => !value)} aria-expanded={showMenu}>
            <div className="avatar avatar--topbar">{initials}</div>
            <span className="profile-trigger-copy"><strong>{user ? getDisplayName(user) : "Utilisateur"}</strong><small>{user?.email}</small></span>
            <ChevronRight size={15} className="profile-chevron" aria-hidden="true" />
          </button>
          {showMenu ? (
            <div className="profile-dropdown">
              <div className="profile-dropdown-header"><span>Connecté en tant que</span><strong>{user?.email}</strong></div>
              <button type="button" onClick={handleLogout}><LogOut size={16} aria-hidden="true" /> Se déconnecter</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn("app-shell", collapsed && "app-shell--collapsed")}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Topbar onMenu={() => setSidebarOpen(true)} onCollapse={() => setCollapsed((value) => !value)} collapsed={collapsed} />
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}

