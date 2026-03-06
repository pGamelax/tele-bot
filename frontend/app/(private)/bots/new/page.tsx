"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useCreateBot } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, Plus, X, Save, Bot as BotIcon, MessageSquare, Clock, Settings, DollarSign } from "lucide-react"
import Link from "next/link"
import { ImageUpload } from "@/components/ui/image-upload"
import { MultipleImageUpload } from "@/components/ui/multiple-image-upload"
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
    startButtonMessage: "",
    resendImage: "",
    resendCaption: "",
    resendButtonMessage: "",
    resendFirstDelay: 20,
    resendInterval: 10,
    facebookPixelId: "",
    facebookAccessToken: "",
    paymentConfirmedMessage: "",
  })

  const [resendImages, setResendImages] = useState<string[]>([])
  const [resendCaptions, setResendCaptions] = useState<string[]>([])
  const [paymentButtons, setPaymentButtons] = useState<Array<{ text: string; value: number }>>([])
  const [resendPaymentButtons, setResendPaymentButtons] = useState<
    Array<{ text: string; value: number }>
  >([])
  const [resendButtonGroups, setResendButtonGroups] = useState<
    Array<Array<{ text: string; value: number }>>
  >([])
  const [activeTab, setActiveTab] = useState<"basic" | "start" | "resend" | "advanced">("basic")

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
        resendImages,
        resendCaptions,
        paymentButtons,
        resendPaymentButtons,
        resendButtonGroups,
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

  // Funções para gerenciar múltiplos textos
  const addResendCaption = () => {
    setResendCaptions([...resendCaptions, ""])
  }

  const removeResendCaption = (index: number) => {
    setResendCaptions(resendCaptions.filter((_, i) => i !== index))
  }

  const updateResendCaption = (index: number, value: string) => {
    const updated = [...resendCaptions]
    updated[index] = value
    setResendCaptions(updated)
  }

  // Funções para gerenciar grupos de botões
  const addResendButtonGroup = () => {
    setResendButtonGroups([...resendButtonGroups, []])
  }

  const removeResendButtonGroup = (groupIndex: number) => {
    setResendButtonGroups(resendButtonGroups.filter((_, i) => i !== groupIndex))
  }

  const addButtonToGroup = (groupIndex: number) => {
    const updated = [...resendButtonGroups]
    updated[groupIndex] = [...updated[groupIndex], { text: "", value: 0 }]
    setResendButtonGroups(updated)
  }

  const removeButtonFromGroup = (groupIndex: number, buttonIndex: number) => {
    const updated = [...resendButtonGroups]
    updated[groupIndex] = updated[groupIndex].filter((_, i) => i !== buttonIndex)
    setResendButtonGroups(updated)
  }

  const updateButtonInGroup = (groupIndex: number, buttonIndex: number, field: string, value: string | number) => {
    const updated = [...resendButtonGroups]
    updated[groupIndex][buttonIndex] = { ...updated[groupIndex][buttonIndex], [field]: value }
    setResendButtonGroups(updated)
  }

  const tabs = [
    { id: "basic", label: "Básico", icon: BotIcon },
    { id: "start", label: "Mensagem Inicial", icon: MessageSquare },
    { id: "resend", label: "Remarketing", icon: Clock },
    { id: "advanced", label: "Avançado", icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/bots" className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar</span>
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Novo Bot</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Configure seu bot do Telegram</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6">
        {/* Tabs Navigation */}
        <div className="mb-4 sm:mb-6 border-b border-border">
          <nav className="flex gap-1 overflow-x-auto overflow-y-hidden scrollbar-hide -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 px-3 sm:px-4 md:px-6 lg:px-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tab: Básico */}
          {activeTab === "basic" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BotIcon className="h-5 w-5" />
                  Informações Básicas
                </CardTitle>
                <CardDescription>Configure as informações principais do bot</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Nome do Bot <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Meu Bot"
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
                      onChange={(e) => setFormData({ ...formData, telegramToken: e.target.value })}
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      SyncPay API Key <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.syncpayApiKey}
                      onChange={(e) => setFormData({ ...formData, syncpayApiKey: e.target.value })}
                      placeholder="Sua API Key"
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
                      onChange={(e) => setFormData({ ...formData, syncpayApiSecret: e.target.value })}
                      placeholder="Sua API Secret"
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tab: Mensagem Inicial */}
          {activeTab === "start" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Mensagem Inicial
                </CardTitle>
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
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    URL da Imagem/Video (ou cole manualmente)
                  </label>
                  <input
                    type="text"
                    value={formData.startImage}
                    onChange={(e) => setFormData({ ...formData, startImage: e.target.value })}
                    placeholder="http://..."
                    className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Legenda</label>
                  <textarea
                    value={formData.startCaption}
                    onChange={(e) => setFormData({ ...formData, startCaption: e.target.value })}
                    rows={4}
                    placeholder="Digite a mensagem que será exibida junto com a imagem..."
                    className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Mensagem para os Botões (opcional)
                  </label>
                  <textarea
                    value={formData.startButtonMessage}
                    onChange={(e) => setFormData({ ...formData, startButtonMessage: e.target.value })}
                    rows={3}
                    placeholder="Se preenchido, os botões serão enviados em uma mensagem separada com este texto. Se vazio, os botões aparecerão na legenda da imagem."
                    className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Deixe vazio para usar os botões na legenda da imagem/vídeo
                  </p>
                </div>
                <div className="border-t border-border pt-4">
                  <label className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Botões de Pagamento Inicial
                  </label>
                  <div className="space-y-2">
                    {paymentButtons.map((btn, index) => (
                      <div key={index} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <input
                          type="text"
                          placeholder="Texto do botão (ex: Comprar Agora)"
                          value={btn.text}
                          onChange={(e) => updatePaymentButton(index, "text", e.target.value)}
                          className="flex-1 px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                        />
                        <div className="flex gap-2">
                          <PriceInput
                            value={btn.value}
                            onChange={(value) => updatePaymentButton(index, "value", value)}
                            placeholder="R$ 0,00"
                            className="flex-1 sm:w-32 px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removePaymentButton(index)}
                            className="shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addPaymentButton} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Botão de Pagamento
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tab: Remarketing */}
          {activeTab === "resend" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Mensagem de Remarketing
                </CardTitle>
                <CardDescription>
                  Configure as mensagens enviadas quando o pagamento não é realizado. As imagens serão rotacionadas automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <p className="text-sm text-foreground font-medium mb-1">💡 Como funciona a rotação</p>
                  <p className="text-xs text-muted-foreground">
                    Você pode adicionar múltiplas imagens, textos e grupos de botões. O sistema rotacionará automaticamente:
                    imagem 1, texto 1, botões 1 no primeiro reenvio; imagem 2, texto 2, botões 2 no segundo; e assim por diante.
                    Se houver quantidades diferentes, o sistema usará o índice módulo para rotacionar independentemente.
                  </p>
                </div>

                <MultipleImageUpload
                  images={resendImages}
                  onChange={setResendImages}
                  label="Imagens/Vídeos de Remarketing"
                />

                <div>
                  <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Textos de Remarketing (Rotação)
                  </label>
                  <div className="space-y-3">
                    {resendCaptions.map((caption, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <textarea
                            value={caption}
                            onChange={(e) => updateResendCaption(index, e.target.value)}
                            rows={3}
                            placeholder={`Texto ${index + 1} - Digite a mensagem que será exibida...`}
                            className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors resize-none"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeResendCaption(index)}
                          className="shrink-0 mt-0.5"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addResendCaption} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Texto
                    </Button>
                  </div>
                  {resendCaptions.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Se não adicionar textos, será usado o campo "Legenda para Reenvios" (compatibilidade).
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Primeiro Reenvio (minutos)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.resendFirstDelay}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 20
                        setFormData({ ...formData, resendFirstDelay: value })
                      }}
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Tempo até o primeiro reenvio</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Intervalo entre Reenvios (minutos)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.resendInterval}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 10
                        setFormData({ ...formData, resendInterval: value })
                      }}
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Tempo entre cada reenvio subsequente</p>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <label className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Grupos de Botões de Pagamento (Rotação)
                  </label>
                  <div className="space-y-4">
                    {resendButtonGroups.map((group, groupIndex) => (
                      <div key={groupIndex} className="border border-border rounded-lg p-4 bg-card/50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-foreground">Grupo {groupIndex + 1}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeResendButtonGroup(groupIndex)}
                            className="shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {group.map((btn, buttonIndex) => (
                            <div key={buttonIndex} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                              <input
                                type="text"
                                placeholder="Texto do botão (ex: Comprar Agora)"
                                value={btn.text}
                                onChange={(e) => updateButtonInGroup(groupIndex, buttonIndex, "text", e.target.value)}
                                className="flex-1 px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                              />
                              <div className="flex gap-2">
                                <PriceInput
                                  value={btn.value}
                                  onChange={(value) => updateButtonInGroup(groupIndex, buttonIndex, "value", value)}
                                  placeholder="R$ 0,00"
                                  className="flex-1 sm:w-32 px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => removeButtonFromGroup(groupIndex, buttonIndex)}
                                  className="shrink-0"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => addButtonToGroup(groupIndex)}
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Botão ao Grupo
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addResendButtonGroup} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Grupo de Botões
                    </Button>
                  </div>
                  <div className="mt-4 border-t border-border pt-4">
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Mensagem para os Botões de Remarketing (opcional)
                    </label>
                    <textarea
                      value={formData.resendButtonMessage}
                      onChange={(e) => setFormData({ ...formData, resendButtonMessage: e.target.value })}
                      rows={3}
                      placeholder="Se preenchido, os botões serão enviados em uma mensagem separada com este texto. Se vazio, os botões aparecerão na legenda da imagem."
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Deixe vazio para usar os botões na legenda da imagem/vídeo
                    </p>
                  </div>
                  {resendButtonGroups.length === 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                      <label className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Botões de Pagamento de Reenvio (Compatibilidade)
                      </label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Se não adicionar grupos de botões, será usado este campo (compatibilidade).
                      </p>
                      <div className="space-y-2">
                        {resendPaymentButtons.map((btn, index) => (
                          <div key={index} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                            <input
                              type="text"
                              placeholder="Texto do botão (ex: Comprar Agora)"
                              value={btn.text}
                              onChange={(e) => updateResendPaymentButton(index, "text", e.target.value)}
                              className="flex-1 px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                            />
                            <div className="flex gap-2">
                              <PriceInput
                                value={btn.value}
                                onChange={(value) => updateResendPaymentButton(index, "value", value)}
                                placeholder="R$ 0,00"
                                className="flex-1 sm:w-32 px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => removeResendPaymentButton(index)}
                                className="shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addResendPaymentButton} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Botão de Pagamento
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tab: Avançado */}
          {activeTab === "advanced" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configurações Avançadas
                </CardTitle>
                <CardDescription>Configurações opcionais para integração e personalização</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Facebook Pixel ID
                    </label>
                    <input
                      type="text"
                      value={formData.facebookPixelId}
                      onChange={(e) => setFormData({ ...formData, facebookPixelId: e.target.value })}
                      placeholder="123456789012345"
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Para rastreamento de conversões</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Facebook Access Token
                    </label>
                    <input
                      type="text"
                      value={formData.facebookAccessToken}
                      onChange={(e) =>
                        setFormData({ ...formData, facebookAccessToken: e.target.value })
                      }
                      placeholder="Seu access token"
                      className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Para Conversions API</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Mensagem após Confirmação de Pagamento
                  </label>
                  <textarea
                    value={formData.paymentConfirmedMessage}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentConfirmedMessage: e.target.value })
                    }
                    rows={4}
                    placeholder="Digite a mensagem que será enviada após o pagamento ser confirmado..."
                    className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botões de ação fixos */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border p-3 sm:p-4 -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 px-3 sm:px-4 md:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-end gap-2 sm:gap-4">
              <Link href="/bots" className="w-full sm:w-auto">
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={createBot.isPending} className="w-full sm:w-auto min-w-[140px]">
                <Save className="h-4 w-4 mr-2" />
                {createBot.isPending ? "Criando..." : "Criar Bot"}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
