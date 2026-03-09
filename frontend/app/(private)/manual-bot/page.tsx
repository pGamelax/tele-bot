"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import {
  useManualBot,
  useManualBotStats,
  useManualBotBlockedLeads,
  useCreateOrUpdateManualBot,
  useUpdateManualBotToken,
  useSendManualBotMessages,
  useRemoveBlockedLead,
} from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import {
  ArrowLeft,
  Plus,
  X,
  Save,
  Bot as BotIcon,
  MessageSquare,
  Send,
  Ban,
  RefreshCw,
  Users,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import Link from "next/link"
import { ImageUpload } from "@/components/ui/image-upload"
import { PriceInput } from "@/components/ui/price-input"

export default function ManualBotPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const { data: bot, isLoading: botLoading } = useManualBot()
  const { data: stats } = useManualBotStats()
  const { data: blockedLeads = [], refetch: refetchBlocked } = useManualBotBlockedLeads()
  const createOrUpdateBot = useCreateOrUpdateManualBot()
  const updateToken = useUpdateManualBotToken()
  const sendMessages = useSendManualBotMessages()
  const removeBlocked = useRemoveBlockedLead()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "",
    telegramToken: "",
    syncpayApiKey: "",
    syncpayApiSecret: "",
    startImage: "",
    startCaption: "",
    startButtonMessage: "",
    paymentConfirmedMessage: "",
  })

  const [paymentButtons, setPaymentButtons] = useState<Array<{ text: string; value: number }>>([])
  const [newToken, setNewToken] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<{
    sent: number
    blocked: number
    errors: number
    total: number
  } | null>(null)

  useEffect(() => {
    if (!session) {
      router.push("/sign-in")
    }
  }, [session, router])

  useEffect(() => {
    if (bot) {
      setFormData({
        name: bot.name || "",
        telegramToken: bot.telegramToken || "",
        syncpayApiKey: bot.syncpayApiKey || "",
        syncpayApiSecret: bot.syncpayApiSecret || "",
        startImage: bot.startImage || "",
        startCaption: bot.startCaption || "",
        startButtonMessage: bot.startButtonMessage || "",
        paymentConfirmedMessage: bot.paymentConfirmedMessage || "",
      })
      setPaymentButtons(
        bot.paymentButtons?.map((btn) => ({ text: btn.text, value: btn.value })) || []
      )
    }
  }, [bot])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await createOrUpdateBot.mutateAsync({
        name: formData.name,
        telegramToken: formData.telegramToken,
        syncpayApiKey: formData.syncpayApiKey,
        syncpayApiSecret: formData.syncpayApiSecret,
        startImage: formData.startImage || null,
        startCaption: formData.startCaption || null,
        startButtonMessage: formData.startButtonMessage || null,
        paymentConfirmedMessage: formData.paymentConfirmedMessage || null,
        paymentButtons,
      })
      toast({
        title: "Sucesso",
        description: "Bot manual salvo com sucesso",
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar bot manual",
        variant: "destructive",
      })
    }
  }

  const handleUpdateToken = async () => {
    if (!newToken.trim()) {
      toast({
        title: "Erro",
        description: "Token não pode estar vazio",
        variant: "destructive",
      })
      return
    }

    try {
      await updateToken.mutateAsync(newToken)
      setNewToken("")
      toast({
        title: "Sucesso",
        description: "Token atualizado com sucesso",
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar token",
        variant: "destructive",
      })
    }
  }

  const handleSendMessages = async () => {
    if (!bot) {
      toast({
        title: "Erro",
        description: "Configure o bot antes de enviar mensagens",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    setSendResult(null)

    try {
      const result = await sendMessages.mutateAsync()
      setSendResult({
        sent: result.sent || 0,
        blocked: result.blocked || 0,
        errors: result.errors || 0,
        total: result.total || 0,
      })
      await refetchBlocked()
      toast({
        title: "Disparo concluído",
        description: `Enviado: ${result.sent}, Bloqueados: ${result.blocked}, Erros: ${result.errors}`,
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao disparar mensagens",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleRemoveBlocked = async (chatId: string) => {
    try {
      await removeBlocked.mutateAsync(chatId)
      await refetchBlocked()
      toast({
        title: "Sucesso",
        description: "Lead removido da lista de bloqueados",
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover lead bloqueado",
        variant: "destructive",
      })
    }
  }

  const addPaymentButton = () => {
    setPaymentButtons([...paymentButtons, { text: "", value: 0 }])
  }

  const removePaymentButton = (index: number) => {
    setPaymentButtons(paymentButtons.filter((_, i) => i !== index))
  }

  const updatePaymentButton = (index: number, field: string, value: string | number) => {
    const updated = [...paymentButtons]
    updated[index] = { ...updated[index], [field]: value }
    setPaymentButtons(updated)
  }

  if (botLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/bots"
                className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar</span>
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                  Bot de Disparo Manual
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Configure e envie mensagens manualmente para todos os leads
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário de Configuração */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Informações Básicas */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BotIcon className="h-5 w-5" />
                    Informações Básicas
                  </CardTitle>
                  <CardDescription>Configure as informações principais do bot</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Nome do Bot <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Bot de Disparo Manual"
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Token do Telegram <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.telegramToken}
                      onChange={(e) =>
                        setFormData({ ...formData, telegramToken: e.target.value })
                      }
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      SyncPay API Key <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.syncpayApiKey}
                      onChange={(e) =>
                        setFormData({ ...formData, syncpayApiKey: e.target.value })
                      }
                      placeholder="Sua API Key da SyncPay"
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      SyncPay API Secret <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.syncpayApiSecret}
                      onChange={(e) =>
                        setFormData({ ...formData, syncpayApiSecret: e.target.value })
                      }
                      placeholder="Sua API Secret da SyncPay"
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Mensagem Inicial */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Mensagem Inicial
                  </CardTitle>
                  <CardDescription>
                    Configure a mensagem que será enviada para todos os leads
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Imagem/Vídeo
                    </label>
                    <ImageUpload
                      value={formData.startImage}
                      onChange={(url) => setFormData({ ...formData, startImage: url })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Legenda da Imagem
                    </label>
                    <textarea
                      value={formData.startCaption}
                      onChange={(e) =>
                        setFormData({ ...formData, startCaption: e.target.value })
                      }
                      placeholder="Digite a legenda da imagem..."
                      rows={4}
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Mensagem para os Botões (opcional)
                    </label>
                    <textarea
                      value={formData.startButtonMessage}
                      onChange={(e) =>
                        setFormData({ ...formData, startButtonMessage: e.target.value })
                      }
                      placeholder="Se preenchido, esta mensagem será enviada separadamente com os botões. Caso contrário, os botões aparecerão na legenda da imagem."
                      rows={3}
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors resize-none"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Botões de Pagamento */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Botões de Pagamento
                  </CardTitle>
                  <CardDescription>Configure os botões que aparecerão na mensagem</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentButtons.map((btn, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Texto do Botão
                          </label>
                          <input
                            type="text"
                            value={btn.text}
                            onChange={(e) =>
                              updatePaymentButton(index, "text", e.target.value)
                            }
                            placeholder="Comprar Agora"
                            className="w-full px-3 py-2 text-sm border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Valor (R$)
                          </label>
                          <PriceInput
                            value={btn.value}
                            onChange={(value) => updatePaymentButton(index, "value", value)}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePaymentButton(index)}
                        className="mt-6 shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addPaymentButton} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Botão
                  </Button>
                </CardContent>
              </Card>

              {/* Resposta após confirmação de pagamento */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Resposta após Pagamento
                  </CardTitle>
                  <CardDescription>
                    Mensagem enviada ao cliente quando o PIX for confirmado. Use {"{amount}"} para o valor.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={formData.paymentConfirmedMessage}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentConfirmedMessage: e.target.value })
                    }
                    placeholder="Ex: ✅ Pagamento confirmado! Obrigado pela compra de R$ {amount}."
                    rows={4}
                    className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors resize-none"
                  />
                </CardContent>
              </Card>

              {/* Botão Salvar */}
              <div className="flex justify-end">
                <Button type="submit" disabled={createOrUpdateBot.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {createOrUpdateBot.isPending ? "Salvando..." : "Salvar Configuração"}
                </Button>
              </div>
            </form>

            {/* Trocar Token */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Trocar Token do Bot
                </CardTitle>
                <CardDescription>
                  Use esta opção quando houver muitos bloqueios. O bot continuará enviando
                  mensagens manualmente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Novo Token do Telegram
                  </label>
                  <input
                    type="text"
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleUpdateToken}
                  disabled={updateToken.isPending || !newToken.trim()}
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {updateToken.isPending ? "Atualizando..." : "Atualizar Token"}
                </Button>
              </CardContent>
            </Card>

            {/* Disparar Mensagens */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Disparar Mensagens
                </CardTitle>
                <CardDescription>
                  Enviar mensagem para todos os leads de todos os bots (exceto bloqueados)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sendResult && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total de leads:</span>
                      <span className="text-sm">{sendResult.total}</span>
                    </div>
                    <div className="flex items-center justify-between text-green-500">
                      <span className="text-sm font-medium">Enviados:</span>
                      <span className="text-sm">{sendResult.sent}</span>
                    </div>
                    <div className="flex items-center justify-between text-orange-500">
                      <span className="text-sm font-medium">Bloqueados:</span>
                      <span className="text-sm">{sendResult.blocked}</span>
                    </div>
                    {sendResult.errors > 0 && (
                      <div className="flex items-center justify-between text-red-500">
                        <span className="text-sm font-medium">Erros:</span>
                        <span className="text-sm">{sendResult.errors}</span>
                      </div>
                    )}
                  </div>
                )}
                <Button
                  type="button"
                  onClick={handleSendMessages}
                  disabled={isSending || !bot || sendMessages.isPending}
                  className="w-full"
                  size="lg"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSending || sendMessages.isPending
                    ? "Enviando mensagens..."
                    : "Disparar Mensagens para Todos os Leads"}
                </Button>
                {!bot && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <p className="text-sm text-yellow-500">
                      Configure o bot antes de disparar mensagens
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lista de Leads Bloqueados */}
          <div className="space-y-6">
            {/* Estatísticas - Quantos deram /start */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Leads com /start
                </CardTitle>
                <CardDescription>
                  Total de pessoas que iniciaram conversa com seus bots
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {stats?.totalLeads ?? 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Disponíveis para disparo (exceto bloqueados)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="h-5 w-5" />
                  Leads Bloqueados
                </CardTitle>
                <CardDescription>
                  {blockedLeads.length} lead(s) bloqueado(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {blockedLeads.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum lead bloqueado ainda
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {blockedLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {lead.firstName && lead.lastName
                                ? `${lead.firstName} ${lead.lastName}`
                                : lead.telegramUsername
                                ? `@${lead.telegramUsername}`
                                : lead.telegramChatId}
                            </p>
                            {lead.telegramUsername && (
                              <p className="text-xs text-muted-foreground truncate">
                                @{lead.telegramUsername}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Bloqueado em:{" "}
                              {new Date(lead.blockedAt).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveBlocked(lead.telegramChatId)}
                            disabled={removeBlocked.isPending}
                            className="shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
