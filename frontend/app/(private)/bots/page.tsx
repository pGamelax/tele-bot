"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { useBots, useDeleteBot, Bot } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Bot as BotIcon, Edit, Trash2, Power, PowerOff } from "lucide-react"
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Bots</h1>
              <p className="text-sm text-muted-foreground mt-2">Gerencie seus bots do Telegram</p>
            </div>
            <Link href="/bots/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Bot
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot) => (
              <Card key={bot.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{bot.name}</CardTitle>
                    {bot.isActive ? (
                      <Power className="h-5 w-5 text-green-500" />
                    ) : (
                      <PowerOff className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Status:</span>{" "}
                      {bot.isActive ? (
                        <span className="text-green-500">Ativo</span>
                      ) : (
                        <span className="text-muted-foreground">Inativo</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Botões de pagamento:</span>{" "}
                      {bot.paymentButtons.filter((b) => b.type === "start").length}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/bots/${bot.id}`} className="flex-1">
                      <Button variant="outline" className="w-full">
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => handleDelete(bot.id, bot.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
