"use client"

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
  DollarSign,
  LogOut,
  User,
  Settings,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

const navItems = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/bots",      label: "Bots",       icon: Bot },
  { href: "/leads",     label: "Leads",      icon: Users },
  { href: "/payments",  label: "Financeiro", icon: DollarSign },
]

export function Sidebar() {
  const router   = useRouter()
  const pathname = usePathname()
  const { data: session } = authClient.useSession()

  if (!session) return null

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/")

  const userLabel = session.user?.name || session.user?.email || "Usuário"
  const userEmail = session.user?.email || ""

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/sign-in")
  }

  return (
    <>
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-40 w-56 bg-card border-r border-border">

        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 h-16 px-5 border-b border-border shrink-0 hover:bg-muted/50 transition-colors"
        >
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-base text-foreground">Tele Bot</span>
        </Link>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link key={href} href={href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Bottom: user + theme + sign out */}
        <div className="shrink-0 border-t border-border p-3 space-y-2">
          {/* User row */}
          <div className="flex items-center gap-2.5 px-1 py-1">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{userLabel}</p>
              {userEmail && userEmail !== userLabel && (
                <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
              )}
            </div>
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* ── MOBILE BOTTOM TAB BAR ───────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-card border-t border-border flex items-center px-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-lg transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-3 w-3 text-primary" />
              </div>
              <span className="text-[10px] font-medium leading-none">Conta</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-56 mb-2">
            <DropdownMenuLabel>
              <p className="text-sm font-medium truncate">{userLabel}</p>
              {userEmail && userEmail !== userLabel && (
                <p className="text-xs text-muted-foreground font-normal truncate">{userEmail}</p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 focus:bg-transparent cursor-default" onSelect={(e) => e.preventDefault()}>
              <ThemeToggle />
              <span className="text-sm">Alternar tema</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <Settings className="h-4 w-4 mr-2" />
              Configurações
              <span className="ml-auto text-xs text-muted-foreground">Em breve</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </>
  )
}
