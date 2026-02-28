import { createRootRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { LogOut, LayoutDashboard, Bot, Users, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { useState } from "react";

function RootLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Rotas que não devem mostrar a sidebar
  const hideSidebarRoutes = ["/sign-in"];
  const shouldShowSidebar = !hideSidebarRoutes.includes(location.pathname) && user;

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/sign-in" });
  };

  // Fechar sidebar ao navegar em mobile
  const handleNavigate = (path: string) => {
    navigate({ to: path });
    setSidebarOpen(false);
  };

  const menuItems = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
    },
    {
      label: "Bots",
      icon: Bot,
      path: "/bots",
    },
    {
      label: "Leads",
      icon: Users,
      path: "/leads",
    },
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  if (shouldShowSidebar) {
    return (
      <div className="h-screen bg-gray-50 flex overflow-hidden">
        {/* Overlay para mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Responsiva */}
        <aside
          className={cn(
            "fixed lg:static inset-y-0 left-0 z-50 w-64 border-r border-gray-200 bg-white flex flex-col flex-shrink-0 shadow-sm transform transition-transform duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="p-2 lg:p-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex flex-row items-center ">
            <svg 
  width="40" 
  height="40" 
  viewBox="0 0 120 120" 
  xmlns="http://www.w3.org/2000/svg"
  fill="none"
>

  <circle 
    cx="60" 
    cy="60" 
    r="45" 
    stroke="#2563EB" 
    stroke-width="4"
  />


  <rect 
    x="40" 
    y="45" 
    width="40" 
    height="30" 
    rx="8" 
    stroke="#2563EB" 
    stroke-width="4"
  />


  <circle cx="52" cy="60" r="4" fill="#2563EB"/>
  <circle cx="68" cy="60" r="4" fill="#2563EB"/>

      
  <line 
    x1="60" 
    y1="45" 
    x2="60" 
    y2="32" 
    stroke="#2563EB" 
    stroke-width="4"
  />
  <circle cx="60" cy="28" r="4" fill="#2563EB"/>


  <path 
    d="M50 78 L78 66 L60 84 L55 74 Z" 
    fill="#2563EB"
  />
</svg>
          <div className="hidden sm:flex items-center px-2"><span className="text-sm sm:text-base font-bold">CLASH<span className="text-primary">BOT</span></span></div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-2">Menus</p>
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                    isActive(item.path)
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || "Usuário"}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-100"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sair
            </Button>
          </div>
        </aside>

        {/* Main Content - Com scroll */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 w-full lg:w-auto">
          {/* Header mobile com botão hambúrguer */}
          <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="h-6 w-6 text-gray-600" />
            </button>
            <Logo size="sm" showText={false} />
          </header>
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Outlet />
    </div>
  );
}

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <RootLayout />
      <Toaster />
    </AuthProvider>
  ),
});
