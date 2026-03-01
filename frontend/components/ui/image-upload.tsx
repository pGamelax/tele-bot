"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "./button"
import { useToast } from "./use-toast"
import { Upload, X, Image as ImageIcon, Video, Loader2 } from "lucide-react"
import { fetchWithAuth } from "@/lib/api-client"

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  label?: string
  accept?: string
  maxSizeMB?: number
}

export function ImageUpload({
  value,
  onChange,
  label = "Upload de Imagem/Video",
  accept = "image/*,video/*",
  maxSizeMB = 50,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(value || null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Atualizar preview quando o value mudar (ex: ao carregar bot para edição)
  useEffect(() => {
    if (value) {
      setPreview(value)
    } else {
      setPreview(null)
    }
  }, [value])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tamanho
    const maxSize = maxSizeMB * 1024 * 1024
    if (file.size > maxSize) {
      toast({
        title: "Erro",
        description: `Arquivo muito grande. Máximo: ${maxSizeMB}MB`,
        variant: "destructive",
      })
      return
    }

    // Criar preview
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)

    // Fazer upload
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      // Usar fetchWithAuth para fazer upload direto ao backend
      const response = await fetchWithAuth(`/api/upload/media`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao fazer upload")
      }

      const data = await response.json()
      onChange(data.url)
      
      // Limpar preview temporário e usar a URL real
      URL.revokeObjectURL(previewUrl)
      setPreview(data.url)

      toast({
        title: "Sucesso",
        description: "Arquivo enviado com sucesso",
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao fazer upload",
        variant: "destructive",
      })
      setPreview(null)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemove = () => {
    onChange("")
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Detectar se é imagem ou vídeo baseado na URL
  const isImage = preview && (
    preview.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) || 
    preview.includes("/image") ||
    preview.match(/image\//i)
  )
  const isVideo = preview && (
    preview.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv)$/i) || 
    preview.includes("/video") ||
    preview.match(/video\//i)
  )

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      
      {preview ? (
        <div className="relative border border-border rounded-xl p-4 bg-card">
          {isImage ? (
            <img
              src={preview}
              alt="Preview"
              className="max-w-full max-h-64 mx-auto rounded-md object-contain"
            />
          ) : isVideo ? (
            <video
              src={preview}
              controls
              className="max-w-full max-h-64 mx-auto rounded-md"
            />
          ) : (
            // Se não conseguir detectar, tentar ambos
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="max-w-full max-h-64 mx-auto rounded-md object-contain"
                onError={(e) => {
                  // Se falhar como imagem, tentar como vídeo
                  const img = e.currentTarget
                  const video = document.createElement("video")
                  video.src = preview
                  video.controls = true
                  video.className = "max-w-full max-h-64 mx-auto rounded-md"
                  img.parentElement?.replaceChild(video, img)
                }}
              />
            </div>
          )}
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-muted-foreground truncate flex-1 mr-2">
              {preview}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary cursor-pointer transition-colors bg-card"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
          />
          {isUploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">Enviando...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Clique para fazer upload de imagem ou vídeo
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Máximo: {maxSizeMB}MB
              </p>
            </div>
          )}
        </div>
      )}

      {!preview && !isUploading && (
        <div className="text-xs text-muted-foreground">
          Ou cole a URL diretamente no campo abaixo
        </div>
      )}
    </div>
  )
}
