"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useLeads, useBots, useUpdateLead, useDeleteLead, useToggleResend, Lead } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { Users, Filter, X, Check, Clock, Pause, Play, MoreVertical, Edit, Trash2 } from "lucide-react"
export default function LeadsPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const { data: bots } = useBots()
  const [selectedBotId, setSelectedBotId] = useState<string>("")
  const [showOnlyNew, setShowOnlyNew] = useState<boolean | undefined>(undefined)
  const { data: leads, isLoading } = useLeads(
    selectedBotId || undefined,
    showOnlyNew
  )
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()
  const toggleResend = useToggleResend()
  const { toast } = useToast()

  useEffect(() => {
    if (!session) {
      router.push("/sign-in")
    }
  }, [session, router])

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground mt-2">Gerencie seus leads e clientes</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-foreground mb-1">Bot</label>
                <select
                  value={selectedBotId}
                  onChange={(e) => setSelectedBotId(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                >
                  <option value="">Todos os bots</option>
                  {bots?.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select
                  value={showOnlyNew === undefined ? "" : showOnlyNew ? "new" : "old"}
                  onChange={(e) => {
                    if (e.target.value === "") setShowOnlyNew(undefined)
                    else setShowOnlyNew(e.target.value === "new")
                  }}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                >
                  <option value="">Todos</option>
                  <option value="new">Novos</option>
                  <option value="old">Contatados</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {!leads || leads.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum lead encontrado</h3>
              <p className="text-muted-foreground">Não há leads que correspondam aos filtros selecionados</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <Card key={lead.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {lead.firstName || lead.telegramUsername || "Usuário"}
                          {lead.lastName && ` ${lead.lastName}`}
                        </h3>
                        {lead.isNew && (
                          <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                            Novo
                          </span>
                        )}
                        {lead.convertedAt && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-500/10 text-green-500 rounded-full">
                            Convertido
                          </span>
                        )}
                        {lead.resendPaused && !lead.convertedAt && (
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-500/10 text-yellow-500 rounded-full">
                            Reenvio Pausado
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">Bot:</span> {lead.bot.name}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Username:</span>{" "}
                          {lead.telegramUsername || "N/A"}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Chat ID:</span> {lead.telegramChatId}
                        </p>
                        {lead.utmSource && (
                          <p>
                            <span className="font-medium text-foreground">Fonte:</span> {lead.utmSource}
                            {lead.utmCampaign && ` - ${lead.utmCampaign}`}
                          </p>
                        )}
                        {lead.notes && (
                          <p>
                            <span className="font-medium text-foreground">Notas:</span> {lead.notes}
                          </p>
                        )}
                        <p className="text-xs">
                          <Clock className="h-3 w-3 inline mr-1" />
                          Criado em: {formatDate(lead.createdAt)}
                        </p>
                        {lead.contactedAt && (
                          <p className="text-xs">
                            Contatado em: {formatDate(lead.contactedAt)}
                          </p>
                        )}
                        {lead.convertedAt && (
                          <p className="text-xs">
                            Convertido em: {formatDate(lead.convertedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
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
                                className={lead.resendPaused ? "text-green-500" : "text-yellow-500"}
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
