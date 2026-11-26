import type { ReactNode } from "react";
import { useStaffSession } from "@/lib/auth";
import { Navigate } from "@/lib/router";
import { usePathname } from "@/lib/router-hooks";

export function RequireAuth({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useStaffSession();
  if (!session) return <Navigate to="/admin/login" state={{ from: pathname + window.location.search }} />;
  return <>{children}</>;
}
