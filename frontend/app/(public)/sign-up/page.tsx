"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Bot } from "lucide-react"

export default function SignUpPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = authClient.useSession()

  useEffect(() => {
    if (session) {
      router.push("/dashboard")
    }
  }, [session, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validações
    if (!name || name.trim() === "") {
      toast({
        title: "Erro",
        description: "O nome é obrigatório",
        variant: "destructive",
      })
      return
    }

    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name: name.trim(),
      })

      if (result.error) {
        console.error("Erro ao criar conta:", result.error)
        let errorMessage = result.error.message || result.error.code || "Erro ao criar conta"
        
        // Traduzir mensagens de erro comuns
        if (errorMessage.toLowerCase().includes("email") && errorMessage.toLowerCase().includes("already") || 
            errorMessage.toLowerCase().includes("já existe") ||
            errorMessage.toLowerCase().includes("unique") ||
            errorMessage.toLowerCase().includes("duplicate")) {
          errorMessage = "Este email já está cadastrado. Tente fazer login ou use outro email."
        } else if (errorMessage.toLowerCase().includes("invalid email") || 
                   errorMessage.toLowerCase().includes("email inválido")) {
          errorMessage = "Por favor, insira um email válido."
        } else if (errorMessage.toLowerCase().includes("provideraccountid") ||
                   errorMessage.toLowerCase().includes("constraint") ||
                   errorMessage.toLowerCase().includes("unique constraint")) {
          errorMessage = "Erro ao criar conta. Por favor, tente novamente ou entre em contato com o suporte."
        }
        
        toast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive",
        })
        setIsLoading(false)
      } else {
        toast({
          title: "Sucesso",
          description: "Conta criada com sucesso! Redirecionando...",
        })
        await authClient.getSession()
        await new Promise((resolve) => setTimeout(resolve, 100))
        window.location.href = "/dashboard"
      }
    } catch (error: any) {
      console.error("Erro ao criar conta (catch):", error)
      let errorMessage = "Erro ao criar conta. Por favor, tente novamente."
      
      // Verificar se é um erro HTTP
      if (error.status === 500) {
        errorMessage = "Erro interno do servidor. Por favor, tente novamente mais tarde ou entre em contato com o suporte."
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex flex-col items-center gap-2 mb-8">
          <Bot className="h-16 w-16 text-primary" />
          <span className="text-xl font-bold">
            <span className="text-purple-500">TELE</span>
            <span className="text-foreground">BOT</span>
          </span>
        </Link>
        
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Criar Conta</CardTitle>
            <CardDescription className="text-center">
              Crie sua conta para começar a usar o Tele Bot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Senha
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                  placeholder="••••••••"
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mínimo de 6 caracteres
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50"
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Criando conta..." : "Criar Conta"}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Já tem uma conta?{" "}
                <Link href="/sign-in" className="text-primary hover:underline">
                  Entrar
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
