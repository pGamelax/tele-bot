"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { PublicNavbar } from "@/components/layout/public-navbar"
import { Button } from "@/components/ui/button"
import { Bot, Zap, Shield, BarChart3, ArrowRight, Check } from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"

export default function HomePage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-foreground mb-6">
            Gerencie seus Bots do Telegram
            <span className="text-primary block mt-2">de Forma Profissional</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Plataforma completa para criar, gerenciar e monetizar bots do Telegram
            com integração de pagamentos Pix e automação de mensagens.
          </p>
          <div className="flex gap-4 justify-center">
            {session ? (
              <Link href="/dashboard">
                <Button size="lg" className="text-lg px-8">
                  Ir para Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button size="lg" className="text-lg px-8">
                    Entrar
                  </Button>
                </Link>
                <Link href="#contato">
                  <Button size="lg" variant="outline" className="text-lg px-8">
                    Entrar em Contato
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Recursos Poderosos
          </h2>
          <p className="text-lg text-muted-foreground">
            Tudo que você precisa para gerenciar seus bots
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardContent className="p-6">
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Gerenciamento de Bots
              </h3>
              <p className="text-muted-foreground">
                Crie e gerencie múltiplos bots do Telegram com configurações
                personalizadas de mensagens e pagamentos.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Automação Inteligente
              </h3>
              <p className="text-muted-foreground">
                Configure reenvios automáticos de mensagens e pagamentos
                com intervalos personalizáveis.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Pagamentos Pix
              </h3>
              <p className="text-muted-foreground">
                Integração completa com SyncPay para gerar e rastrear
                pagamentos Pix de forma segura.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Dashboard Completo
              </h3>
              <p className="text-muted-foreground">
                Acompanhe vendas, leads, pagamentos e métricas importantes
                em tempo real.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Gestão de Leads
              </h3>
              <p className="text-muted-foreground">
                Organize e acompanhe todos os leads gerados pelos seus bots
                com filtros e status personalizados.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Fácil de Usar
              </h3>
              <p className="text-muted-foreground">
                Interface intuitiva e moderna para configurar seus bots
                sem necessidade de conhecimento técnico.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contato" className="bg-card py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Entre em Contato
            </h2>
            <p className="text-lg text-muted-foreground">
              Tem alguma dúvida ou precisa de ajuda? Entre em contato conosco.
            </p>
          </div>
          <div className="max-w-md mx-auto bg-card border border-border p-8 rounded-lg">
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Mensagem
                </label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                  placeholder="Sua mensagem..."
                />
              </div>
              <Button type="submit" className="w-full">
                Enviar Mensagem
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-muted-foreground">
            © 2024 Tele Bot. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
