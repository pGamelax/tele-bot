import { Elysia } from "elysia";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Usar caminho absoluto para garantir que funciona no Docker
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB para imagens
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB para vídeos

// Criar diretório de uploads se não existir (assíncrono)
(async () => {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    console.log(`[Upload] Diretório de uploads criado: ${UPLOAD_DIR}`);
  } else {
    console.log(`[Upload] Diretório de uploads já existe: ${UPLOAD_DIR}`);
  }
})();

export const uploadRoutes = new Elysia({ prefix: "/api/upload" })
  .post("/media", async ({ request, set }) => {
    console.log(`[Upload] Requisição recebida em /api/upload/media`);
    console.log(`[Upload] UPLOAD_DIR: ${UPLOAD_DIR}`);
    console.log(`[Upload] Diretório existe: ${existsSync(UPLOAD_DIR)}`);
    console.log(`[Upload] Content-Type: ${request.headers.get("content-type")}`);
    console.log(`[Upload] Content-Length: ${request.headers.get("content-length")}`);
    
    try {
      // Elysia recebe FormData do request
      console.log(`[Upload] Processando FormData...`);
      const formData = await request.formData();
      console.log(`[Upload] FormData processado`);
      
      const file = formData.get("file") as File | null;
      console.log(`[Upload] Arquivo extraído: ${file ? `Sim (${file.name}, ${file.size} bytes, ${file.type})` : 'Não'}`);

      if (!file) {
        console.error(`[Upload] Nenhum arquivo encontrado no FormData`);
        set.status = 400;
        return { error: "Nenhum arquivo enviado" };
      }

      // Validar tipo de arquivo (imagem ou vídeo)
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      console.log(`[Upload] Tipo detectado - Imagem: ${isImage}, Vídeo: ${isVideo}`);

      if (!isImage && !isVideo) {
        console.error(`[Upload] Tipo de arquivo inválido: ${file.type}`);
        set.status = 400;
        return { error: "Apenas imagens e vídeos são permitidos" };
      }

      // Validar tamanho
      const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
      if (file.size > maxSize) {
        const maxSizeMB = isImage ? 5 : 50;
        console.error(`[Upload] Arquivo muito grande: ${file.size} bytes (máximo: ${maxSize} bytes)`);
        set.status = 400;
        return { error: `Arquivo muito grande (máximo ${maxSizeMB}MB)` };
      }

      // Gerar nome único
      const timestamp = Date.now();
      const extension = file.name.split(".").pop() || (isImage ? "jpg" : "mp4");
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;
      const filePath = join(UPLOAD_DIR, fileName);
      console.log(`[Upload] Caminho do arquivo: ${filePath}`);

      // Garantir que o diretório existe antes de salvar
      if (!existsSync(UPLOAD_DIR)) {
        console.log(`[Upload] Criando diretório: ${UPLOAD_DIR}`);
        await mkdir(UPLOAD_DIR, { recursive: true });
      }

      // Salvar arquivo
      console.log(`[Upload] Convertendo arquivo para buffer...`);
      const arrayBuffer = await file.arrayBuffer();
      console.log(`[Upload] ArrayBuffer criado: ${arrayBuffer.byteLength} bytes`);
      const buffer = Buffer.from(arrayBuffer);
      console.log(`[Upload] Buffer criado: ${buffer.length} bytes`);
      
      console.log(`[Upload] Salvando arquivo em: ${filePath}`);
      await writeFile(filePath, buffer);
      console.log(`[Upload] Arquivo salvo com sucesso!`);

      // Verificar se o arquivo foi realmente salvo
      if (existsSync(filePath)) {
        const stats = await import("fs/promises").then(m => m.stat(filePath));
        console.log(`[Upload] Arquivo confirmado no disco: ${stats.size} bytes`);
      } else {
        console.error(`[Upload] ERRO: Arquivo não foi encontrado após salvar!`);
      }

      // Retornar URL completa e tipo de mídia
      const baseUrl = process.env.API_URL || process.env.BETTER_AUTH_URL || (process.env.PORT ? `http://localhost:${process.env.PORT}` : null);
      if (!baseUrl) {
        console.error(`[Upload] API_URL ou BETTER_AUTH_URL não configurado`);
        set.status = 500;
        return { error: "API_URL ou BETTER_AUTH_URL não configurado" };
      }
      const url = `${baseUrl}/uploads/${fileName}`;

      console.log(`[Upload] Upload concluído com sucesso!`);
      console.log(`[Upload] Arquivo: ${filePath}`);
      console.log(`[Upload] URL: ${url}`);
      console.log(`[Upload] Tipo: ${isImage ? "image" : "video"}`);

      return { url, fileName, type: isImage ? "image" : "video" };
    } catch (error: any) {
      console.error(`[Upload] Erro ao fazer upload:`, error);
      console.error(`[Upload] Stack trace:`, error.stack);
      set.status = 500;
      return { error: error.message || "Erro ao fazer upload" };
    }
  })
  // Manter compatibilidade com rota antiga
  .post("/image", async ({ request, set }) => {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        set.status = 400;
        return { error: "Nenhum arquivo enviado" };
      }

      if (!file.type.startsWith("image/")) {
        set.status = 400;
        return { error: "Apenas imagens são permitidas" };
      }

      if (file.size > MAX_IMAGE_SIZE) {
        set.status = 400;
        return { error: "Arquivo muito grande (máximo 5MB)" };
      }

      const timestamp = Date.now();
      const extension = file.name.split(".").pop() || "jpg";
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;
      const filePath = join(UPLOAD_DIR, fileName);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await writeFile(filePath, buffer);

      const baseUrl = process.env.API_URL || process.env.BETTER_AUTH_URL || (process.env.PORT ? `http://localhost:${process.env.PORT}` : null);
      if (!baseUrl) {
        set.status = 500;
        return { error: "API_URL ou BETTER_AUTH_URL não configurado" };
      }
      const url = `${baseUrl}/uploads/${fileName}`;

      return { url, fileName };
    } catch (error: any) {
      set.status = 500;
      return { error: error.message || "Erro ao fazer upload" };
    }
  });
