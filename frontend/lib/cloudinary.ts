const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "telebot";

export interface CloudinaryUploadResult {
  url: string;
  secure_url: string;
  public_id: string;
  format: string;
  resource_type: "image" | "video";
  bytes: number;
}

/**
 * Faz upload direto de um arquivo para o Cloudinary usando unsigned upload.
 */
export async function uploadToCloudinary(
  file: File
): Promise<CloudinaryUploadResult> {
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary não configurado. Verifique NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const resourceType = isImage ? "image" : isVideo ? "video" : "auto";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "tele-bot");

  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  try {
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(error.error?.message || error.error || "Erro ao fazer upload");
    }

    const result = await response.json();

    return {
      url: result.url,
      secure_url: result.secure_url,
      public_id: result.public_id,
      format: result.format || "",
      resource_type: result.resource_type as "image" | "video",
      bytes: result.bytes || 0,
    };
  } catch (error: any) {
    throw new Error(error.message || "Erro ao fazer upload para o Cloudinary");
  }
}
