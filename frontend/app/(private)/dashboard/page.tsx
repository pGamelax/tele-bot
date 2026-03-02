"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useStats, usePayments } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import {
  DollarSign,
  Users,
  QrCode,
  TrendingUp,
  TrendingDown,
  Clock,
} from "lucide-react"
export default function DashboardPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  
  // Usar React Query para buscar dados
  const { data: stats, isLoading: statsLoading, error: statsError } = useStats()
  const { data: payments = [], isLoading: paymentsLoading, error: paymentsError } = usePayments()

  useEffect(() => {
    if (!session) {
      router.push("/sign-in")
      return
    }
  }, [session, router])

  useEffect(() => {
    if (statsError || paymentsError) {
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive",
      })
    }
  }, [statsError, paymentsError, toast])

  const isLoading = statsLoading || paymentsLoading


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
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

  // Calcular PIX gerados e pagos
  const pixGenerated = payments.length
  const pixPaid = payments.filter((p) => p.status === "paid").length

  // Calcular máximo para o gráfico
  const maxRevenue =
    stats.revenueByDay && stats.revenueByDay.length > 0
      ? Math.max(...stats.revenueByDay.map((d) => d.revenue), 1)
      : 1

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">Visão geral do seu negócio</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pb-6">
        {/* Stats Cards - Top Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="icon-container icon-container-primary mb-4">
                <DollarSign className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Total de Vendas</p>
              <p className="text-3xl font-bold text-foreground mb-3">
                {formatCurrency(stats.totalRevenue)}
              </p>
              <div className="flex items-center gap-1">
                {stats.revenueGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={`text-xs ${
                    stats.revenueGrowth >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {stats.revenueGrowth >= 0 ? "+" : ""}
                  {stats.revenueGrowth.toFixed(1)}% vs mês anterior
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="icon-container icon-container-blue mb-4">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Usuários que Interagiram</p>
              <p className="text-3xl font-bold text-foreground mb-3">{stats.totalUsers}</p>
              <p className="text-xs text-muted-foreground">
                {stats.usersWhoPurchased} compraram
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="icon-container icon-container-green mb-4">
                <QrCode className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">PIX Gerados</p>
              <p className="text-3xl font-bold text-foreground mb-3">{pixGenerated}</p>
              <p className="text-xs text-muted-foreground">Total de códigos</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="icon-container icon-container-primary mb-4">
                <DollarSign className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">PIX Pagos</p>
              <p className="text-3xl font-bold text-foreground mb-3">{pixPaid}</p>
              <p className="text-xs text-muted-foreground">
                {pixGenerated > 0
                  ? ((pixPaid / pixGenerated) * 100).toFixed(1)
                  : 0}
                % de conversão
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart */}
        <Card className="mb-6">
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
                        <span className="text-xs text-muted-foreground text-center">{formatDate(day.date)}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4 border-t border-border">
                  <p className="text-sm font-medium text-foreground">
                    Total da semana:{" "}
                    <span className="text-primary">
                      {formatCurrency(stats.revenueByDay.reduce((sum, d) => sum + d.revenue, 0))}
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

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Histórico de Pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Valor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                      Criado em
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                      Pago em
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length > 0 ? (
                    payments.slice(0, 10).map((payment) => (
                      <tr key={payment.id} className="border-b border-border/50">
                        <td className="py-3 px-4 text-sm font-medium text-foreground">
                          {formatCurrency(payment.amount / 100)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              payment.status === "paid"
                                ? "bg-green-500/10 text-green-500 dark:bg-green-500/20 dark:text-green-400"
                                : payment.status === "pending"
                                ? "bg-yellow-500/10 text-yellow-500 dark:bg-yellow-500/20 dark:text-yellow-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {payment.status === "paid"
                              ? "Pago"
                              : payment.status === "pending"
                              ? "Pendente"
                              : payment.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(payment.createdAt)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {payment.paidAt ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDateTime(payment.paidAt)}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">
                        Nenhum pagamento encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
