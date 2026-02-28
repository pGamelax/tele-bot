import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Upload, X, Image as ImageIcon, Video } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}

export function ImageUpload({ value, onChange, label = "Mídia" }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Detectar tipo de mídia quando value mudar
  useEffect(() => {
    if (value) {
      // Verificar se é vídeo pela extensão
      const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(value);
      setMediaType(isVideo ? "video" : "image");
      setPreview(value);
    } else {
      setPreview(null);
      setMediaType(null);
    }
  }, [value]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    // Validar tipo
    if (!isImage && !isVideo) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma imagem ou vídeo",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho
    const maxSize = isImage ? 5 * 1024 * 1024 : 50 * 1024 * 1024; // 5MB para imagens, 50MB para vídeos
    if (file.size > maxSize) {
      const maxSizeMB = isImage ? 5 : 50;
      toast({
        title: "Erro",
        description: `O arquivo deve ter no máximo ${maxSizeMB}MB`,
        variant: "destructive",
      });
      return;
    }

    // Criar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      setMediaType(isImage ? "image" : "video");
    };
    reader.readAsDataURL(file);

    // Fazer upload
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      console.log(`[ImageUpload] Fazendo upload para: ${API_URL}/api/upload/media`);
      console.log(`[ImageUpload] Arquivo: ${file.name}, Tamanho: ${file.size} bytes, Tipo: ${file.type}`);

      const response = await fetch(`${API_URL}/api/upload/media`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      console.log(`[ImageUpload] Resposta recebida: ${response.status} ${response.statusText}`);

      const data = await response.json();
      console.log(`[ImageUpload] Dados recebidos:`, data);

      if (!response.ok) {
        console.error(`[ImageUpload] Erro na resposta:`, data);
        throw new Error(data.error || "Erro ao fazer upload");
      }

      console.log(`[ImageUpload] Upload bem-sucedido! URL: ${data.url}`);
      onChange(data.url);
      toast({
        title: "Sucesso!",
        description: `${isImage ? "Imagem" : "Vídeo"} enviado com sucesso`,
      });
    } catch (error: any) {
      console.error(`[ImageUpload] Erro ao fazer upload:`, error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      setPreview(null);
      setMediaType(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setMediaType(null);
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-4">
        {preview ? (
            <div className="relative">
            {mediaType === "video" ? (
              <video
                src={preview}
                controls
                className="w-full h-64 object-cover rounded-md border border-gray-200"
              />
            ) : (
              <img
                src={preview}
                alt="Preview"
                className="w-full h-64 object-cover rounded-md border border-gray-200"
              />
            )}
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-gray-50 transition-colors bg-white"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex items-center justify-center gap-4 mb-4">
              <ImageIcon className="h-12 w-12 text-gray-400" />
              <Video className="h-12 w-12 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Clique para fazer upload de uma imagem ou vídeo
            </p>
            <p className="text-xs text-gray-500">
              Imagens: PNG, JPG, GIF até 5MB | Vídeos: MP4, WEBM até 50MB
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        {!preview && (
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              "Enviando..."
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Selecionar Mídia
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
