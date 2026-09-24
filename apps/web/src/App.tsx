import { lazy, Suspense } from "react";
import axios from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute, RoleRoute } from "./components/auth/RouteGuards";
import { AppShell } from "./components/layout/AppShell";
import { LoadingState } from "./components/ui";

const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ProductsPage = lazy(() => import("./pages/ProductsPage").then((module) => ({ default: module.ProductsPage })));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage").then((module) => ({ default: module.CategoriesPage })));
const StockPage = lazy(() => import("./pages/StockPage").then((module) => ({ default: module.StockPage })));
const SuppliersPage = lazy(() => import("./pages/SuppliersPage").then((module) => ({ default: module.SuppliersPage })));
const PurchaseOrdersPage = lazy(() => import("./pages/PurchaseOrdersPage").then((module) => ({ default: module.PurchaseOrdersPage })));
const CustomersPage = lazy(() => import("./pages/CustomersPage").then((module) => ({ default: module.CustomersPage })));
const SalesPage = lazy(() => import("./pages/SalesPage").then((module) => ({ default: module.SalesPage })));
const UsersPage = lazy(() => import("./pages/UsersPage").then((module) => ({ default: module.UsersPage })));
const ForbiddenPage = lazy(() => import("./pages/ForbiddenPage").then((module) => ({ default: module.ForbiddenPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => failureCount < 1 && (!axios.isAxiosError(error) || !error.response || error.response.status >= 500),
    },
  },
});

function PageFallback() {
  return <div className="route-loading"><LoadingState label="Chargement de la page…" /></div>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/403" element={<ForbiddenPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/app" element={<AppShell />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="products" element={<ProductsPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="stock" element={<StockPage />} />
                  <Route path="fournisseurs" element={<SuppliersPage />} />
                  <Route path="achats" element={<PurchaseOrdersPage />} />
                  <Route path="clients" element={<CustomersPage />} />
                  <Route path="ventes" element={<SalesPage />} />
                  <Route element={<RoleRoute allowed={["ADMIN", "MANAGER"]} />}>
                    <Route path="utilisateurs" element={<UsersPage />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
