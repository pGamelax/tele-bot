"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { usePayments, useBots, Payment } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Loading } from "@/components/ui/loading"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Clock,
  DollarSign,
  Filter,
  X,
  CreditCard,
  CheckCircle2,
  TrendingUp,
  Target,
  QrCode,
  Calendar,
} from "lucide-react"

type PeriodFilter = "today" | "yesterday" | "week" | "month" | "all"

export default function PaymentsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { data: session } = authClient.useSession()

  // Filtros
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month")
  const [selectedBot, setSelectedBot] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedGateway, setSelectedGateway] = useState<string>("all")

  // Buscar dados
  const { data: bots = [] } = useBots()
  const { data: allPayments = [], isLoading, error } = usePayments()

  useEffect(() => {
    if (!session) {
      router.push("/sign-in")
      return
    }
  }, [session, router])

  useEffect(() => {
    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar pagamentos",
        variant: "destructive",
      })
    }
  }, [error, toast])

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

  // Filtrar pagamentos por período e outros filtros
  const filteredPayments = useMemo(() => {
    let filtered = [...allPayments]
    const { start, end } = getPeriodDates(periodFilter)

    // Filtrar por período
    if (start && end) {
      filtered = filtered.filter((p) => {
        const paymentDate = new Date(p.createdAt)
        return paymentDate >= start && paymentDate <= end
      })
    }

    // Filtrar por bot
    if (selectedBot !== "all") {
      filtered = filtered.filter((p) => p.botId === selectedBot)
    }

    // Filtrar por status
    if (selectedStatus !== "all") {
      filtered = filtered.filter((p) => p.status === selectedStatus)
    }

    return filtered
  }, [allPayments, periodFilter, selectedBot, selectedStatus])

  // Calcular métricas principais
  const metrics = useMemo(() => {
    const pixGenerated = filteredPayments.length
    const pixPaid = filteredPayments.filter((p) => p.status === "paid").length
    const pixPending = filteredPayments.filter((p) => p.status === "pending").length
    const pixExpired = filteredPayments.filter((p) => p.status === "expired").length
    const pixCancelled = filteredPayments.filter((p) => p.status === "cancelled").length

    const totalRevenue = filteredPayments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0)

    const totalGenerated = filteredPayments.reduce((sum, p) => sum + p.amount, 0)

    // Ticket médio (apenas dos pagos)
    const averageTicket = pixPaid > 0 ? totalRevenue / pixPaid : 0

    // Taxa de aprovação (pagos / total gerados)
    const approvalRate = pixGenerated > 0 ? (pixPaid / pixGenerated) * 100 : 0

    // Reembolsos (cancelled)
    const refunds = pixCancelled

    // Taxa de conversão PIX (pagos / gerados)
    const conversionRate = pixGenerated > 0 ? (pixPaid / pixGenerated) * 100 : 0

    // Métodos de pagamento (todos são PIX no momento)
    const paymentMethods = {
      PIX: filteredPayments
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + p.amount, 0),
    }

    return {
      pixGenerated,
      pixPaid,
      pixPending,
      pixExpired,
      pixCancelled,
      totalRevenue,
      totalGenerated,
      averageTicket,
      approvalRate,
      refunds,
      conversionRate,
      paymentMethods,
    }
  }, [filteredPayments])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100)
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      paid: {
        label: "Pago",
        className: "bg-green-500/10 text-green-500 dark:bg-green-500/20 dark:text-green-400",
      },
      pending: {
        label: "Pendente",
        className: "bg-yellow-500/10 text-yellow-500 dark:bg-yellow-500/20 dark:text-yellow-400",
      },
      expired: {
        label: "Expirado",
        className: "bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400",
      },
      cancelled: {
        label: "Cancelado",
        className: "bg-gray-500/10 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400",
      },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      className: "bg-muted text-muted-foreground",
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  // Transações recentes (últimas 10)
  const recentTransactions = useMemo(() => {
    return filteredPayments
      .filter((p) => selectedGateway === "all" || (selectedGateway === "pix" && p.pixCode))
      .slice(0, 10)
  }, [filteredPayments, selectedGateway])

  if (isLoading) {
    return <Loading />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="w-full border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Financeiro</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Gerencie suas receitas e transações
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
              {/* PIX GERADOS */}
              <Card>
                <CardContent className="pt-3 px-3 sm:pt-6 sm:px-6">
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-orange-500" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">PIX GERADOS</p>
                  <p className="text-2xl font-bold text-foreground mb-1">{metrics.pixGenerated}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(metrics.totalGenerated)}</p>
                </CardContent>
              </Card>

              {/* PIX PAGOS */}
              <Card>
                <CardContent className="pt-3 px-3 sm:pt-6 sm:px-6">
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    </div>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">PIX PAGOS</p>
                  <p className="text-2xl font-bold text-foreground mb-1">{metrics.pixPaid}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(metrics.totalRevenue)}</p>
                </CardContent>
              </Card>

              {/* PENDENTES */}
              <Card>
                <CardContent className="pt-3 px-3 sm:pt-6 sm:px-6">
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">PENDENTES</p>
                  <p className="text-2xl font-bold text-foreground mb-1">{metrics.pixPending}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(
                    filteredPayments
                      .filter((p) => p.status === "pending")
                      .reduce((sum, p) => sum + p.amount, 0)
                  )}</p>
                </CardContent>
              </Card>
            </div>

            {/* Transações Recentes */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle className="text-lg font-semibold">Transações Recentes</CardTitle>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Select value={selectedGateway} onValueChange={setSelectedGateway}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Todos Gateway" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Gateway</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" title="Filtros">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {recentTransactions.length > 0 ? (
                  <div className="space-y-3">
                    {recentTransactions.map((payment) => {
                      const botName = payment.bot?.name || bots.find((b) => b.id === payment.botId)?.name || "N/A"
                      return (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <DollarSign className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{botName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">{formatDate(payment.createdAt)}</span>
                                {getStatusBadge(payment.status)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-sm font-bold text-foreground">{formatCurrency(payment.amount)}</p>
                            {payment.paidAt && (
                              <p className="text-xs text-muted-foreground">Pago em {formatDate(payment.paidAt)}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <DollarSign className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Nenhuma transação encontrada</p>
                    <p className="text-xs text-muted-foreground text-center">
                      As transações do período selecionado aparecerão aqui
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Métodos de Pagamento */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-primary" />
                  Métodos de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">PIX</span>
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrency(metrics.paymentMethods.PIX)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                  <span className="text-sm font-medium text-foreground">{metrics.pixPaid}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ticket Médio</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(metrics.averageTicket)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Taxa de Aprovação</span>
                  <span className="text-sm font-medium text-foreground">
                    {metrics.approvalRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Reembolsos</span>
                  <span className="text-sm font-medium text-foreground">{metrics.refunds}</span>
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
                    {metrics.conversionRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {metrics.pixPaid} pagos de {metrics.pixGenerated} PIX
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
