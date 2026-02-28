import { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  // Layout simplificado - a sidebar agora está no root
  return <>{children}</>;
}
