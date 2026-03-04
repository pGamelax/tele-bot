"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { useStats, usePayments, useBots } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Loading } from "@/components/ui/loading"
import {
  DollarSign,
  Users,
  QrCode,
  TrendingUp,
  TrendingDown,
  Clock,
  Bot as BotIcon,
  CheckCircle2,
  CreditCard,
  Target,
  Activity,
  ArrowRight,
} from "lucide-react"

type PeriodFilter = "today" | "yesterday" | "week" | "month" | "all"

export default function DashboardPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month")

  // Usar React Query para buscar dados
  const { data: stats, isLoading: statsLoading, error: statsError } = useStats()
  const { data: payments = [] } = usePayments()
  const { data: bots = [] } = useBots()

  useEffect(() => {
    if (!session) {
      router.push("/sign-in")
      return
    }
  }, [session, router])

  useEffect(() => {
    if (statsError) {
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive",
      })
    }
  }, [statsError, toast])

  // Função para obter datas do período selecionado
  const getPeriodDates = (period: PeriodFilter): { start: Date | null; end: Date | null } => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (period) {
      case "today":
        return {
          start: new Date(today),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
        }
      case "yesterday":
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
        return {
          start: yesterday,
          end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1),
        }
      case "week":
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        return {
          start: weekStart,
          end: new Date(now),
        }
      case "month":
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        return {
          start: monthStart,
          end: new Date(now),
        }
      case "all":
      default:
        return { start: null, end: null }
    }
  }

  // Filtrar pagamentos por período
  const filteredPayments = useMemo(() => {
    if (!payments.length) return []
    const { start, end } = getPeriodDates(periodFilter)

    if (start && end) {
      return payments.filter((p) => {
        const paymentDate = new Date(p.createdAt)
        return paymentDate >= start && paymentDate <= end
      })
    }

    return payments
  }, [payments, periodFilter])

  // Calcular métricas do período
  const periodMetrics = useMemo(() => {
    const periodRevenue = filteredPayments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0)

    const periodPixGenerated = filteredPayments.length
    const periodPixPaid = filteredPayments.filter((p) => p.status === "paid").length
    const periodPixPending = filteredPayments.filter((p) => p.status === "pending").length

    // Calcular usuários únicos que interagiram no período
    const uniqueUsers = new Set(filteredPayments.map((p) => p.telegramChatId))
    const periodTotalUsers = uniqueUsers.size

    // Calcular usuários únicos que compraram no período
    const paidPayments = filteredPayments.filter((p) => p.status === "paid")
    const uniqueBuyers = new Set(paidPayments.map((p) => p.telegramChatId))
    const periodUsersWhoPurchased = uniqueBuyers.size

    return {
      revenue: periodRevenue,
      pixGenerated: periodPixGenerated,
      pixPaid: periodPixPaid,
      pixPending: periodPixPending,
      totalUsers: periodTotalUsers,
      usersWhoPurchased: periodUsersWhoPurchased,
    }
  }, [filteredPayments])

  // Transações recentes (sempre as últimas 5 pagas, independente do período filtrado)
  const recentPayments = useMemo(() => {
    return payments
      .filter((p) => p.status === "paid")
      .sort((a, b) => {
        const dateA = a.paidAt ? new Date(a.paidAt).getTime() : new Date(a.createdAt).getTime()
        const dateB = b.paidAt ? new Date(b.paidAt).getTime() : new Date(b.createdAt).getTime()
        return dateB - dateA // Ordem decrescente (mais recente primeiro)
      })
      .slice(0, 5)
  }, [payments])

  // Calcular máximo para o gráfico
  const maxRevenue = useMemo(() => {
    if (!stats?.revenueByDay || stats.revenueByDay.length === 0) return 1
    return Math.max(...stats.revenueByDay.map((d) => d.revenue), 1)
  }, [stats])

  // Calcular ticket médio do período
  const averageTicket = useMemo(() => {
    return periodMetrics.pixPaid > 0 ? periodMetrics.revenue / periodMetrics.pixPaid : 0
  }, [periodMetrics])

  // Taxa de conversão do período
  const conversionRate = useMemo(() => {
    return periodMetrics.pixGenerated > 0
      ? (periodMetrics.pixPaid / periodMetrics.pixGenerated) * 100
      : 0
  }, [periodMetrics])

  const isLoading = statsLoading

  if (isLoading) {
    return <Loading />
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Nenhuma estatística disponível</div>
      </div>
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-"
    const date = new Date(dateString)
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="w-full border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Visão geral do seu negócio
              </p>
            </div>

            {/* Seletor de Período */}
            <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1 -mb-1 scrollbar-hide">
              {[
                { id: "today", label: "Hoje" },
                { id: "yesterday", label: "Ontem" },
                { id: "week", label: "Semana" },
                { id: "month", label: "Mês" },
                { id: "all", label: "Todo Período" },
              ].map((period) => (
                <Button
                  key={period.id}
                  variant={periodFilter === period.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriodFilter(period.id as PeriodFilter)}
                  className="whitespace-nowrap shrink-0"
                >
                  {period.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conteúdo Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cards de Métricas Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total de Vendas */}
              <Card>
                <CardContent className="pt-3 px-3 sm:pt-6 sm:px-6">
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-primary" />
                    </div>
                    {stats.revenueGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total de Vendas</p>
                  <p className="text-2xl font-bold text-foreground mb-1">
                    {formatCurrency(periodMetrics.revenue / 100)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats.revenueGrowth >= 0 ? "+" : ""}
                    {stats.revenueGrowth.toFixed(1)}% vs mês anterior
                  </p>
                </CardContent>
              </Card>

              {/* Usuários que Interagiram */}
              <Card>
                <CardContent className="pt-3 px-3 sm:pt-6 sm:px-6">
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Usuários que Interagiram</p>
                  <p className="text-2xl font-bold text-foreground mb-1">{periodMetrics.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">{periodMetrics.usersWhoPurchased} compraram</p>
                </CardContent>
              </Card>

              {/* PIX Gerados */}
              <Card>
                <CardContent className="pt-3 px-3 sm:pt-6 sm:px-6">
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <QrCode className="h-6 w-6 text-orange-500" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">PIX Gerados</p>
                  <p className="text-2xl font-bold text-foreground mb-1">{periodMetrics.pixGenerated}</p>
                  <p className="text-xs text-muted-foreground">Total de códigos</p>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de Receita */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle className="text-base sm:text-lg font-semibold">
                    Receita dos Últimos 7 Dias
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">Atualização em tempo real</span>
                </div>
              </CardHeader>
              <CardContent>
                {stats.revenueByDay && stats.revenueByDay.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-48 sm:h-64 flex items-end gap-2 sm:gap-3 pb-8">
                      {stats.revenueByDay.map((day, index) => {
                        const barHeight = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0
                        return (
                          <div
                            key={index}
                            className="flex-1 flex flex-col items-center gap-2 group relative"
                          >
                            <div className="w-full flex items-end justify-center h-full">
                              <div
                                className="w-full bg-primary rounded-t transition-all duration-500 hover:bg-primary/80 relative"
                                style={{
                                  height: `${Math.max(barHeight, day.revenue > 0 ? 2 : 0)}%`,
                                  minHeight: day.revenue > 0 ? "4px" : "0",
                                }}
                              >
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground border border-border text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none shadow-lg">
                                  {formatCurrency(day.revenue)}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground text-center">
                              {formatDate(day.date)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4 border-t border-border">
                      <p className="text-sm font-medium text-foreground">
                        Total da semana:{" "}
                        <span className="text-primary">
                          {formatCurrency(
                            stats.revenueByDay.reduce((sum, d) => sum + d.revenue, 0)
                          )}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Média diária:{" "}
                        {formatCurrency(
                          stats.revenueByDay.reduce((sum, d) => sum + d.revenue, 0) / 7
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 sm:h-64 flex items-center justify-center">
                    <div className="text-center px-4">
                      <p className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                        {formatCurrency(stats.totalRevenue)}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Nenhum dado disponível para o período selecionado
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Atividades Recentes */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle className="text-base sm:text-lg font-semibold">Atividades Recentes</CardTitle>
                  <Link href="/payments">
                    <Button variant="outline" size="sm" className="gap-2">
                      Ver Todas
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {recentPayments.length > 0 ? (
                  <div className="space-y-3">
                    {recentPayments.map((payment) => {
                      const botName =
                        payment.bot?.name || bots.find((b) => b.id === payment.botId)?.name || "N/A"
                      return (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{botName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTime(payment.paidAt)}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                                  Pago
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-sm font-bold text-foreground">
                              {formatCurrency(payment.amount / 100)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Activity className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      Nenhuma atividade recente
                    </p>
                    <p className="text-xs text-muted-foreground text-center">
                      As atividades do período selecionado aparecerão aqui
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Resumo do Período */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Resumo do Período
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total de Vendas</span>
                  <span className="text-sm font-medium text-foreground">{periodMetrics.pixPaid}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ticket Médio</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(averageTicket / 100)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Taxa de Conversão</span>
                  <span className="text-sm font-medium text-foreground">
                    {conversionRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pendentes</span>
                  <span className="text-sm font-medium text-foreground">{periodMetrics.pixPending}</span>
                </div>
              </CardContent>
            </Card>

            {/* Taxa de Conversão PIX */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Taxa de Conversão PIX
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500 mb-2">
                    {conversionRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {periodMetrics.pixPaid} pagos de {periodMetrics.pixGenerated} PIX
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Bots Ativos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BotIcon className="h-4 w-4 text-primary" />
                  Bots
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total de Bots</span>
                  <span className="text-sm font-medium text-foreground">{stats.totalBots}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Bots Ativos</span>
                  <span className="text-sm font-medium text-foreground">{stats.activeBots}</span>
                </div>
                <Link href="/bots">
                  <Button variant="outline" className="w-full gap-2">
                    Gerenciar Bots
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Links Rápidos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Links Rápidos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/payments">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <DollarSign className="h-4 w-4" />
                    Financeiro
                  </Button>
                </Link>
                <Link href="/leads">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Users className="h-4 w-4" />
                    Leads
                  </Button>
                </Link>
                <Link href="/bots">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <BotIcon className="h-4 w-4" />
                    Meus Bots
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
