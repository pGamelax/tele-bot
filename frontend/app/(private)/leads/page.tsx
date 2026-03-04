"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useLeads, useBots, usePayments, useUpdateLead, useDeleteLead, useToggleResend, Lead, Payment } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Calendar
} from "lucide-react"

export default function LeadsPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const { data: bots } = useBots()
  const { data: payments = [] } = usePayments()
  const [selectedBotId, setSelectedBotId] = useState<string>("")
  const [showOnlyNew, setShowOnlyNew] = useState<boolean | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [timeFilter, setTimeFilter] = useState<string>("all")
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

  const getTimeFilterDate = () => {
    const now = new Date()
    switch (timeFilter) {
      case "today":
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        return today
      case "yesterday":
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        return yesterday
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return weekAgo
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return monthAgo
      default:
        return null
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
      return {
        ...lead,
        hasPaid: leadPayments.length > 0
      }
    })
  }, [allLeads, payments])

  const filteredLeads = useMemo(() => {
    let filtered = [...leadsWithPayments]

    if (selectedBotId) {
      filtered = filtered.filter(lead => lead.botId === selectedBotId)
    }

    if (showOnlyNew !== undefined) {
      filtered = filtered.filter(lead => lead.isNew === showOnlyNew)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(lead => {
        const name = `${lead.firstName || ""} ${lead.lastName || ""}`.toLowerCase()
        const username = (lead.telegramUsername || "").toLowerCase()
        const chatId = lead.telegramChatId.toLowerCase()
        return name.includes(query) || username.includes(query) || chatId.includes(query)
      })
    }

    if (timeFilter !== "all") {
      const filterDate = getTimeFilterDate()
      if (filterDate) {
        filtered = filtered.filter(lead => {
          const leadDate = new Date(lead.createdAt)
          if (timeFilter === "today") {
            return leadDate >= filterDate && leadDate < new Date(filterDate.getTime() + 24 * 60 * 60 * 1000)
          }
          return leadDate >= filterDate
        })
      }
    }

    return filtered
  }, [leadsWithPayments, selectedBotId, showOnlyNew, searchQuery, timeFilter])

  const stats = useMemo(() => {
    const novos = filteredLeads.filter(lead => lead.isNew).length
    const pendentes = filteredLeads.filter(lead => !lead.contactedAt && !lead.convertedAt && !lead.hasPaid).length
    const pagos = filteredLeads.filter(lead => lead.hasPaid || lead.convertedAt).length
    const bloqueados = filteredLeads.filter(lead => lead.resendPaused).length
    const total = filteredLeads.length

    return { novos, pendentes, pagos, bloqueados, total }
  }, [filteredLeads])

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Base de Clientes</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">Gerencie seus leads e clientes</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pb-6">
        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="pt-4 sm:pt-6">
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
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">PENDENTES</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-500">{stats.pendentes}</p>
                </div>
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">PAGOS</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-500">{stats.pagos}</p>
                </div>
                <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">BLOQUEADOS</p>
                  <p className="text-xl sm:text-2xl font-bold text-orange-500">{stats.bloqueados}</p>
                </div>
                <Ban className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 sm:pt-6">
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

              {/* Filtros de Tempo */}
              <div className="flex flex-wrap gap-2">
                {["Hoje", "Ontem", "Semana", "Mês", "Tudo"].map((period) => {
                  const value = period === "Tudo" ? "all" : period.toLowerCase()
                  const isActive = timeFilter === value
                  return (
                    <Button
                      key={period}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTimeFilter(value)}
                      className={isActive ? "" : "bg-card"}
                    >
                      {period}
                    </Button>
                  )
                })}
              </div>

              {/* Filtros Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Select 
                  value={selectedBotId || "all"} 
                  onValueChange={(value) => setSelectedBotId(value === "all" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os Bots" />
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
                  value={showOnlyNew === undefined ? "all" : showOnlyNew ? "new" : "old"}
                  onValueChange={(value) => {
                    if (value === "all") setShowOnlyNew(undefined)
                    else setShowOnlyNew(value === "new")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="new">Novos</SelectItem>
                    <SelectItem value="old">Contatados</SelectItem>
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
                      <th className="px-4 py-3 text-left text-xs sm:text-sm font-medium text-foreground">BOT</th>
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
                          <div className="text-xs sm:text-sm text-foreground">
                            {lead.bot.name}
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
                              <span className="px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-500 rounded-full">
                                Pago
                              </span>
                            )}
                            {lead.convertedAt && (
                              <span className="px-2 py-1 text-xs font-medium bg-green-500/10 text-green-500 rounded-full">
                                Convertido
                              </span>
                            )}
                            {lead.resendPaused && (
                              <span className="px-2 py-1 text-xs font-medium bg-orange-500/10 text-orange-500 rounded-full">
                                Bloqueado
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
