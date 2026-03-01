"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboard,
  Bot,
  Users,
  LogOut,
  Menu,
  X,
  User,
  Settings,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/sign-in")
  }

  if (!session) {
    return null
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/bots", label: "Bots", icon: Bot },
    { href: "/leads", label: "Leads", icon: Users },
  ]

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/")

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50 w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo e Links Desktop */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg text-foreground">Tele Bot</span>
            </Link>
            
            {/* Links Desktop */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive(item.href) ? "default" : "ghost"}
                      className="gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Avatar e Menu Mobile */}
          <div className="flex items-center gap-4">
          {/* Avatar e Dropdown Desktop */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="max-w-[150px] truncate text-sm">
                    {session?.user?.email || session?.user?.name || "Usuário"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  {session?.user?.email || session?.user?.name || "Usuário"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <Settings className="h-4 w-4 mr-2" />
                  Config
                  <span className="ml-auto text-xs text-muted-foreground">Em breve</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

            {/* Menu Mobile */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Menu Mobile Expandido */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button
                    variant={isActive(item.href) ? "default" : "ghost"}
                    className="w-full justify-start gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="truncate">
                    {session?.user?.email || session?.user?.name || "Usuário"}
                  </span>
                </div>
                <ThemeToggle />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Settings className="h-4 w-4" />
                    Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    {session?.user?.email || session?.user?.name || "Usuário"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <Settings className="h-4 w-4 mr-2" />
                    Config
                    <span className="ml-auto text-xs text-muted-foreground">Em breve</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
