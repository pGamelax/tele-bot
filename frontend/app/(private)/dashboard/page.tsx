"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useStats, usePayments, useBots } from "@/lib/api-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loading } from "@/components/ui/loading"
import {
  DollarSign,
  Users,
  QrCode,
  TrendingUp,
  TrendingDown,
  Bot as BotIcon,
  CheckCircle2,
  Target,
  Activity,
  ArrowRight,
} from "lucide-react"

type PeriodFilter = "today" | "yesterday" | "week" | "month" | "all"

const PERIODS = [
  { id: "today",     label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "week",      label: "Semana" },
  { id: "month",     label: "Mês" },
  { id: "all",       label: "Tudo" },
] as const

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function getPeriodDates(period: PeriodFilter): { start: Date | null; end: Date | null } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (period) {
    case "today":
      return { start: new Date(today), end: new Date(today.getTime() + 86400000 - 1) }
    case "yesterday": {
      const y = new Date(today.getTime() - 86400000)
      return { start: y, end: new Date(y.getTime() + 86400000 - 1) }
    }
    case "week": {
      const w = new Date(today)
      w.setDate(today.getDate() - today.getDay())
      return { start: w, end: new Date(now) }
    }
    case "month":
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(now) }
    default:
      return { start: null, end: null }
  }
}

export default function DashboardPage() {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month")

  const { data: stats, isLoading: statsLoading } = useStats()
  const { data: payments = [] } = usePayments()
  const { data: bots = [] } = useBots()

  const filteredPayments = useMemo(() => {
    const { start, end } = getPeriodDates(periodFilter)
    if (!start || !end) return payments
    return payments.filter((p) => {
      const d = new Date(p.createdAt)
      return d >= start && d <= end
    })
  }, [payments, periodFilter])

  const periodMetrics = useMemo(() => {
    const paid = filteredPayments.filter((p) => p.status === "paid")
    const revenue = paid.reduce((s, p) => s + p.amount, 0)
    return {
      revenue,
      pixGenerated: filteredPayments.length,
      pixPaid: paid.length,
      pixPending: filteredPayments.filter((p) => p.status === "pending").length,
      totalUsers: new Set(filteredPayments.map((p) => p.telegramChatId)).size,
      usersWhoPurchased: new Set(paid.map((p) => p.telegramChatId)).size,
    }
  }, [filteredPayments])

  const recentPayments = useMemo(() =>
    payments
      .filter((p) => p.status === "paid")
      .sort((a, b) => {
        const da = a.paidAt ? new Date(a.paidAt).getTime() : new Date(a.createdAt).getTime()
        const db = b.paidAt ? new Date(b.paidAt).getTime() : new Date(b.createdAt).getTime()
        return db - da
      })
      .slice(0, 5),
  [payments])

  const maxRevenue = useMemo(() =>
    Math.max(...(stats?.revenueByDay?.map((d) => d.revenue) ?? [0]), 1),
  [stats])

  const averageTicket = periodMetrics.pixPaid > 0 ? periodMetrics.revenue / periodMetrics.pixPaid : 0
  const conversionRate = periodMetrics.pixGenerated > 0
    ? (periodMetrics.pixPaid / periodMetrics.pixGenerated) * 100 : 0

  if (statsLoading) return <Loading />
  if (!stats) return (
    <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
      Nenhuma estatística disponível
    </div>
  )

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 h-14 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold text-foreground">Dashboard</h1>
            <p className="text-xs text-muted-foreground">Visão geral do seu negócio</p>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide shrink-0">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodFilter(p.id)}
                className={`h-7 px-2.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  periodFilter === p.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ── Main column ─────────────────────────────────────── */}
          <div className="xl:col-span-2 space-y-6">

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Receita */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receita</p>
                    {stats.revenueGrowth >= 0
                      ? <TrendingUp className="h-4 w-4 text-green-500" />
                      : <TrendingDown className="h-4 w-4 text-red-500" />}
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(periodMetrics.revenue / 100)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.revenueGrowth >= 0 ? "+" : ""}{stats.revenueGrowth.toFixed(1)}% vs mês anterior
                  </p>
                </CardContent>
              </Card>

              {/* Usuários */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Usuários</p>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{periodMetrics.totalUsers}</p>
                  <p className="text-xs text-muted-foreground mt-1">{periodMetrics.usersWhoPurchased} compraram</p>
                </CardContent>
              </Card>

              {/* PIX */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PIX Gerados</p>
                    <QrCode className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{periodMetrics.pixGenerated}</p>
                  <p className="text-xs text-muted-foreground mt-1">{periodMetrics.pixPaid} pagos</p>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de Receita */}
            <Card>
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Receita — Últimos 7 dias</p>
                <span className="text-xs text-muted-foreground">Tempo real</span>
              </div>
              <CardContent className="p-5">
                {stats.revenueByDay && stats.revenueByDay.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-48 flex items-end gap-2 pb-6">
                      {stats.revenueByDay.map((day, i) => {
                        const h = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative h-full">
                            <div className="w-full flex items-end h-full">
                              <div
                                className="w-full bg-primary rounded-t transition-all duration-500 hover:bg-primary/70 relative"
                                style={{ height: `${Math.max(h, day.revenue > 0 ? 2 : 0)}%`, minHeight: day.revenue > 0 ? "3px" : "0" }}
                              >
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground border border-border text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none shadow-md">
                                  {formatCurrency(day.revenue)}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{formatDate(day.date)}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-border">
                      <p className="text-xs font-medium text-foreground">
                        Total da semana:{" "}
                        <span className="text-primary">
                          {formatCurrency(stats.revenueByDay.reduce((s, d) => s + d.revenue, 0))}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Média: {formatCurrency(stats.revenueByDay.reduce((s, d) => s + d.revenue, 0) / 7)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Nenhum dado disponível para o período</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Atividades Recentes */}
            <Card>
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Atividades Recentes</p>
                <Link href="/payments">
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                    Ver todas <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
              <CardContent className="p-0">
                {recentPayments.length > 0 ? (
                  <div>
                    {recentPayments.map((payment, i) => {
                      const botName = payment.bot?.name || bots.find((b) => b.id === payment.botId)?.name || "N/A"
                      return (
                        <div
                          key={payment.id}
                          className={`flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors ${i > 0 ? "border-t border-border" : ""}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{botName}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(payment.paidAt)}</p>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-foreground shrink-0 ml-4">
                            {formatCurrency(payment.amount / 100)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-5">
                    <Activity className="h-8 w-8 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground">Nenhuma atividade recente</p>
                    <p className="text-xs text-muted-foreground mt-1">As atividades do período aparecerão aqui</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Side column ─────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Resumo */}
            <Card>
              <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Resumo do Período</p>
              </div>
              <CardContent className="p-0">
                {[
                  { label: "Total de vendas", value: String(periodMetrics.pixPaid) },
                  { label: "Ticket médio", value: formatCurrency(averageTicket / 100) },
                  { label: "Taxa de conversão", value: `${conversionRate.toFixed(1)}%` },
                  { label: "Pendentes", value: String(periodMetrics.pixPending) },
                ].map((row, i) => (
                  <div key={row.label} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-semibold text-foreground">{row.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Conversão PIX */}
            <Card>
              <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Conversão PIX</p>
              </div>
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-green-500">{conversionRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {periodMetrics.pixPaid} pagos de {periodMetrics.pixGenerated} gerados
                </p>
              </CardContent>
            </Card>

            {/* Bots */}
            <Card>
              <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
                <BotIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Bots</p>
              </div>
              <CardContent className="p-0">
                {[
                  { label: "Total", value: String(stats.totalBots) },
                  { label: "Ativos", value: String(stats.activeBots) },
                ].map((row, i) => (
                  <div key={row.label} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-semibold text-foreground">{row.value}</span>
                  </div>
                ))}
                <div className="px-5 py-3 border-t border-border">
                  <Link href="/bots">
                    <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5">
                      Gerenciar Bots <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Links rápidos */}
            <Card>
              <div className="px-5 py-3.5 border-b border-border">
                <p className="text-sm font-semibold text-foreground">Links Rápidos</p>
              </div>
              <CardContent className="p-3 space-y-1">
                {[
                  { href: "/payments", icon: DollarSign, label: "Financeiro" },
                  { href: "/leads",    icon: Users,      label: "Leads" },
                  { href: "/bots",     icon: BotIcon,    label: "Meus Bots" },
                ].map(({ href, icon: Icon, label }) => (
                  <Link key={href} href={href}>
                    <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-xs gap-2 text-muted-foreground hover:text-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </Button>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
