import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { LoadingState } from "../ui";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="auth-loading"><LoadingState label="Ouverture de votre espace…" /></div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RoleRoute({ allowed }: { allowed: string[] }) {
  const { user } = useAuth();
  if (!user || !allowed.includes(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
