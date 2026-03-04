"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useLeads, useBots, usePayments, useUpdateLead, useDeleteLead, useToggleResend, Lead, Payment } from "@/lib/api-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Loading } from "@/components/ui/loading"
import { 
  Users, 
  Filter, 
  X, 
  Check, 
  Clock, 
  Pause, 
  Play, 
  MoreVertical, 
  Edit, 
  Trash2,
  Search,
  UserPlus,
  Ban,
  RefreshCw,
  Calendar,
  Bot,
  Network
} from "lucide-react"

type PeriodFilter = "today" | "yesterday" | "week" | "month" | "all"

export default function LeadsPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const { data: bots } = useBots()
  const { data: payments = [] } = usePayments()
  const [selectedBotId, setSelectedBotId] = useState<string>("")
  const [selectedFlow, setSelectedFlow] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedStart, setSelectedStart] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all")
  const { data: allLeads, isLoading } = useLeads()
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()
  const toggleResend = useToggleResend()
  const { toast } = useToast()

  useEffect(() => {
    if (!session) {
      router.push("/sign-in")
    }
  }, [session, router])

  const getPeriodDates = (): { start: Date | null; end: Date | null } => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    switch (periodFilter) {
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

  const leadsWithPayments = useMemo(() => {
    if (!allLeads) return []
    
    return allLeads.map(lead => {
      const leadPayments = payments.filter(
        p => p.botId === lead.botId && 
        p.telegramChatId === lead.telegramChatId &&
        p.status === "paid"
      )
      const lastPayment = leadPayments.length > 0 ? leadPayments[leadPayments.length - 1] : null
      
      return {
        ...lead,
        hasPaid: leadPayments.length > 0,
        lastPayment: lastPayment,
        paymentCode: lastPayment?.id || null,
        planValue: lastPayment?.amount || null,
      }
    })
  }, [allLeads, payments])

  const filteredLeads = useMemo(() => {
    let filtered = [...leadsWithPayments]
    const { start, end } = getPeriodDates()

    // Filtro de período
    if (start && end) {
      filtered = filtered.filter(lead => {
        const leadDate = new Date(lead.createdAt)
        return leadDate >= start && leadDate <= end
      })
    }

    // Filtro de bot
    if (selectedBotId) {
      filtered = filtered.filter(lead => lead.botId === selectedBotId)
    }

    // Filtro de fluxo (utmCampaign)
    if (selectedFlow !== "all") {
      if (selectedFlow === "none") {
        filtered = filtered.filter(lead => !lead.utmCampaign)
      } else {
        filtered = filtered.filter(lead => lead.utmCampaign === selectedFlow)
      }
    }

    // Filtro de status
    if (selectedStatus !== "all") {
      switch (selectedStatus) {
        case "new":
          filtered = filtered.filter(lead => lead.isNew)
          break
        case "pending":
          filtered = filtered.filter(lead => !lead.contactedAt && !lead.convertedAt && !lead.hasPaid)
          break
        case "paid":
          filtered = filtered.filter(lead => lead.hasPaid || lead.convertedAt)
          break
        case "blocked":
          filtered = filtered.filter(lead => lead.isBlocked)
          break
      }
    }

    // Filtro de start (isNew)
    if (selectedStart !== "all") {
      filtered = filtered.filter(lead => 
        selectedStart === "new" ? lead.isNew : !lead.isNew
      )
    }

    // Busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(lead => {
        const name = `${lead.firstName || ""} ${lead.lastName || ""}`.toLowerCase()
        const username = (lead.telegramUsername || "").toLowerCase()
        const chatId = lead.telegramChatId.toLowerCase()
        const email = (lead.telegramUsername ? `@${lead.telegramUsername}` : "").toLowerCase()
        return name.includes(query) || username.includes(query) || chatId.includes(query) || email.includes(query)
      })
    }

    return filtered
  }, [leadsWithPayments, selectedBotId, selectedFlow, selectedStatus, selectedStart, searchQuery, periodFilter])

  const stats = useMemo(() => {
    const { start, end } = getPeriodDates()
    let leadsToCount = [...leadsWithPayments]
    
    if (start && end) {
      leadsToCount = leadsToCount.filter(lead => {
        const leadDate = new Date(lead.createdAt)
        return leadDate >= start && leadDate <= end
      })
    }

    const novos = leadsToCount.filter(lead => lead.isNew).length
    const pendentes = leadsToCount.filter(lead => !lead.contactedAt && !lead.convertedAt && !lead.hasPaid).length
    const pagos = leadsToCount.filter(lead => lead.hasPaid || lead.convertedAt).length
    const bloqueados = leadsToCount.filter(lead => lead.isBlocked).length
    const total = leadsToCount.length

    return { novos, pendentes, pagos, bloqueados, total }
  }, [leadsWithPayments, periodFilter])

  // Obter fluxos únicos (utmCampaign)
  const uniqueFlows = useMemo(() => {
    const flows = new Set<string>()
    allLeads?.forEach(lead => {
      if (lead.utmCampaign) {
        flows.add(lead.utmCampaign)
      }
    })
    return Array.from(flows).sort()
  }, [allLeads])

  const handleMarkAsContacted = async (id: string) => {
    try {
      await updateLead.mutateAsync({
        id,
        isNew: false,
        contactedAt: new Date().toISOString(),
      })
      toast({
        title: "Sucesso",
        description: "Lead marcado como contatado",
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar lead",
        variant: "destructive",
      })
    }
  }

  const handleMarkAsConverted = async (id: string) => {
    try {
      await updateLead.mutateAsync({
        id,
        isNew: false,
        convertedAt: new Date().toISOString(),
      })
      toast({
        title: "Sucesso",
        description: "Lead marcado como convertido",
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar lead",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este lead?")) {
      return
    }

    try {
      await deleteLead.mutateAsync(id)
      toast({
        title: "Sucesso",
        description: "Lead deletado com sucesso",
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar lead",
        variant: "destructive",
      })
    }
  }

  const handleToggleResend = async (id: string, paused: boolean) => {
    try {
      await toggleResend.mutateAsync({ id, paused })
      toast({
        title: "Sucesso",
        description: paused ? "Reenvio pausado" : "Reenvio retomado",
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar status de reenvio",
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100)
  }

  const getPaymentPlan = (lead: typeof leadsWithPayments[0]) => {
    if (!lead.lastPayment) return "-"
    const bot = bots?.find(b => b.id === lead.botId)
    if (!bot) return formatCurrency(lead.lastPayment.amount)
    
    // Tentar encontrar o botão de pagamento correspondente ao valor
    const matchingButton = bot.paymentButtons.find(
      btn => btn.value === lead.lastPayment!.amount
    )
    return matchingButton ? matchingButton.text : formatCurrency(lead.lastPayment.amount)
  }

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
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Leads</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Gerencie seus leads e clientes
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 mt-6">
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="pt-3 px-2 sm:pt-6 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">NOVOS</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-500">{stats.novos}</p>
                </div>
                <UserPlus className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="pt-3 px-2 sm:pt-6 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">PENDENTES</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-500">{stats.pendentes}</p>
                </div>
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-teal-500/20 bg-teal-500/5">
            <CardContent className="pt-3 px-2 sm:pt-6 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">PAGOS</p>
                  <p className="text-xl sm:text-2xl font-bold text-teal-500">{stats.pagos}</p>
                </div>
                <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="pt-3 px-2 sm:pt-6 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">BLOQUEADOS</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-500">{stats.bloqueados}</p>
                </div>
                <Ban className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-3 px-2 sm:pt-6 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">TOTAL LEADS</p>
                  <p className="text-xl sm:text-2xl font-bold text-primary">{stats.total}</p>
                </div>
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Busca e Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-4 sm:pt-6">
            <div className="space-y-4">
              {/* Barra de Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por nome, telefone ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>

              {/* Filtros Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Select 
                  value={selectedBotId || "all"} 
                  onValueChange={(value) => setSelectedBotId(value === "all" ? "" : value)}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Todos os Bots" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Bots</SelectItem>
                    {bots?.map((bot) => (
                      <SelectItem key={bot.id} value={bot.id}>
                        {bot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedFlow}
                  onValueChange={setSelectedFlow}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Todos os Fluxos" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Fluxos</SelectItem>
                    <SelectItem value="none">Sem Fluxo</SelectItem>
                    {uniqueFlows.map((flow) => (
                      <SelectItem key={flow} value={flow}>
                        {flow}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Todos os Status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="new">Novos</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="paid">Pagos</SelectItem>
                    <SelectItem value="blocked">Bloqueados</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={selectedStart}
                  onValueChange={setSelectedStart}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Todos Starts" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Starts</SelectItem>
                    <SelectItem value="new">Novos</SelectItem>
                    <SelectItem value="old">Antigos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Leads */}
        {!filteredLeads || filteredLeads.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenhum cliente encontrado</h3>
                  <p className="text-muted-foreground">Seus leads e clientes aparecerão aqui</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-foreground">NOME / EMAIL</th>
                          <th className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-foreground">ID</th>
                          <th className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-foreground">CÓD. VENDAS</th>
                          <th className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-foreground">PLANO</th>
                          <th className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-foreground">BOT</th>
                          <th className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-foreground">FLUXO</th>
                          <th className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-foreground">STATUS</th>
                          <th className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-foreground">DATA</th>
                          <th className="px-4 py-3 text-right text-xs sm:text-sm font-medium text-foreground">AÇÕES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredLeads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div>
                                <div className="font-medium text-foreground">
                                  {lead.firstName || lead.telegramUsername || "Usuário"}
                                  {lead.lastName && ` ${lead.lastName}`}
                                </div>
                                {lead.telegramUsername && (
                                  <div className="text-xs text-muted-foreground">@{lead.telegramUsername}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs sm:text-sm text-muted-foreground font-mono">
                                {lead.telegramChatId}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                {lead.paymentCode ? lead.paymentCode.substring(0, 8) + "..." : "-"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs sm:text-sm text-foreground">
                                {getPaymentPlan(lead)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs sm:text-sm text-foreground">
                                {lead.bot.name}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                {lead.utmCampaign || "-"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {lead.isNew && (
                                  <span className="px-2 py-1 text-xs font-medium bg-green-500/10 text-green-500 rounded-full">
                                    Novo
                                  </span>
                                )}
                                {lead.hasPaid && (
                                  <span className="px-2 py-1 text-xs font-medium bg-teal-500/10 text-teal-500 rounded-full">
                                    Pago
                                  </span>
                                )}
                                {lead.convertedAt && (
                                  <span className="px-2 py-1 text-xs font-medium bg-green-500/10 text-green-500 rounded-full">
                                    Convertido
                                  </span>
                                )}
                                {lead.isBlocked && (
                                  <span className="px-2 py-1 text-xs font-medium bg-red-500/10 text-red-500 rounded-full">
                                    Bloqueado
                                  </span>
                                )}
                                {lead.resendPaused && (
                                  <span className="px-2 py-1 text-xs font-medium bg-orange-500/10 text-orange-500 rounded-full">
                                    Pausado
                                  </span>
                                )}
                                {!lead.contactedAt && !lead.convertedAt && !lead.hasPaid && (
                                  <span className="px-2 py-1 text-xs font-medium bg-red-500/10 text-red-500 rounded-full">
                                    Pendente
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                {formatDateShort(lead.createdAt)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  {lead.isNew && (
                                    <DropdownMenuItem onClick={() => handleMarkAsContacted(lead.id)}>
                                      <Check className="h-4 w-4 mr-2" />
                                      Marcar como Contatado
                                    </DropdownMenuItem>
                                  )}
                                  {!lead.convertedAt && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleMarkAsConverted(lead.id)}>
                                        <Check className="h-4 w-4 mr-2" />
                                        Marcar como Convertido
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleToggleResend(lead.id, !lead.resendPaused)}
                                        className={lead.resendPaused ? "text-green-500" : "text-orange-500"}
                                      >
                                        {lead.resendPaused ? (
                                          <>
                                            <Play className="h-4 w-4 mr-2" />
                                            Retomar Reenvio
                                          </>
                                        ) : (
                                          <>
                                            <Pause className="h-4 w-4 mr-2" />
                                            Pausar Reenvio
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {(lead.isNew || !lead.convertedAt) && <DropdownMenuSeparator />}
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(lead.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Deletar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
      </main>
    </div>
  )
}
