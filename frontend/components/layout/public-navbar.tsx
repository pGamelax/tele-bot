"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Bot, LogIn, Mail, Menu, X } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export function PublicNavbar() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
            <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span className="font-bold text-base sm:text-lg text-foreground">Tele Bot</span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-3 lg:gap-4">
            <ThemeToggle />
            {session ? (
              <Link href="/dashboard">
                <Button size="sm">
                  Ir para Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="#contato">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Mail className="h-4 w-4" />
                    <span className="hidden lg:inline">Entrar em Contato</span>
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button variant="outline" size="sm">
                    Criar Conta
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button size="sm" className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Entrar
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="h-9 w-9"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border py-3 space-y-2">
            {session ? (
              <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full" size="sm">
                  Ir para Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="#contato" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-2" size="sm">
                    <Mail className="h-4 w-4" />
                    Entrar em Contato
                  </Button>
                </Link>
                <Link href="/sign-up" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full" size="sm">
                    Criar Conta
                  </Button>
                </Link>
                <Link href="/sign-in" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button className="w-full gap-2" size="sm">
                    <LogIn className="h-4 w-4" />
                    Entrar
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
