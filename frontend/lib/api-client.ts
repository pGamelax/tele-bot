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
  amount: number
  status: string
  createdAt: string
  paidAt: string | null
  pixCode: string | null
}

export interface Bot {
  id: string
  name: string
  telegramToken: string
  syncpayApiKey: string
  syncpayApiSecret: string
  startImage?: string | null
  startCaption?: string | null
  resendImage?: string | null
  resendCaption?: string | null
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
  resendImage?: string | null
  resendCaption?: string | null
  resendFirstDelay?: number
  resendInterval?: number
  isActive?: boolean
  facebookPixelId?: string | null
  facebookAccessToken?: string | null
  paymentConfirmedMessage?: string | null
  paymentButtons?: Array<{ text: string; value: number }>
  resendPaymentButtons?: Array<{ text: string; value: number }>
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
