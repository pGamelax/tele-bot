"use client"

import { Bot } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function Loading({ className, size = "md" }: LoadingProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  }

  const iconSizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  }

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-screen bg-background", className)}>
      <div className="relative">
        {/* Spinner */}
        <div
          className={cn(
            "animate-spin rounded-full border-4 border-primary/20 border-t-primary",
            sizeClasses[size]
          )}
          style={{
            animationDuration: "1s",
          }}
        />
        {/* Logo do robô no centro */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Bot 
            className={cn(
              "text-primary",
              iconSizeClasses[size]
            )}
            style={{
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
        </div>
      </div>
    </div>
  )
}
