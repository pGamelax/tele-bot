"use client"

import { useState, useMemo } from "react"
import { useLeads, useBots, usePayments, useUpdateLead, useDeleteLead, useToggleResend } from "@/lib/api-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Loading } from "@/components/ui/loading"
import {
  Users, Check, Clock, Pause, Play, MoreVertical, Trash2,
  Search, UserPlus, Ban, RefreshCw, Bot, Network,
} from "lucide-react"

type PeriodFilter = "today" | "yesterday" | "week" | "month" | "all"

const PERIODS = [
  { id: "today",     label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "week",      label: "Semana" },
  { id: "month",     label: "Mês" },
  { id: "all",       label: "Tudo" },
] as const

const fmtDateShort = (s: string) =>
  new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })

const fmtDateTime = (s: string) => {
  const d = new Date(s)
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v / 100)

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

export default function LeadsPage() {
  const { data: bots } = useBots()
  const { data: payments = [] } = usePayments()
  const { data: allLeads, isLoading } = useLeads()
  const updateLead    = useUpdateLead()
  const deleteLead    = useDeleteLead()
  const toggleResend  = useToggleResend()
  const { toast }     = useToast()

  const [selectedBotId,  setSelectedBotId]  = useState("")
  const [selectedFlow,   setSelectedFlow]   = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedStart,  setSelectedStart]  = useState("all")
  const [searchQuery,    setSearchQuery]    = useState("")
  const [periodFilter,   setPeriodFilter]   = useState<PeriodFilter>("all")

  const leadsWithPayments = useMemo(() => {
    if (!allLeads) return []
    return allLeads.map((lead) => {
      const lp = payments.filter(
        (p) => p.botId === lead.botId && p.telegramChatId === lead.telegramChatId && p.status === "paid"
      )
      const last = lp.length > 0 ? lp[lp.length - 1] : null
      // Primeiro PIX gerado (qualquer status) — payments vêm em ordem desc, então o último = mais antigo
      const allLeadPix = payments.filter(
        (p) => p.botId === lead.botId && p.telegramChatId === lead.telegramChatId
      )
      const firstPix = allLeadPix.length > 0 ? allLeadPix[allLeadPix.length - 1] : null
      return { ...lead, hasPaid: lp.length > 0, lastPayment: last, paymentCode: last?.id ?? null, firstPix }
    })
  }, [allLeads, payments])

  const filteredLeads = useMemo(() => {
    const { start, end } = getPeriodDates(periodFilter)
    return leadsWithPayments.filter((lead) => {
      if (start && end) {
        const d = new Date(lead.createdAt)
        if (d < start || d > end) return false
      }
      if (selectedBotId && lead.botId !== selectedBotId) return false
      if (selectedFlow !== "all") {
        if (selectedFlow === "none" && lead.utmCampaign) return false
        if (selectedFlow !== "none" && lead.utmCampaign !== selectedFlow) return false
      }
      if (selectedStatus !== "all") {
        if (selectedStatus === "new"     && !lead.isNew) return false
        if (selectedStatus === "pending" && (lead.contactedAt || lead.convertedAt || lead.hasPaid)) return false
        if (selectedStatus === "paid"    && !lead.hasPaid && !lead.convertedAt) return false
        if (selectedStatus === "blocked" && !lead.isBlocked) return false
      }
      if (selectedStart !== "all") {
        if (selectedStart === "new" && !lead.isNew) return false
        if (selectedStart === "old" &&  lead.isNew) return false
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const name = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.toLowerCase()
        const un   = (lead.telegramUsername ?? "").toLowerCase()
        const cid  = lead.telegramChatId.toLowerCase()
        if (!name.includes(q) && !un.includes(q) && !cid.includes(q)) return false
      }
      return true
    })
  }, [leadsWithPayments, selectedBotId, selectedFlow, selectedStatus, selectedStart, searchQuery, periodFilter])

  const stats = useMemo(() => {
    const { start, end } = getPeriodDates(periodFilter)
    const list = start && end
      ? leadsWithPayments.filter((l) => { const d = new Date(l.createdAt); return d >= start && d <= end })
      : leadsWithPayments
    return {
      novos:      list.filter((l) => l.isNew).length,
      pendentes:  list.filter((l) => !l.contactedAt && !l.convertedAt && !l.hasPaid).length,
      pagos:      list.filter((l) => l.hasPaid || l.convertedAt).length,
      bloqueados: list.filter((l) => l.isBlocked).length,
      total:      list.length,
    }
  }, [leadsWithPayments, periodFilter])

  const uniqueFlows = useMemo(() => {
    const s = new Set<string>()
    allLeads?.forEach((l) => { if (l.utmCampaign) s.add(l.utmCampaign) })
    return Array.from(s).sort()
  }, [allLeads])

  const getPaymentPlan = (lead: typeof leadsWithPayments[0]) => {
    if (!lead.lastPayment) return "-"
    const bot = bots?.find((b) => b.id === lead.botId)
    const btn = bot?.paymentButtons.find((b) => b.value === lead.lastPayment!.amount)
    return btn ? btn.text : fmtCurrency(lead.lastPayment.amount)
  }

  const handleMarkAsContacted = async (id: string) => {
    try {
      await updateLead.mutateAsync({ id, isNew: false, contactedAt: new Date().toISOString() })
      toast({ title: "Sucesso", description: "Lead marcado como contatado" })
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" })
    }
  }

  const handleMarkAsConverted = async (id: string) => {
    try {
      await updateLead.mutateAsync({ id, isNew: false, convertedAt: new Date().toISOString() })
      toast({ title: "Sucesso", description: "Lead marcado como convertido" })
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este lead?")) return
    try {
      await deleteLead.mutateAsync(id)
      toast({ title: "Sucesso", description: "Lead deletado" })
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" })
    }
  }

  const handleToggleResend = async (id: string, paused: boolean) => {
    try {
      await toggleResend.mutateAsync({ id, paused })
      toast({ title: "Sucesso", description: paused ? "Reenvio pausado" : "Reenvio retomado" })
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" })
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 h-14 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold text-foreground">Leads</h1>
            <p className="text-xs text-muted-foreground">Gerencie seus leads e clientes</p>
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

      <main className="flex-1 p-6 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {[
            { label: "Novos",      value: stats.novos,      icon: UserPlus,   color: "text-green-500" },
            { label: "Pendentes",  value: stats.pendentes,  icon: Clock,      color: "text-yellow-500" },
            { label: "Pagos",      value: stats.pagos,      icon: RefreshCw,  color: "text-teal-500" },
            { label: "Bloqueados", value: stats.bloqueados, icon: Ban,        color: "text-red-500" },
            { label: "Total",      value: stats.total,      icon: Users,      color: "text-foreground" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome, @username ou ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 h-9 text-sm border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {/* Filters row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Select value={selectedBotId || "all"} onValueChange={(v) => setSelectedBotId(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Todos bots" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos bots</SelectItem>
                  {bots?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={selectedFlow} onValueChange={setSelectedFlow}>
                <SelectTrigger className="h-8 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Network className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Todos fluxos" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos fluxos</SelectItem>
                  <SelectItem value="none">Sem fluxo</SelectItem>
                  {uniqueFlows.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="new">Novos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                  <SelectItem value="blocked">Bloqueados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedStart} onValueChange={setSelectedStart}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos starts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos starts</SelectItem>
                  <SelectItem value="new">Novos</SelectItem>
                  <SelectItem value="old">Antigos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        {filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Nenhum lead encontrado</p>
              <p className="text-xs text-muted-foreground">Ajuste os filtros ou aguarde novos leads</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop */}
            <Card className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Nome / Username", "ID", "Cód. Vendas", "Plano", "Bot", "Fluxo", "Status", "Start", "PIX Gerado", ""].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider first:pl-5 last:pr-5 last:text-right">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead, i) => (
                      <tr key={lead.id} className={`hover:bg-muted/30 transition-colors ${i > 0 ? "border-t border-border" : ""}`}>
                        <td className="px-4 py-3 pl-5">
                          <p className="text-sm font-medium text-foreground">
                            {lead.firstName || lead.telegramUsername || "Usuário"}
                            {lead.lastName && ` ${lead.lastName}`}
                          </p>
                          {lead.telegramUsername && (
                            <p className="text-[10px] text-muted-foreground">@{lead.telegramUsername}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground font-mono">{lead.telegramChatId}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground font-mono">
                            {lead.paymentCode ? lead.paymentCode.substring(0, 8) + "…" : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-foreground">{getPaymentPlan(lead)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-foreground">{lead.bot.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">{lead.utmCampaign || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {lead.isNew        && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">Novo</span>}
                            {lead.hasPaid      && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-600">Pago</span>}
                            {lead.convertedAt  && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">Convertido</span>}
                            {lead.isBlocked    && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">Bloqueado</span>}
                            {lead.resendPaused && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-500">Pausado</span>}
                            {!lead.contactedAt && !lead.convertedAt && !lead.hasPaid && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600">Pendente</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(lead.createdAt)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {lead.firstPix ? fmtDateTime(lead.firstPix.createdAt) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 pr-5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 text-sm">
                              {lead.isNew && (
                                <DropdownMenuItem onClick={() => handleMarkAsContacted(lead.id)}>
                                  <Check className="h-4 w-4 mr-2" /> Marcar como contatado
                                </DropdownMenuItem>
                              )}
                              {!lead.convertedAt && (
                                <>
                                  <DropdownMenuItem onClick={() => handleMarkAsConverted(lead.id)}>
                                    <Check className="h-4 w-4 mr-2" /> Marcar como convertido
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleToggleResend(lead.id, !lead.resendPaused)}
                                    className={lead.resendPaused ? "text-green-600" : "text-orange-500"}
                                  >
                                    {lead.resendPaused
                                      ? <><Play className="h-4 w-4 mr-2" /> Retomar reenvio</>
                                      : <><Pause className="h-4 w-4 mr-2" /> Pausar reenvio</>}
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(lead.id)} className="text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Deletar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile cards */}
            <div className="lg:hidden space-y-3">
              {filteredLeads.map((lead) => (
                <Card key={lead.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {lead.firstName || lead.telegramUsername || "Usuário"}
                          {lead.lastName && ` ${lead.lastName}`}
                        </p>
                        {lead.telegramUsername && (
                          <p className="text-xs text-muted-foreground">@{lead.telegramUsername}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {lead.telegramChatId}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 text-sm">
                          {lead.isNew && (
                            <DropdownMenuItem onClick={() => handleMarkAsContacted(lead.id)}>
                              <Check className="h-4 w-4 mr-2" /> Marcar como contatado
                            </DropdownMenuItem>
                          )}
                          {!lead.convertedAt && (
                            <>
                              <DropdownMenuItem onClick={() => handleMarkAsConverted(lead.id)}>
                                <Check className="h-4 w-4 mr-2" /> Marcar como convertido
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleResend(lead.id, !lead.resendPaused)}
                                className={lead.resendPaused ? "text-green-600" : "text-orange-500"}
                              >
                                {lead.resendPaused
                                  ? <><Play className="h-4 w-4 mr-2" /> Retomar reenvio</>
                                  : <><Pause className="h-4 w-4 mr-2" /> Pausar reenvio</>}
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(lead.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {[
                        { l: "Plano",       v: getPaymentPlan(lead) },
                        { l: "Bot",         v: lead.bot.name },
                        { l: "Cód. vendas", v: lead.paymentCode ? lead.paymentCode.substring(0, 8) + "…" : "—" },
                        { l: "Start",       v: fmtDateTime(lead.createdAt) },
                        { l: "PIX Gerado",  v: lead.firstPix ? fmtDateTime(lead.firstPix.createdAt) : "—" },
                      ].map(({ l, v }) => (
                        <div key={l}>
                          <p className="text-[10px] text-muted-foreground">{l}</p>
                          <p className="text-xs text-foreground font-medium truncate">{v}</p>
                        </div>
                      ))}
                    </div>

                    {lead.utmCampaign && (
                      <p className="text-xs text-muted-foreground">Fluxo: <span className="text-foreground">{lead.utmCampaign}</span></p>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {lead.isNew        && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">Novo</span>}
                      {lead.hasPaid      && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-600">Pago</span>}
                      {lead.convertedAt  && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">Convertido</span>}
                      {lead.isBlocked    && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">Bloqueado</span>}
                      {lead.resendPaused && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-500">Pausado</span>}
                      {!lead.contactedAt && !lead.convertedAt && !lead.hasPaid && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600">Pendente</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
