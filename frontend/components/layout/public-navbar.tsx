"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Bot, LogIn, Mail } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export function PublicNavbar() {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg text-foreground">Tele Bot</span>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {session ? (
              <Link href="/dashboard">
                <Button>
                  Ir para Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="#contato">
                  <Button variant="ghost" className="gap-2">
                    <Mail className="h-4 w-4" />
                    Entrar em Contato
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Entrar
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
