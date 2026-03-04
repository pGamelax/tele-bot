"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Navbar } from "@/components/layout/navbar"
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

  if (isPending) {
    return <Loading />
  }

  if (!session) {
    return null
  }

  return (
    <>
      <Navbar />
      {children}
    </>
  )
}
