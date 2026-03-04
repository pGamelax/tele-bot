"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { useBots, useDeleteBot, Bot } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Loading } from "@/components/ui/loading"
import { 
  Plus, 
  Bot as BotIcon, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff,
  Activity,
  DollarSign,
  Users,
  ArrowRight
} from "lucide-react"

export default function BotsPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const { data: bots, isLoading } = useBots()
  const deleteBot = useDeleteBot()
  const { toast } = useToast()

  useEffect(() => {
    if (!session) {
      router.push("/sign-in")
    }
  }, [session, router])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja deletar o bot "${name}"?`)) {
      return
    }

    try {
      await deleteBot.mutateAsync(id)
      toast({
        title: "Sucesso",
        description: "Bot deletado com sucesso",
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar bot",
        variant: "destructive",
      })
    }
  }

  // Calcular estatísticas
  const stats = useMemo(() => {
    if (!bots) return { total: 0, active: 0, inactive: 0 }
    
    return {
      total: bots.length,
      active: bots.filter(b => b.isActive).length,
      inactive: bots.filter(b => !b.isActive).length,
    }
  }, [bots])

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
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Bots</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Gerencie seus bots do Telegram
              </p>
            </div>
            
            <Link href="/bots/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Bot
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6">
        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-3 px-3 sm:pt-6 sm:px-6">
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BotIcon className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">TOTAL DE BOTS</p>
              <p className="text-2xl font-bold text-foreground mb-1">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Bots cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 px-3 sm:pt-6 sm:px-6">
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Power className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">BOTS ATIVOS</p>
              <p className="text-2xl font-bold text-foreground mb-1">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Em funcionamento</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 px-3 sm:pt-6 sm:px-6">
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className="h-12 w-12 rounded-lg bg-gray-500/10 flex items-center justify-center">
                  <PowerOff className="h-6 w-6 text-gray-500" />
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">BOTS INATIVOS</p>
              <p className="text-2xl font-bold text-foreground mb-1">{stats.inactive}</p>
              <p className="text-xs text-muted-foreground">Desativados</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Bots */}
        {!bots || bots.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BotIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum bot encontrado</h3>
              <p className="text-muted-foreground mb-4">Comece criando seu primeiro bot</p>
              <Link href="/bots/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Bot
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <CardTitle className="text-base sm:text-lg font-semibold">Meus Bots</CardTitle>
                <Link href="/bots/new">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo Bot
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bots.map((bot) => (
                  <div
                    key={bot.id}
                    className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                          bot.isActive ? "bg-green-500/10" : "bg-gray-500/10"
                        }`}>
                          {bot.isActive ? (
                            <Power className="h-5 w-5 text-green-500" />
                          ) : (
                            <PowerOff className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-foreground truncate">{bot.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              bot.isActive 
                                ? "bg-green-500/10 text-green-500" 
                                : "bg-gray-500/10 text-gray-500"
                            }`}>
                              {bot.isActive ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Botões de pagamento:</span>
                        <span className="font-medium text-foreground">
                          {bot.paymentButtons.filter((b) => b.type === "start").length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Botões de reenvio:</span>
                        <span className="font-medium text-foreground">
                          {bot.paymentButtons.filter((b) => b.type === "resend").length}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link href={`/bots/${bot.id}`} className="flex-1">
                        <Button variant="outline" className="w-full gap-2">
                          <Edit className="h-4 w-4" />
                          Editar
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        onClick={() => handleDelete(bot.id, bot.name)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
