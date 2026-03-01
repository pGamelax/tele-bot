// Better Auth é configurado no backend
// Este arquivo é apenas para tipos
export type Session = {
  user: {
    id: string
    email: string
    name?: string | null
  }
  session: {
    id: string
    token: string
    expiresAt: Date
  }
}
