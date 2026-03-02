"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { usePayments, useBots, Payment } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Clock, DollarSign, Filter, X } from "lucide-react"

export default function PaymentsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  
  // Filtros
  const [selectedBot, setSelectedBot] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

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

  // Filtrar pagamentos
  const filteredPayments = useMemo(() => {
    let filtered = [...allPayments]

    if (selectedBot !== "all") {
      filtered = filtered.filter((p) => p.botId === selectedBot)
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((p) => p.status === selectedStatus)
    }

    if (startDate) {
      const start = new Date(startDate)
      filtered = filtered.filter((p) => new Date(p.createdAt) >= start)
    }

    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      filtered = filtered.filter((p) => new Date(p.createdAt) <= end)
    }

    return filtered
  }, [allPayments, selectedBot, selectedStatus, startDate, endDate])

  // Calcular estatísticas
  const stats = useMemo(() => {
    const total = filteredPayments.length
    const paid = filteredPayments.filter((p) => p.status === "paid").length
    const pending = filteredPayments.filter((p) => p.status === "pending").length
    const totalRevenue = filteredPayments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0)

    return { total, paid, pending, totalRevenue }
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

  const clearFilters = () => {
    setSelectedBot("all")
    setSelectedStatus("all")
    setStartDate("")
    setEndDate("")
  }

  const hasActiveFilters = selectedBot !== "all" || selectedStatus !== "all" || startDate || endDate

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Histórico de Pagamentos</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
            Visualize e filtre todos os pagamentos
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pb-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="icon-container icon-container-primary mb-4">
                <DollarSign className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Total de Receita</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="icon-container icon-container-green mb-4">
                <DollarSign className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Pagamentos</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.paid} pagos, {stats.pending} pendentes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="icon-container icon-container-green mb-4">
                <DollarSign className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Pagos</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-500">{stats.paid}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="icon-container icon-container-blue mb-4">
                <Clock className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Pendentes</p>
              <p className="text-2xl sm:text-3xl font-bold text-yellow-500">{stats.pending}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Filtro por Bot */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Bot</label>
                <Select value={selectedBot} onValueChange={setSelectedBot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os bots" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os bots</SelectItem>
                    {bots.map((bot) => (
                      <SelectItem key={bot.id} value={bot.id}>
                        {bot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por Status */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por Data Inicial */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>

              {/* Filtro por Data Final */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Data Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Pagamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Pagamentos ({filteredPayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Bot</th>
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
                  {filteredPayments.length > 0 ? (
                    filteredPayments.map((payment) => {
                      const botName = payment.bot?.name || bots.find((b) => b.id === payment.botId)?.name || "N/A"
                      return (
                        <tr key={payment.id} className="border-b border-border/50 hover:bg-muted/50">
                          <td className="py-3 px-4 text-sm text-foreground">
                            {botName}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-foreground">
                            {formatCurrency(payment.amount)}
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
                                : payment.status === "expired"
                                ? "Expirado"
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
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
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
