"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useBot, useUpdateBot } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Loading } from "@/components/ui/loading"
import {
  ArrowLeft, Plus, X, Save, Copy, Check, Bot as BotIcon, MessageSquare,
  Settings, DollarSign, Info, TrendingUp, ChevronRight, ChevronLeft,
  KeyRound, Image as ImageIcon, RefreshCw, Zap, Bell, Power,
} from "lucide-react"
import { ImageUpload } from "@/components/ui/image-upload"
import { MultipleImageUpload } from "@/components/ui/multiple-image-upload"
import { PriceInput } from "@/components/ui/price-input"

type TabId = "info" | "basic" | "start" | "resend" | "upsell" | "advanced"

const TABS: { id: TabId; label: string; icon: React.ElementType; description: string }[] = [
  { id: "info", label: "Informações", icon: Info, description: "ID e links" },
  { id: "basic", label: "Básico", icon: BotIcon, description: "Credenciais" },
  { id: "start", label: "Boas-vindas", icon: MessageSquare, description: "Primeira mensagem" },
  { id: "resend", label: "Remarketing", icon: RefreshCw, description: "Mensagens automáticas" },
  { id: "upsell", label: "Upsell", icon: TrendingUp, description: "Oferta pós-compra" },
  { id: "advanced", label: "Avançado", icon: Settings, description: "Integrações extras" },
]

function SectionHeader({ icon: Icon, title, description, color = "blue" }: {
  icon: React.ElementType; title: string; description?: string; color?: string
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    pink: "bg-pink-500/10 text-pink-500 border-pink-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
  }
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className={`p-2 rounded-lg border ${colors[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

function FieldGroup({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-4 space-y-4 ${className}`}>
      {children}
    </div>
  )
}

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>}
    </div>
  )
}

function inputCls() {
  return "w-full px-3 py-2.5 border border-input bg-background rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 transition-colors placeholder:text-muted-foreground/60"
}

function PaymentButtonEditor({
  buttons, onAdd, onRemove, onUpdate, addLabel = "Adicionar Botão",
}: {
  buttons: Array<{ text: string; value: number }>
  onAdd: () => void
  onRemove: (i: number) => void
  onUpdate: (i: number, field: string, value: string | number) => void
  addLabel?: string
}) {
  return (
    <div className="space-y-2">
      {buttons.map((btn, index) => (
        <div key={index} className="flex items-center gap-2 bg-background border border-border rounded-lg p-2.5">
          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{index + 1}</span>
          </div>
          <input
            type="text"
            placeholder="Texto do botão (ex: Comprar Agora)"
            value={btn.text}
            onChange={(e) => onUpdate(index, "text", e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60"
          />
          <div className="shrink-0">
            <PriceInput
              value={btn.value}
              onChange={(v) => onUpdate(index, "value", v)}
              placeholder="R$ 0,00"
              className="w-28 px-2 py-1.5 border border-input bg-card rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {buttons.length > 0 && (
        <div className="bg-muted/30 border border-dashed border-border rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground text-center mb-2 font-medium">Pré-visualização no Telegram</p>
          <div className="flex flex-wrap gap-1 justify-center">
            {buttons.map((btn, i) => (
              <div key={i} className="bg-primary/10 border border-primary/20 text-primary text-xs px-3 py-1.5 rounded-full font-medium">
                R$ {btn.value > 0 ? (btn.value / 100).toFixed(2).replace(".", ",") : "0,00"} — {btn.text || "..."}
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  )
}

function BotInfoSection({ botId }: { botId: string }) {
  const { toast } = useToast()
  const [copiedId, setCopiedId] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  const trackingLink = `${API_URL}/api/tracking/${botId}/redirect`

  const copy = async (text: string, type: "id" | "link") => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === "id") { setCopiedId(true); setTimeout(() => setCopiedId(false), 2000) }
      else { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000) }
      toast({ title: type === "id" ? "ID copiado!" : "Link copiado!" })
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <FieldGroup>
        <SectionHeader icon={Info} title="ID do Bot" description="Identificador único do bot no sistema" color="blue" />
        <div className="flex gap-2">
          <input type="text" value={botId} readOnly
            className="flex-1 px-3 py-2.5 border border-input bg-background rounded-lg text-sm font-mono text-muted-foreground" />
          <Button type="button" variant="outline" size="sm" onClick={() => copy(botId, "id")} className="shrink-0 gap-1.5">
            {copiedId ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            <span className="hidden sm:inline">Copiar</span>
          </Button>
        </div>
      </FieldGroup>

      <FieldGroup>
        <SectionHeader icon={Settings} title="Link de Tracking" description="Use nos seus anúncios do Facebook Ads" color="purple" />
        <div className="flex gap-2">
          <input type="text" value={trackingLink} readOnly
            className="flex-1 px-3 py-2.5 border border-input bg-background rounded-lg text-xs font-mono text-muted-foreground truncate" />
          <Button type="button" size="sm" onClick={() => copy(trackingLink, "link")} className="shrink-0 gap-1.5">
            {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="hidden sm:inline">Copiar</span>
          </Button>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-500">Como usar nos anúncios</p>
          <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
            <li>• Cole este link no campo <span className="font-semibold text-foreground">"URL do site"</span> dos seus anúncios</li>
            <li>• O Facebook adicionará o <span className="font-semibold text-foreground">fbclid</span> automaticamente ao clique</li>
            <li>• Opcional: adicione parâmetros UTM para rastrear campanhas específicas</li>
          </ul>
        </div>
      </FieldGroup>
    </div>
  )
}

export default function EditBotPage() {
  const router = useRouter()
  const params = useParams()
  const botId = params.id as string
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
    startButtonMessage: "",
    resendImage: "",
    resendCaption: "",
    resendButtonMessage: "",
    resendFirstDelay: 20,
    resendInterval: 10,
    isActive: true,
    facebookPixelId: "",
    facebookAccessToken: "",
    paymentConfirmedMessage: "",
    upsellImage: "",
    upsellMessage: "",
    upsellButtonText: "",
    upsellButtonValue: 0,
    pixRecoveryEnabled: true,
    pixRecoveryMessage: "",
    pixRecoveryDelayMinutes: 10,
  })

  const [resendImages, setResendImages] = useState<string[]>([])
  const [resendCaptions, setResendCaptions] = useState<string[]>([])
  const [paymentButtons, setPaymentButtons] = useState<Array<{ text: string; value: number }>>([])
  const [resendPaymentButtons, setResendPaymentButtons] = useState<Array<{ text: string; value: number }>>([])
  const [resendButtonGroups, setResendButtonGroups] = useState<Array<Array<{ text: string; value: number }>>>([])
  const [activeTab, setActiveTab] = useState<TabId>("info")

  useEffect(() => {
    if (bot) {
      setFormData({
        name: bot.name,
        telegramToken: bot.telegramToken,
        syncpayApiKey: bot.syncpayApiKey,
        syncpayApiSecret: bot.syncpayApiSecret,
        startImage: bot.startImage || "",
        startCaption: bot.startCaption || "",
        startButtonMessage: bot.startButtonMessage || "",
        resendImage: bot.resendImage || "",
        resendCaption: bot.resendCaption || "",
        resendButtonMessage: bot.resendButtonMessage || "",
        resendFirstDelay: bot.resendFirstDelay,
        resendInterval: bot.resendInterval,
        isActive: bot.isActive,
        facebookPixelId: bot.facebookPixelId || "",
        facebookAccessToken: bot.facebookAccessToken || "",
        paymentConfirmedMessage: bot.paymentConfirmedMessage || "",
        upsellImage: (bot as any).upsellImage || "",
        upsellMessage: (bot as any).upsellMessage || "",
        upsellButtonText: (bot as any).upsellButtonText || "",
        upsellButtonValue: (bot as any).upsellButtonValue ?? 0,
        pixRecoveryEnabled: (bot as any).pixRecoveryEnabled ?? true,
        pixRecoveryMessage: (bot as any).pixRecoveryMessage || "",
        pixRecoveryDelayMinutes: (bot as any).pixRecoveryDelayMinutes ?? 10,
      })
      setPaymentButtons(bot.paymentButtons.filter((b) => b.type === "start").map((b) => ({ text: b.text, value: b.value })))
      setResendPaymentButtons(bot.paymentButtons.filter((b) => b.type === "resend").map((b) => ({ text: b.text, value: b.value })))
      setResendImages(bot.resendImages?.map((img) => img.imageUrl) || [])
      setResendCaptions((bot as any).resendCaptions?.map((cap: any) => cap.captionText) || [])
      const buttonGroups = (bot as any).resendButtonGroups?.map((group: any) => {
        try { return JSON.parse(group.buttons) } catch { return [] }
      }) || []
      setResendButtonGroups(buttonGroups)
    }
  }, [bot])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateBot.mutateAsync({
        id: botId,
        ...formData,
        upsellImage: formData.upsellImage || undefined,
        upsellButtonValue: formData.upsellButtonValue || undefined,
        resendImages,
        resendCaptions,
        paymentButtons,
        resendPaymentButtons,
        resendButtonGroups,
      })
      toast({ title: "Bot atualizado com sucesso!" })
      router.push("/bots")
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" })
    }
  }

  // Payment button helpers
  const addPaymentButton = () => setPaymentButtons([...paymentButtons, { text: "", value: 0 }])
  const removePaymentButton = (i: number) => setPaymentButtons(paymentButtons.filter((_, j) => j !== i))
  const updatePaymentButton = (i: number, f: string, v: string | number) => {
    const u = [...paymentButtons]; u[i] = { ...u[i], [f]: v }; setPaymentButtons(u)
  }
  const addResendPaymentButton = () => setResendPaymentButtons([...resendPaymentButtons, { text: "", value: 0 }])
  const removeResendPaymentButton = (i: number) => setResendPaymentButtons(resendPaymentButtons.filter((_, j) => j !== i))
  const updateResendPaymentButton = (i: number, f: string, v: string | number) => {
    const u = [...resendPaymentButtons]; u[i] = { ...u[i], [f]: v }; setResendPaymentButtons(u)
  }
  const addResendCaption = () => setResendCaptions([...resendCaptions, ""])
  const removeResendCaption = (i: number) => setResendCaptions(resendCaptions.filter((_, j) => j !== i))
  const updateResendCaption = (i: number, v: string) => { const u = [...resendCaptions]; u[i] = v; setResendCaptions(u) }
  const addResendButtonGroup = () => setResendButtonGroups([...resendButtonGroups, []])
  const removeResendButtonGroup = (gi: number) => setResendButtonGroups(resendButtonGroups.filter((_, i) => i !== gi))
  const addButtonToGroup = (gi: number) => { const u = [...resendButtonGroups]; u[gi] = [...u[gi], { text: "", value: 0 }]; setResendButtonGroups(u) }
  const removeButtonFromGroup = (gi: number, bi: number) => { const u = [...resendButtonGroups]; u[gi] = u[gi].filter((_, i) => i !== bi); setResendButtonGroups(u) }
  const updateButtonInGroup = (gi: number, bi: number, f: string, v: string | number) => {
    const u = [...resendButtonGroups]; u[gi][bi] = { ...u[gi][bi], [f]: v }; setResendButtonGroups(u)
  }

  if (isLoading) return <Loading />
  if (!bot) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Bot não encontrado</p>
    </div>
  )

  const tabIndex = TABS.findIndex((t) => t.id === activeTab)
  const goNext = () => tabIndex < TABS.length - 1 && setActiveTab(TABS[tabIndex + 1].id)
  const goPrev = () => tabIndex > 0 && setActiveTab(TABS[tabIndex - 1].id)

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-6 h-14 flex items-center gap-4">
          <Link href="/bots" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-foreground truncate">{bot.name}</h1>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                formData.isActive ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"
              }`}>
                {formData.isActive ? "Ativo" : "Inativo"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Editar configurações do bot</p>
          </div>
          <Button type="submit" form="bot-form" disabled={updateBot.isPending} size="sm" className="shrink-0 gap-2">
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{updateBot.isPending ? "Salvando..." : "Salvar"}</span>
          </Button>
        </div>
      </header>

      {/* Step Navigation */}
      <div className="border-b border-border bg-card/30 sticky top-14 z-10">
        <div className="px-6">
          <nav className="flex overflow-x-auto scrollbar-hide">
            {TABS.map((tab, i) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              const isDone = i < tabIndex
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 shrink-0 transition-all -mb-px ${
                    isActive ? "border-primary text-primary"
                      : isDone ? "border-transparent text-muted-foreground/70 hover:text-foreground hover:border-border"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}
                  </span>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      <main className="px-6 py-6 max-w-3xl">
        <form id="bot-form" onSubmit={handleSubmit}>

          {/* ─── INFORMAÇÕES ─── */}
          {activeTab === "info" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Informações do Bot</h2>
                <p className="text-sm text-muted-foreground mt-1">ID e links de rastreamento</p>
              </div>
              <BotInfoSection botId={botId} />
            </div>
          )}

          {/* ─── BÁSICO ─── */}
          {activeTab === "basic" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Informações Básicas</h2>
                <p className="text-sm text-muted-foreground mt-1">Nome, credenciais e status do bot</p>
              </div>

              <FieldGroup>
                <SectionHeader icon={Power} title="Status do Bot" color="red" />
                <div className={`flex items-center justify-between p-3 rounded-lg border ${
                  formData.isActive ? "border-green-500/30 bg-green-500/5" : "border-border bg-muted/30"
                }`}>
                  <div>
                    <p className="text-sm font-medium text-foreground">Bot {formData.isActive ? "Ativo" : "Inativo"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formData.isActive ? "Processando mensagens e pagamentos" : "Bot pausado, não enviará mensagens"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isActive ? "bg-green-500" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      formData.isActive ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>
              </FieldGroup>

              <FieldGroup>
                <SectionHeader icon={BotIcon} title="Identidade do Bot" description="Como este bot será identificado no painel" color="blue" />
                <Field label="Nome do Bot" required>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Bot Vendas - Produto X" className={inputCls()} />
                </Field>
                <Field label="Token do Telegram" required hint="Obtido no @BotFather. Mantenha em segredo!">
                  <input type="text" required value={formData.telegramToken} onChange={(e) => setFormData({ ...formData, telegramToken: e.target.value })}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" className={`${inputCls()} font-mono text-sm`} />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <SectionHeader icon={KeyRound} title="Credenciais de Pagamento" description="Chaves da API SyncPay para processar PIX" color="green" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="API Key" required>
                    <input type="text" required value={formData.syncpayApiKey} onChange={(e) => setFormData({ ...formData, syncpayApiKey: e.target.value })}
                      placeholder="Sua API Key" className={inputCls()} />
                  </Field>
                  <Field label="API Secret" required>
                    <input type="text" required value={formData.syncpayApiSecret} onChange={(e) => setFormData({ ...formData, syncpayApiSecret: e.target.value })}
                      placeholder="Sua API Secret" className={inputCls()} />
                  </Field>
                </div>
              </FieldGroup>
            </div>
          )}

          {/* ─── MENSAGEM INICIAL ─── */}
          {activeTab === "start" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Mensagem de Boas-vindas</h2>
                <p className="text-sm text-muted-foreground mt-1">Enviada quando o usuário digita /start no bot</p>
              </div>

              <FieldGroup>
                <SectionHeader icon={ImageIcon} title="Mídia" description="Imagem ou vídeo que aparece com a mensagem" color="purple" />
                <ImageUpload label="Imagem ou Vídeo" value={formData.startImage} onChange={(url) => setFormData({ ...formData, startImage: url })} maxSizeMB={50} />
                <Field label="URL da Mídia (alternativo)" hint="Ou cole diretamente a URL da imagem/vídeo">
                  <input type="text" value={formData.startImage} onChange={(e) => setFormData({ ...formData, startImage: e.target.value })}
                    placeholder="https://..." className={inputCls()} />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <SectionHeader icon={MessageSquare} title="Texto" description="Mensagem exibida junto com a mídia" color="blue" />
                <Field label="Legenda da Mensagem">
                  <textarea value={formData.startCaption} onChange={(e) => setFormData({ ...formData, startCaption: e.target.value })}
                    rows={4} placeholder="Digite a mensagem de boas-vindas..." className={`${inputCls()} resize-none`} />
                </Field>
                <Field label="Texto dos Botões (opcional)" hint="Se preenchido, os botões são enviados em mensagem separada. Deixe vazio para exibi-los na legenda.">
                  <textarea value={formData.startButtonMessage} onChange={(e) => setFormData({ ...formData, startButtonMessage: e.target.value })}
                    rows={2} placeholder="Ex: Escolha uma opção abaixo 👇" className={`${inputCls()} resize-none`} />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <SectionHeader icon={DollarSign} title="Botões de Pagamento" description="Opções de compra exibidas para o usuário" color="green" />
                <PaymentButtonEditor
                  buttons={paymentButtons}
                  onAdd={addPaymentButton}
                  onRemove={removePaymentButton}
                  onUpdate={updatePaymentButton}
                  addLabel="Adicionar opção de pagamento"
                />
              </FieldGroup>
            </div>
          )}

          {/* ─── REMARKETING ─── */}
          {activeTab === "resend" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Mensagens de Remarketing</h2>
                <p className="text-sm text-muted-foreground mt-1">Mensagens automáticas para usuários que não compraram</p>
              </div>

              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Como funciona a rotação</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Adicione múltiplas imagens, textos e grupos de botões. O sistema alternará automaticamente:
                    imagem 1 + texto 1 + botões 1 no 1º reenvio, imagem 2 + texto 2 + botões 2 no 2º, e assim por diante.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldGroup>
                  <Field label="Primeiro Reenvio" hint="Minutos após o usuário não pagar">
                    <div className="flex items-center gap-2">
                      <input type="number" min="1" value={formData.resendFirstDelay}
                        onChange={(e) => setFormData({ ...formData, resendFirstDelay: parseInt(e.target.value) || 20 })}
                        className={`${inputCls()} w-24`} />
                      <span className="text-sm text-muted-foreground">minutos</span>
                    </div>
                  </Field>
                </FieldGroup>
                <FieldGroup>
                  <Field label="Intervalo entre Reenvios" hint="Tempo entre cada reenvio subsequente">
                    <div className="flex items-center gap-2">
                      <input type="number" min="1" value={formData.resendInterval}
                        onChange={(e) => setFormData({ ...formData, resendInterval: parseInt(e.target.value) || 10 })}
                        className={`${inputCls()} w-24`} />
                      <span className="text-sm text-muted-foreground">minutos</span>
                    </div>
                  </Field>
                </FieldGroup>
              </div>

              <FieldGroup>
                <SectionHeader icon={ImageIcon} title="Imagens / Vídeos" description="Serão rotacionados a cada reenvio" color="purple" />
                <MultipleImageUpload images={resendImages} onChange={setResendImages} label="" />
              </FieldGroup>

              <FieldGroup>
                <SectionHeader icon={MessageSquare} title="Textos de Remarketing" description="Serão rotacionados a cada reenvio" color="blue" />
                <div className="space-y-3">
                  {resendCaptions.map((caption, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-2.5">{i + 1}</span>
                      <textarea value={caption} onChange={(e) => updateResendCaption(i, e.target.value)}
                        rows={3} placeholder={`Texto ${i + 1}...`}
                        className={`${inputCls()} resize-none flex-1`} />
                      <button type="button" onClick={() => removeResendCaption(i)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-1.5 shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addResendCaption}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                    <Plus className="h-4 w-4" /> Adicionar Texto
                  </button>
                </div>
              </FieldGroup>

              <FieldGroup>
                <SectionHeader icon={DollarSign} title="Grupos de Botões" description="Grupos rotacionados a cada reenvio" color="green" />
                <div className="space-y-4">
                  {resendButtonGroups.map((group, gi) => (
                    <div key={gi} className="border border-border rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
                        <span className="text-sm font-semibold text-foreground">Grupo {gi + 1}</span>
                        <button type="button" onClick={() => removeResendButtonGroup(gi)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="p-3">
                        <PaymentButtonEditor
                          buttons={group}
                          onAdd={() => addButtonToGroup(gi)}
                          onRemove={(bi) => removeButtonFromGroup(gi, bi)}
                          onUpdate={(bi, f, v) => updateButtonInGroup(gi, bi, f, v)}
                          addLabel="Adicionar botão ao grupo"
                        />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addResendButtonGroup}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                    <Plus className="h-4 w-4" /> Adicionar Grupo de Botões
                  </button>
                </div>
                {resendButtonGroups.length === 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-3">Sem grupos de rotação? Use botões únicos para todos os reenvios:</p>
                    <PaymentButtonEditor
                      buttons={resendPaymentButtons}
                      onAdd={addResendPaymentButton}
                      onRemove={removeResendPaymentButton}
                      onUpdate={updateResendPaymentButton}
                      addLabel="Adicionar botão de reenvio"
                    />
                  </div>
                )}
                <Field label="Texto dos Botões de Remarketing (opcional)" hint="Deixe vazio para usar os botões na legenda da imagem">
                  <textarea value={formData.resendButtonMessage} onChange={(e) => setFormData({ ...formData, resendButtonMessage: e.target.value })}
                    rows={2} placeholder="Ex: Aproveite! Acesso por tempo limitado 🔥"
                    className={`${inputCls()} resize-none`} />
                </Field>
              </FieldGroup>
            </div>
          )}

          {/* ─── UPSELL ─── */}
          {activeTab === "upsell" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Upsell — Oferta Pós-compra</h2>
                <p className="text-sm text-muted-foreground mt-1">Mensagem enviada automaticamente após a confirmação do pagamento</p>
              </div>

              <FieldGroup>
                <SectionHeader icon={ImageIcon} title="Mídia do Upsell" color="pink" />
                <ImageUpload label="Imagem ou Vídeo" value={formData.upsellImage} onChange={(url) => setFormData({ ...formData, upsellImage: url })} maxSizeMB={50} />
                <Field label="URL da Mídia (alternativo)">
                  <input type="text" value={formData.upsellImage} onChange={(e) => setFormData({ ...formData, upsellImage: e.target.value })}
                    placeholder="https://..." className={inputCls()} />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <SectionHeader icon={MessageSquare} title="Mensagem e Botão" color="orange" />
                <Field label="Mensagem de Upsell" hint="Use {amount} para mostrar o valor da compra anterior">
                  <textarea value={formData.upsellMessage} onChange={(e) => setFormData({ ...formData, upsellMessage: e.target.value })}
                    rows={4} placeholder="Ex: 🎁 Aproveite! Adicione o bônus exclusivo por apenas R$ 29,90!"
                    className={`${inputCls()} resize-none`} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Texto do Botão (opcional)">
                    <input type="text" value={formData.upsellButtonText} onChange={(e) => setFormData({ ...formData, upsellButtonText: e.target.value })}
                      placeholder="Quero aproveitar!" className={inputCls()} />
                  </Field>
                  <Field label="Valor do Upsell" hint="Deixe zerado se não houver botão de pagamento">
                    <PriceInput value={formData.upsellButtonValue} onChange={(v) => setFormData({ ...formData, upsellButtonValue: v })}
                      className={inputCls()} />
                  </Field>
                </div>
              </FieldGroup>
            </div>
          )}

          {/* ─── AVANÇADO ─── */}
          {activeTab === "advanced" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Configurações Avançadas</h2>
                <p className="text-sm text-muted-foreground mt-1">Integrações e personalizações opcionais</p>
              </div>

              <FieldGroup>
                <SectionHeader icon={MessageSquare} title="Mensagem de Confirmação" description="Enviada após o pagamento ser confirmado" color="blue" />
                <Field label="Mensagem" hint="Use {amount} para o valor pago. Ex: ✅ Obrigado! Sua compra de R$ {amount} foi confirmada.">
                  <textarea value={formData.paymentConfirmedMessage} onChange={(e) => setFormData({ ...formData, paymentConfirmedMessage: e.target.value })}
                    rows={4} placeholder="✅ Pagamento confirmado! Obrigado pela compra."
                    className={`${inputCls()} resize-none`} />
                </Field>
              </FieldGroup>

              <FieldGroup>
                <SectionHeader icon={Bell} title="Recuperação de PIX" description="Lembrete automático para quem gerou PIX mas não pagou" color="orange" />
                <div className={`flex items-center justify-between p-3 rounded-lg border ${
                  formData.pixRecoveryEnabled ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-muted/30"
                }`}>
                  <div>
                    <p className="text-sm font-medium text-foreground">Recuperação de PIX {formData.pixRecoveryEnabled ? "ativada" : "desativada"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Envia lembrete para quem gerou PIX e não pagou</p>
                  </div>
                  <button type="button" onClick={() => setFormData({ ...formData, pixRecoveryEnabled: !formData.pixRecoveryEnabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.pixRecoveryEnabled ? "bg-orange-500" : "bg-muted-foreground/30"
                    }`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      formData.pixRecoveryEnabled ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>
                {formData.pixRecoveryEnabled && (
                  <>
                    <Field label="Enviar lembrete após" hint="Minutos após a geração do PIX sem pagamento">
                      <div className="flex items-center gap-2">
                        <input type="number" min={5} max={60} value={formData.pixRecoveryDelayMinutes}
                          onChange={(e) => setFormData({ ...formData, pixRecoveryDelayMinutes: parseInt(e.target.value) || 10 })}
                          className={`${inputCls()} w-24`} />
                        <span className="text-sm text-muted-foreground">minutos</span>
                      </div>
                    </Field>
                    <Field label="Mensagem do Lembrete" hint="Use {amount} e {pixCode} para personalizar">
                      <textarea value={formData.pixRecoveryMessage} onChange={(e) => setFormData({ ...formData, pixRecoveryMessage: e.target.value })}
                        rows={3} placeholder="⏰ Seu PIX de R$ {amount} ainda está válido! Código: {pixCode}"
                        className={`${inputCls()} resize-none`} />
                    </Field>
                  </>
                )}
              </FieldGroup>

              <FieldGroup>
                <SectionHeader icon={Settings} title="Facebook Conversions API" description="Rastreamento avançado de conversões" color="blue" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Pixel ID" hint="Para rastreamento de eventos">
                    <input type="text" value={formData.facebookPixelId} onChange={(e) => setFormData({ ...formData, facebookPixelId: e.target.value })}
                      placeholder="123456789012345" className={inputCls()} />
                  </Field>
                  <Field label="Access Token" hint="Para Conversions API (server-side)">
                    <input type="text" value={formData.facebookAccessToken} onChange={(e) => setFormData({ ...formData, facebookAccessToken: e.target.value })}
                      placeholder="Seu access token" className={inputCls()} />
                  </Field>
                </div>
              </FieldGroup>
            </div>
          )}

          {/* ─── Bottom Navigation ─── */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border mt-8 -mx-6 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <Link href="/bots">
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                  Cancelar
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                {tabIndex > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={goPrev} className="gap-1.5">
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                )}
                {tabIndex < TABS.length - 1 ? (
                  <Button type="button" size="sm" onClick={goNext} className="gap-1.5">
                    Próximo <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={updateBot.isPending} size="sm" className="gap-1.5 min-w-[130px]">
                    <Save className="h-4 w-4" />
                    {updateBot.isPending ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                )}
              </div>
            </div>
          </div>

        </form>
      </main>
    </div>
  )
}
