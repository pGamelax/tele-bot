"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { useBot, useUpdateBot } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, Plus, X, Save, Copy, Check } from "lucide-react"
import { ImageUpload } from "@/components/ui/image-upload"
import { PriceInput } from "@/components/ui/price-input"

// Componente para seção de informações do bot
function BotInfoSection({ botId }: { botId: string }) {
  const { toast } = useToast()
  const [copiedId, setCopiedId] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  const trackingLink = `${API_URL}/api/tracking/${botId}/redirect`

  const copyToClipboard = async (text: string, type: "id" | "link") => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === "id") {
        setCopiedId(true)
        setTimeout(() => setCopiedId(false), 2000)
      } else {
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
      }
      toast({
        title: "Copiado!",
        description: type === "id" ? "ID do bot copiado" : "Link de tracking copiado",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao copiar para a área de transferência",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      {/* ID do Bot */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">ID do Bot</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={botId}
            readOnly
            className="flex-1 px-3 py-2 border border-input bg-card rounded-lg text-foreground"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(botId, "id")}
            className="shrink-0"
          >
            {copiedId ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Link de Tracking */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Link de Tracking para Facebook Ads
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={trackingLink}
            readOnly
            className="flex-1 px-3 py-2 border border-input bg-card rounded-lg text-foreground text-sm"
          />
          <Button
            type="button"
            variant="default"
            size="icon"
            onClick={() => copyToClipboard(trackingLink, "link")}
            className="shrink-0"
          >
            {copiedLink ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Instruções */}
      <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
        <p className="text-sm font-semibold text-foreground mb-2">Como usar:</p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Cole este link no campo{" "}
          <span className="font-semibold text-primary">"URL do site"</span> dos seus anúncios do
          Facebook Ads.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          O Facebook adicionará <span className="font-semibold text-primary">automaticamente</span> o parâmetro{" "}
          <span className="font-semibold text-primary">fbclid</span> quando o usuário clicar no
          anúncio. Você não precisa adicionar este parâmetro manualmente.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-semibold text-primary">Opcional:</span> Se quiser rastrear campanhas específicas, você pode adicionar parâmetros UTM ao link, como{" "}
          <span className="font-semibold text-primary">?utm_source=facebook&utm_campaign=nome_da_campanha</span>.
          Você também pode configurar esses parâmetros diretamente no Facebook Ads na seção "Parâmetros UTM".
        </p>
      </div>
    </>
  )
}

export default function EditBotPage() {
  const router = useRouter()
  const params = useParams()
  const botId = params.id as string
  const { data: session } = authClient.useSession()
  const { data: bot, isLoading } = useBot(botId)
  const updateBot = useUpdateBot()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "",
    telegramToken: "",
    syncpayApiKey: "",
    syncpayApiSecret: "",
    startImage: "",
    startCaption: "",
    resendImage: "",
    resendCaption: "",
    resendFirstDelay: 20,
    resendInterval: 10,
    isActive: true,
    facebookPixelId: "",
    facebookAccessToken: "",
    paymentConfirmedMessage: "",
  })

  const [paymentButtons, setPaymentButtons] = useState<Array<{ text: string; value: number }>>([])
  const [resendPaymentButtons, setResendPaymentButtons] = useState<
    Array<{ text: string; value: number }>
  >([])

  useEffect(() => {
    if (!session) {
      router.push("/sign-in")
    }
  }, [session, router])

  useEffect(() => {
    if (bot) {
      setFormData({
        name: bot.name,
        telegramToken: bot.telegramToken,
        syncpayApiKey: bot.syncpayApiKey,
        syncpayApiSecret: bot.syncpayApiSecret,
        startImage: bot.startImage || "",
        startCaption: bot.startCaption || "",
        resendImage: bot.resendImage || "",
        resendCaption: bot.resendCaption || "",
        resendFirstDelay: bot.resendFirstDelay,
        resendInterval: bot.resendInterval,
        isActive: bot.isActive,
        facebookPixelId: bot.facebookPixelId || "",
        facebookAccessToken: bot.facebookAccessToken || "",
        paymentConfirmedMessage: bot.paymentConfirmedMessage || "",
      })
      setPaymentButtons(
        bot.paymentButtons.filter((b) => b.type === "start").map((b) => ({ text: b.text, value: b.value }))
      )
      setResendPaymentButtons(
        bot.paymentButtons.filter((b) => b.type === "resend").map((b) => ({ text: b.text, value: b.value }))
      )
    }
  }, [bot])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await updateBot.mutateAsync({
        id: botId,
        ...formData,
        paymentButtons,
        resendPaymentButtons,
      })
      toast({
        title: "Sucesso",
        description: "Bot atualizado com sucesso",
      })
      router.push("/bots")
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar bot",
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

  const addResendPaymentButton = () => {
    setResendPaymentButtons([...resendPaymentButtons, { text: "", value: 0 }])
  }

  const removeResendPaymentButton = (index: number) => {
    setResendPaymentButtons(resendPaymentButtons.filter((_, i) => i !== index))
  }

  const updateResendPaymentButton = (index: number, field: string, value: string | number) => {
    const updated = [...resendPaymentButtons]
    updated[index] = { ...updated[index], [field]: value }
    setResendPaymentButtons(updated)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Bot não encontrado</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/bots" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Editar Bot</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações do Bot - Tracking */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Bot</CardTitle>
              <CardDescription>ID do bot e link para usar em anúncios do Facebook</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <BotInfoSection botId={botId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Configure as informações principais do bot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nome do Bot</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Token do Telegram
                </label>
                <input
                  type="text"
                  required
                  value={formData.telegramToken}
                  onChange={(e) => setFormData({ ...formData, telegramToken: e.target.value })}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  SyncPay API Key
                </label>
                <input
                  type="text"
                  required
                  value={formData.syncpayApiKey}
                  onChange={(e) => setFormData({ ...formData, syncpayApiKey: e.target.value })}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  SyncPay API Secret
                </label>
                <input
                  type="text"
                  required
                  value={formData.syncpayApiSecret}
                  onChange={(e) => setFormData({ ...formData, syncpayApiSecret: e.target.value })}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Facebook Pixel ID
                </label>
                <input
                  type="text"
                  value={formData.facebookPixelId}
                  onChange={(e) => setFormData({ ...formData, facebookPixelId: e.target.value })}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Facebook Access Token
                </label>
                <input
                  type="text"
                  value={formData.facebookAccessToken}
                  onChange={(e) =>
                    setFormData({ ...formData, facebookAccessToken: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-foreground">Bot Ativo</span>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mensagem Inicial</CardTitle>
              <CardDescription>Configure a mensagem enviada quando o usuário inicia o bot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUpload
                label="Imagem/Video de Início"
                value={formData.startImage}
                onChange={(url) => setFormData({ ...formData, startImage: url })}
                maxSizeMB={50}
              />
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  URL da Imagem/Video (ou cole manualmente)
                </label>
                <input
                  type="text"
                  value={formData.startImage}
                  onChange={(e) => setFormData({ ...formData, startImage: e.target.value })}
                  placeholder="http://..."
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Legenda</label>
                <textarea
                  value={formData.startCaption}
                  onChange={(e) => setFormData({ ...formData, startCaption: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Botões de Pagamento Inicial
                </label>
                {paymentButtons.map((btn, index) => (
                  <div key={index} className="flex mb-2 gap-2">
                    <input
                      type="text"
                      placeholder="Texto do botão"
                      value={btn.text}
                      onChange={(e) => updatePaymentButton(index, "text", e.target.value)}
                      className="flex-1 px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                    />
                   
                      <PriceInput
                        value={btn.value}
                        onChange={(value) => updatePaymentButton(index, "value", value)}
                        placeholder="R$ 0,00"
                        className="px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                      />
                    
                    <Button
                      variant="outline"
                      onClick={() => removePaymentButton(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addPaymentButton}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Botão
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mensagem de Reenvio</CardTitle>
              <CardDescription>
                Configure a mensagem enviada quando o pagamento não é realizado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUpload
                label="Imagem/Video de Reenvio"
                value={formData.resendImage}
                onChange={(url) => setFormData({ ...formData, resendImage: url })}
                maxSizeMB={50}
              />
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  URL da Imagem/Video (ou cole manualmente)
                </label>
                <input
                  type="text"
                  value={formData.resendImage}
                  onChange={(e) => setFormData({ ...formData, resendImage: e.target.value })}
                  placeholder="http://..."
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Legenda</label>
                <textarea
                  value={formData.resendCaption}
                  onChange={(e) => setFormData({ ...formData, resendCaption: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Primeiro Reenvio (minutos)
                  </label>
                  <input
                    type="text"
                    value={formData.resendFirstDelay}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setFormData({ ...formData, resendFirstDelay: value ? parseInt(value) : 20 })
                    }}
                    placeholder="20"
                    className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Intervalo entre Reenvios (minutos)
                  </label>
                  <input
                    type="text"
                    value={formData.resendInterval}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setFormData({ ...formData, resendInterval: value ? parseInt(value) : 10 })
                    }}
                    placeholder="10"
                    className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Botões de Pagamento de Reenvio
                </label>
                {resendPaymentButtons.map((btn, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Texto do botão"
                      value={btn.text}
                      onChange={(e) => updateResendPaymentButton(index, "text", e.target.value)}
                      className="flex-1 px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                    />
                    <div>
                      <PriceInput
                        value={btn.value}
                        onChange={(value) => updateResendPaymentButton(index, "value", value)}
                        placeholder="R$ 0,00"
                        className="px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeResendPaymentButton(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addResendPaymentButton}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Botão
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configurações Opcionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Mensagem após Confirmação de Pagamento
                </label>
                <textarea
                  value={formData.paymentConfirmedMessage}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentConfirmedMessage: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/bots">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" disabled={updateBot.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateBot.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
