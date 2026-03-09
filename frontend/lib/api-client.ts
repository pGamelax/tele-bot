"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { authClient } from "./auth-client"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

/**
 * Função para fazer requisições autenticadas diretamente ao backend
 * NÃO usa rotas do Next.js (/api), faz fetch direto ao backend
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // Verificar se há sessão (opcional, mas ajuda a garantir que está autenticado)
  await authClient.getSession()
  
  const headers = new Headers(options.headers)
  
  // Só adicionar Content-Type se não for FormData
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  // Fazer requisição direta ao backend usando fetch
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
    credentials: "include", // Importante para enviar cookies de autenticação
  })

  return response
}

// Tipos
export interface Stats {
  totalBots: number
  activeBots: number
  totalUsers: number
  usersWhoPurchased: number
  totalPixGenerated: number
  totalPixPaid: number
  totalRevenue: number
  totalRevenueCents: number
  todayRevenue: number
  conversionRate: number
  revenueGrowth: number
  revenueByDay: Array<{ date: string; revenue: number }>
  accountHealth: string
  accountHealthPercentage: number
}

export interface Payment {
  id: string
  botId: string
  telegramChatId: string
  amount: number
  status: string
  createdAt: string
  paidAt: string | null
  pixCode: string | null
  bot?: {
    id: string
    name: string
  }
}

export interface Bot {
  id: string
  name: string
  telegramToken: string
  syncpayApiKey: string
  syncpayApiSecret: string
  startImage?: string | null
  startCaption?: string | null
  startButtonMessage?: string | null
  resendImage?: string | null
  resendCaption?: string | null
  resendButtonMessage?: string | null
  resendImages?: Array<{ id: string; imageUrl: string; order: number }>
  resendCaptions?: Array<{ id: string; captionText: string; order: number }>
  resendButtonGroups?: Array<{ id: string; buttons: string; order: number }>
  resendFirstDelay: number
  resendInterval: number
  isActive: boolean
  facebookPixelId?: string | null
  facebookAccessToken?: string | null
  paymentConfirmedMessage?: string | null
  paymentButtons: PaymentButton[]
  createdAt: string
  updatedAt: string
}

export interface PaymentButton {
  id: string
  text: string
  value: number
  type: string
}

export interface Lead {
  id: string
  botId: string
  telegramChatId: string
  telegramUsername?: string | null
  firstName?: string | null
  lastName?: string | null
  isNew: boolean
  notes?: string | null
  contactedAt?: string | null
  convertedAt?: string | null
  resendPaused?: boolean
  isBlocked?: boolean
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  createdAt: string
  updatedAt: string
  bot: {
    id: string
    name: string
  }
}

// Hooks para buscar dados
export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/bots/stats`)
      if (!response.ok) {
        throw new Error("Erro ao buscar estatísticas")
      }
      const data = await response.json()
      return data.stats as Stats
    },
    refetchInterval: 30000,
  })
}

export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/payments`)
      if (!response.ok) {
        throw new Error("Erro ao buscar pagamentos")
      }
      const data = await response.json()
      return data.payments as Payment[]
    },
    refetchInterval: 30000,
  })
}

export function useBots() {
  return useQuery({
    queryKey: ["bots"],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/bots`)
      if (!response.ok) {
        throw new Error("Erro ao buscar bots")
      }
      const data = await response.json()
      return data.bots as Bot[]
    },
  })
}

export function useBot(id: string) {
  return useQuery({
    queryKey: ["bot", id],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/bots/${id}`)
      if (!response.ok) {
        throw new Error("Erro ao buscar bot")
      }
      const data = await response.json()
      return data.bot as Bot
    },
    enabled: !!id,
  })
}

export function useLeads(botId?: string, isNew?: boolean) {
  return useQuery({
    queryKey: ["leads", botId, isNew],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (botId) params.append("botId", botId)
      if (isNew !== undefined) params.append("isNew", String(isNew))
      
      const response = await fetchWithAuth(`/api/leads?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Erro ao buscar leads")
      }
      const data = await response.json()
      return data.leads as Lead[]
    },
  })
}

// Mutations
interface BotInput {
  name?: string
  telegramToken?: string
  syncpayApiKey?: string
  syncpayApiSecret?: string
  startImage?: string | null
  startCaption?: string | null
  startButtonMessage?: string | null
  resendImage?: string | null
  resendCaption?: string | null
  resendButtonMessage?: string | null
  resendImages?: string[]
  resendCaptions?: string[]
  resendFirstDelay?: number
  resendInterval?: number
  isActive?: boolean
  facebookPixelId?: string | null
  facebookAccessToken?: string | null
  paymentConfirmedMessage?: string | null
  paymentButtons?: Array<{ text: string; value: number }>
  resendPaymentButtons?: Array<{ text: string; value: number }>
  resendButtonGroups?: Array<Array<{ text: string; value: number }>>
}

export function useCreateBot() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (botData: BotInput) => {
      const response = await fetchWithAuth(`/api/bots`, {
        method: "POST",
        body: JSON.stringify(botData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao criar bot")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })
}

export function useUpdateBot() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...botData }: BotInput & { id: string }) => {
      const response = await fetchWithAuth(`/api/bots/${id}`, {
        method: "PUT",
        body: JSON.stringify(botData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao atualizar bot")
      }
      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bots"] })
      queryClient.invalidateQueries({ queryKey: ["bot", variables.id] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })
}

export function useDeleteBot() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithAuth(`/api/bots/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao deletar bot")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...leadData }: Partial<Lead> & { id: string }) => {
      const response = await fetchWithAuth(`/api/leads/${id}`, {
        method: "PUT",
        body: JSON.stringify(leadData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao atualizar lead")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    },
  })
}

export function useDeleteLead() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithAuth(`/api/leads/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao deletar lead")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    },
  })
}

export function useToggleResend() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, paused }: { id: string; paused: boolean }) => {
      const response = await fetchWithAuth(`/api/leads/${id}/resend`, {
        method: "PATCH",
        body: JSON.stringify({ paused }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao atualizar status de reenvio")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    },
  })
}

// Manual Bot API
export interface ManualBot {
  id: string
  name: string
  telegramToken: string
  syncpayApiKey: string
  syncpayApiSecret: string
  startImage?: string | null
  startCaption?: string | null
  startButtonMessage?: string | null
  paymentConfirmedMessage?: string | null
  paymentButtons: PaymentButton[]
  createdAt: string
  updatedAt: string
}

export interface ManualBotBlockedLead {
  id: string
  botId: string
  telegramChatId: string
  telegramUsername?: string | null
  firstName?: string | null
  lastName?: string | null
  blockedAt: string
  createdAt: string
  updatedAt: string
}

export function useManualBot() {
  return useQuery({
    queryKey: ["manualBot"],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/manual-bot`)
      if (!response.ok) {
        throw new Error("Erro ao buscar bot manual")
      }
      const data = await response.json()
      return data.bot as ManualBot | null
    },
  })
}

export function useManualBotStats() {
  return useQuery({
    queryKey: ["manualBotStats"],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/manual-bot/stats`)
      if (!response.ok) {
        throw new Error("Erro ao buscar estatísticas do bot manual")
      }
      const data = await response.json()
      return { totalLeads: data.totalLeads ?? 0 } as { totalLeads: number }
    },
  })
}

export function useManualBotBlockedLeads() {
  return useQuery({
    queryKey: ["manualBotBlockedLeads"],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/manual-bot/blocked`)
      if (!response.ok) {
        throw new Error("Erro ao buscar leads bloqueados")
      }
      const data = await response.json()
      return data.blockedLeads as ManualBotBlockedLead[]
    },
  })
}

export function useCreateOrUpdateManualBot() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (botData: {
      name: string
      telegramToken: string
      syncpayApiKey: string
      syncpayApiSecret: string
      startImage?: string | null
      startCaption?: string | null
      startButtonMessage?: string | null
      paymentConfirmedMessage?: string | null
      paymentButtons?: Array<{ text: string; value: number }>
    }) => {
      const response = await fetchWithAuth(`/api/manual-bot`, {
        method: "POST",
        body: JSON.stringify(botData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao criar/atualizar bot manual")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manualBot"] })
    },
  })
}

export function useUpdateManualBotToken() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (telegramToken: string) => {
      const response = await fetchWithAuth(`/api/manual-bot/token`, {
        method: "PUT",
        body: JSON.stringify({ telegramToken }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao atualizar token")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manualBot"] })
    },
  })
}

export async function fetchManualBotSendStatus(jobId: string) {
  const response = await fetchWithAuth(`/api/manual-bot/send/status/${jobId}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Erro ao consultar status")
  }
  return response.json()
}

export function useSendManualBotMessages() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth(`/api/manual-bot/send`, {
        method: "POST",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao disparar mensagens")
      }
      const data = await response.json()
      // 202 = processamento em background, retorna jobId
      if (response.status === 202 && data.jobId) {
        return { jobId: data.jobId, status: "processing" }
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manualBotBlockedLeads"] })
    },
  })
}

export function useRemoveBlockedLead() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (chatId: string) => {
      const response = await fetchWithAuth(`/api/manual-bot/blocked/${chatId}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao remover lead bloqueado")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manualBotBlockedLeads"] })
    },
  })
}
