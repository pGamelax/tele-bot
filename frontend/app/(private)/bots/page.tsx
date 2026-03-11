"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useBots, useDeleteBot } from "@/lib/api-client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Loading } from "@/components/ui/loading"
import { Plus, Bot as BotIcon, Edit, Trash2, Power, PowerOff } from "lucide-react"

export default function BotsPage() {
  const { data: bots, isLoading } = useBots()
  const deleteBot = useDeleteBot()
  const { toast } = useToast()

  const stats = useMemo(() => ({
    total:    bots?.length ?? 0,
    active:   bots?.filter((b) => b.isActive).length ?? 0,
    inactive: bots?.filter((b) => !b.isActive).length ?? 0,
  }), [bots])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja deletar o bot "${name}"?`)) return
    try {
      await deleteBot.mutateAsync(id)
      toast({ title: "Sucesso", description: "Bot deletado com sucesso" })
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro ao deletar bot", variant: "destructive" })
    }
  }

  if (isLoading) return <Loading />

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 h-14 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold text-foreground">Bots</h1>
            <p className="text-xs text-muted-foreground">Gerencie seus bots do Telegram</p>
          </div>
          <Link href="/bots/new">
            <Button size="sm" className="h-8 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Novo Bot
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
                <BotIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Bots cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ativos</p>
                <Power className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-500">{stats.active}</p>
              <p className="text-xs text-muted-foreground mt-1">Em funcionamento</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inativos</p>
                <PowerOff className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.inactive}</p>
              <p className="text-xs text-muted-foreground mt-1">Desativados</p>
            </CardContent>
          </Card>
        </div>

        {/* Bot list */}
        {!bots || bots.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BotIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Nenhum bot encontrado</p>
              <p className="text-xs text-muted-foreground mb-4">Comece criando seu primeiro bot</p>
              <Link href="/bots/new">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Criar Bot
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Meus Bots</p>
              <Link href="/bots/new">
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Novo Bot
                </Button>
              </Link>
            </div>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {bots.map((bot) => (
                  <div
                    key={bot.id}
                    className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                  >
                    {/* Bot header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        bot.isActive ? "bg-green-500/10" : "bg-muted"
                      }`}>
                        {bot.isActive
                          ? <Power className="h-4 w-4 text-green-500" />
                          : <PowerOff className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{bot.name}</p>
                        <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          bot.isActive
                            ? "bg-green-500/10 text-green-600"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {bot.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </div>

                    {/* Bot info */}
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Botões pagamento</span>
                        <span className="text-xs font-medium text-foreground">
                          {bot.paymentButtons.filter((b) => b.type === "start").length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Botões reenvio</span>
                        <span className="text-xs font-medium text-foreground">
                          {bot.paymentButtons.filter((b) => b.type === "resend").length}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link href={`/bots/${bot.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5">
                          <Edit className="h-3.5 w-3.5" /> Editar
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                        onClick={() => handleDelete(bot.id, bot.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
