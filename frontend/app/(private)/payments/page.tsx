"use client"

import { useState, useEffect, useMemo } from "react"
import { usePayments, useBots } from "@/lib/api-client"
import { Card, CardContent } from "@/components/ui/card"
import { Loading } from "@/components/ui/loading"
import { useToast } from "@/components/ui/use-toast"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Clock, DollarSign, CreditCard, CheckCircle2, TrendingUp, Target, QrCode,
} from "lucide-react"

type PeriodFilter = "today" | "yesterday" | "week" | "month" | "all"

const PERIODS = [
  { id: "today",     label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "week",      label: "Semana" },
  { id: "month",     label: "Mês" },
  { id: "all",       label: "Tudo" },
] as const

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  paid:      { label: "Pago",      cls: "bg-green-500/10 text-green-600" },
  pending:   { label: "Pendente",  cls: "bg-yellow-500/10 text-yellow-600" },
  expired:   { label: "Expirado",  cls: "bg-red-500/10 text-red-500" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v / 100)

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })

function getPeriodDates(period: PeriodFilter) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (period) {
    case "today":     return { start: new Date(today), end: new Date(today.getTime() + 86400000 - 1) }
    case "yesterday": { const y = new Date(today.getTime() - 86400000); return { start: y, end: new Date(y.getTime() + 86400000 - 1) } }
    case "week":      { const w = new Date(today); w.setDate(today.getDate() - today.getDay()); return { start: w, end: now } }
    case "month":     return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: now }
    default:          return { start: null, end: null }
  }
}

export default function PaymentsPage() {
  const { toast } = useToast()
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month")
  const [selectedBot, setSelectedBot] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedGateway, setSelectedGateway] = useState("all")

  const { data: bots = [] } = useBots()
  const { data: allPayments = [], isLoading, error } = usePayments()

  useEffect(() => {
    if (error) toast({ title: "Erro", description: "Erro ao carregar pagamentos", variant: "destructive" })
  }, [error, toast])

  const filteredPayments = useMemo(() => {
    let f = [...allPayments]
    const { start, end } = getPeriodDates(periodFilter)
    if (start && end) f = f.filter((p) => { const d = new Date(p.createdAt); return d >= start && d <= end })
    if (selectedBot !== "all") f = f.filter((p) => p.botId === selectedBot)
    if (selectedStatus !== "all") f = f.filter((p) => p.status === selectedStatus)
    return f
  }, [allPayments, periodFilter, selectedBot, selectedStatus])

  const metrics = useMemo(() => {
    const paid = filteredPayments.filter((p) => p.status === "paid")
    const totalRevenue = paid.reduce((s, p) => s + p.amount, 0)
    const pixPaid = paid.length
    const pixGenerated = filteredPayments.length
    return {
      pixGenerated,
      pixPaid,
      pixPending: filteredPayments.filter((p) => p.status === "pending").length,
      totalRevenue,
      totalGenerated: filteredPayments.reduce((s, p) => s + p.amount, 0),
      pendingValue: filteredPayments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0),
      averageTicket: pixPaid > 0 ? totalRevenue / pixPaid : 0,
      approvalRate: pixGenerated > 0 ? (pixPaid / pixGenerated) * 100 : 0,
      conversionRate: pixGenerated > 0 ? (pixPaid / pixGenerated) * 100 : 0,
      refunds: filteredPayments.filter((p) => p.status === "cancelled").length,
      netRevenue: totalRevenue - pixPaid * 75,
      pixRevenue: totalRevenue,
    }
  }, [filteredPayments])

  const transactions = useMemo(() =>
    filteredPayments
      .filter((p) => selectedGateway === "all" || (selectedGateway === "pix" && p.pixCode))
      .slice(0, 10),
  [filteredPayments, selectedGateway])

  if (isLoading) return <Loading />

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 h-14 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold text-foreground">Financeiro</h1>
            <p className="text-xs text-muted-foreground">Receitas e transações</p>
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
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PIX Gerados</p>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{metrics.pixGenerated}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmt(metrics.totalGenerated)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PIX Pagos</p>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-2xl font-bold text-green-500">{metrics.pixPaid}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmt(metrics.totalRevenue)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pendentes</p>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{metrics.pixPending}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmt(metrics.pendingValue)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receita Bruta</p>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{fmt(metrics.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{metrics.pixPaid} vendas</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receita Líquida</p>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{fmt(metrics.netRevenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">−R$ 0,75 por venda</p>
                </CardContent>
              </Card>
            </div>

            {/* Transações */}
            <Card>
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Transações Recentes</p>
                <div className="flex items-center gap-2">
                  <Select value={selectedBot} onValueChange={setSelectedBot}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue placeholder="Bot" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos bots</SelectItem>
                      {bots.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="expired">Expirado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedGateway} onValueChange={setSelectedGateway}>
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue placeholder="Gateway" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <CardContent className="p-0">
                {transactions.length > 0 ? (
                  <div>
                    {transactions.map((payment, i) => {
                      const botName = payment.bot?.name || bots.find((b) => b.id === payment.botId)?.name || "N/A"
                      const badge = STATUS_BADGE[payment.status] ?? { label: payment.status, cls: "bg-muted text-muted-foreground" }
                      return (
                        <div
                          key={payment.id}
                          className={`flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors ${i > 0 ? "border-t border-border" : ""}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <DollarSign className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{botName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">{fmtDate(payment.createdAt)}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-sm font-semibold text-foreground">{fmt(payment.amount)}</p>
                            {payment.paidAt && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">Pago {fmtDate(payment.paidAt)}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-5">
                    <DollarSign className="h-8 w-8 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground">Nenhuma transação encontrada</p>
                    <p className="text-xs text-muted-foreground mt-1">As transações do período aparecerão aqui</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Side column ─────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Métodos */}
            <Card>
              <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
                <QrCode className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Métodos de Pagamento</p>
              </div>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-xs text-muted-foreground">PIX</span>
                  <span className="text-xs font-semibold text-foreground">{fmt(metrics.pixRevenue)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Resumo */}
            <Card>
              <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Resumo do Período</p>
              </div>
              <CardContent className="p-0">
                {[
                  { label: "Total de vendas",    value: String(metrics.pixPaid) },
                  { label: "Ticket médio",        value: fmt(metrics.averageTicket) },
                  { label: "Taxa de aprovação",   value: `${metrics.approvalRate.toFixed(1)}%` },
                  { label: "Reembolsos",          value: String(metrics.refunds) },
                ].map((row, i) => (
                  <div key={row.label} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-semibold text-foreground">{row.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Conversão */}
            <Card>
              <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Conversão PIX</p>
              </div>
              <CardContent className="p-5 text-center">
                <p className="text-3xl font-bold text-green-500">{metrics.conversionRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {metrics.pixPaid} pagos de {metrics.pixGenerated} gerados
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
