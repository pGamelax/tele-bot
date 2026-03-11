"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Sidebar } from "@/components/layout/sidebar"
import { Loading } from "@/components/ui/loading"

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in")
    }
  }, [session, isPending, router])

  if (isPending) return <Loading />
  if (!session)  return null

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/*
        Desktop: shift right by sidebar width (md:ml-56)
        Mobile: add bottom padding so content clears the fixed tab bar (pb-20)
      */}
      <div className="md:ml-56 min-h-screen flex flex-col pb-20 md:pb-0">
        {children}
      </div>
    </div>
  )
}
