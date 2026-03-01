"use client"

import { useState, useEffect } from "react"

interface PriceInputProps {
  value: number // valor em centavos
  onChange: (value: number) => void
  placeholder?: string
  className?: string
}

export function PriceInput({ value, onChange, placeholder = "R$ 0,00", className }: PriceInputProps) {
  const [displayValue, setDisplayValue] = useState("")

  // Converter centavos para formato de exibição (R$)
  useEffect(() => {
    if (value === 0 || value === undefined || value === null) {
      setDisplayValue("")
    } else {
      const reais = value / 100
      setDisplayValue(formatCurrency(reais))
    }
  }, [value])

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const parseCurrency = (value: string): number => {
    // Remover tudo exceto números
    const numbers = value.replace(/\D/g, "")
    // Converter para centavos
    return numbers ? parseInt(numbers) : 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    
    // Se estiver vazio, limpar
    if (inputValue === "" || inputValue === "R$") {
      setDisplayValue("")
      onChange(0)
      return
    }

    // Remover formatação e converter para centavos
    const cents = parseCurrency(inputValue)
    
    // Atualizar o valor
    onChange(cents)

    // Formatar para exibição apenas se houver valor
    if (cents > 0) {
      const reais = cents / 100
      setDisplayValue(formatCurrency(reais))
    } else {
      setDisplayValue("")
    }
  }

  const handleBlur = () => {
    // Garantir formatação correta ao perder o foco
    if (value > 0) {
      const reais = value / 100
      setDisplayValue(formatCurrency(reais))
    } else {
      setDisplayValue("")
    }
  }

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className || "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"}
    />
  )
}
