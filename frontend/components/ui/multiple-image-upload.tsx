"use client"

import { useState, useRef } from "react"
import { Button } from "./button"
import { useToast } from "./use-toast"
import { Upload, X, Image as ImageIcon, Video, Loader2, GripVertical, Plus, ExternalLink } from "lucide-react"
import { uploadToCloudinary } from "@/lib/cloudinary"

interface MultipleImageUploadProps {
  images: string[]
  onChange: (images: string[]) => void
  label?: string
  accept?: string
  maxSizeMB?: number
}

export function MultipleImageUpload({
  images = [],
  onChange,
  label = "Imagens/Vídeos de Remarketing",
  accept = "image/*,video/*",
  maxSizeMB = 50,
}: MultipleImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Validar tamanho
    const maxSize = maxSizeMB * 1024 * 1024
    const invalidFiles = files.filter((file) => file.size > maxSize)
    if (invalidFiles.length > 0) {
      toast({
        title: "Erro",
        description: `Alguns arquivos são muito grandes. Máximo: ${maxSizeMB}MB`,
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    try {
      const uploadPromises = files.map((file) => uploadToCloudinary(file))
      const results = await Promise.all(uploadPromises)
      const newUrls = results.map((result) => result.secure_url)
      onChange([...images, ...newUrls])
      toast({
        title: "Sucesso",
        description: `${files.length} arquivo(s) enviado(s) com sucesso`,
      })
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao fazer upload",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemove = (index: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const newImages = images.filter((_, i) => i !== index)
    onChange(newImages)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null) return

    if (draggedIndex !== index) {
      const newImages = [...images]
      const draggedItem = newImages[draggedIndex]
      newImages.splice(draggedIndex, 1)
      newImages.splice(index, 0, draggedItem)
      onChange(newImages)
      setDraggedIndex(index)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const isVideoUrl = (url: string) => {
    return /\.(mp4|webm|ogg|mov|avi)$/i.test(url) || url.includes("video")
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
        <p className="text-xs text-muted-foreground mb-3">
          Adicione múltiplas imagens/vídeos que serão rotacionadas automaticamente nos reenvios
        </p>

        {/* Lista de imagens */}
        {images.length > 0 && (
          <div className="space-y-2 mb-4">
            {images.map((imageUrl, index) => (
              <div
                key={index}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-move ${
                  draggedIndex === index ? "opacity-50" : ""
                }`}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  {isVideoUrl(imageUrl) ? (
                    <Video className="h-10 w-10 text-primary shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded overflow-hidden bg-muted shrink-0">
                      <img
                        src={imageUrl}
                        alt={`Imagem ${index + 1}`}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = "none"
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {isVideoUrl(imageUrl) ? "Vídeo" : "Imagem"} {index + 1}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{imageUrl}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      window.open(imageUrl, "_blank")
                    }}
                    title="Ver no navegador"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleRemove(index, e)}
                    title="Remover"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botão de upload */}
        <div
          className={`border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary cursor-pointer transition-colors bg-card ${
            isUploading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!isUploading) {
              fileInputRef.current?.click()
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple
            onChange={handleFileSelect}
            onClick={(e) => {
              e.stopPropagation()
            }}
            className="hidden"
          />
          {isUploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">Enviando...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Plus className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground mb-1">
                Clique para adicionar imagens ou vídeos
              </p>
              <p className="text-xs text-muted-foreground">
                Você pode selecionar múltiplos arquivos • Máximo: {maxSizeMB}MB cada
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Campo de URL manual */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Ou adicione URLs manualmente (uma por linha)
        </label>
        <textarea
          placeholder="Cole as URLs aqui, uma por linha..."
          rows={3}
          className="w-full px-3 py-2 border border-input bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary/50 text-sm"
          onBlur={(e) => {
            const urls = e.target.value
              .split("\n")
              .map((url) => url.trim())
              .filter((url) => url.length > 0 && (url.startsWith("http://") || url.startsWith("https://")))
            if (urls.length > 0) {
              onChange([...images, ...urls])
              e.target.value = ""
            }
          }}
        />
      </div>
    </div>
  )
}
