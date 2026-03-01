"use client"

import { createAuthClient } from "better-auth/react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

export const authClient = createAuthClient({
  // Fazer requisições diretas ao backend
  baseURL: API_URL,
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include",
  },
})
