import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getStaffToken } from "@/lib/auth";

export function RequireAuth() {
  const location = useLocation();
  const token = getStaffToken();
  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
