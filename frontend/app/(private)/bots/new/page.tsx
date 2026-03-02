"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useCreateBot } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, Plus, X } from "lucide-react"
import Link from "next/link"
import { ImageUpload } from "@/components/ui/image-upload"
import { PriceInput } from "@/components/ui/price-input"

export default function NewBotPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const createBot = useCreateBot()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await createBot.mutateAsync({
        ...formData,
        paymentButtons,
        resendPaymentButtons,
      })
      toast({
        title: "Sucesso",
        description: "Bot criado com sucesso",
      })
      router.push("/bots")
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar bot",
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

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
          <Link href="/bots" className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground mb-3 sm:mb-4">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Link>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Novo Bot</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pb-4 sm:pb-6">
        <form onSubmit={handleSubmit} className="space-y-6">
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
                  <div key={index} className="flex mb-2 gap-2">
                    <input
                      type="text"
                      placeholder="Texto do botão"
                      value={btn.text}
                      onChange={(e) => updateResendPaymentButton(index, "text", e.target.value)}
                      className="flex-1 px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                    />
                    <PriceInput
                      value={btn.value}
                      onChange={(value) => updateResendPaymentButton(index, "value", value)}
                      placeholder="R$ 0,00"
                      className="px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                    />
                    
                    <Button
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
            <Button type="submit" disabled={createBot.isPending}>
              {createBot.isPending ? "Criando..." : "Criar Bot"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
