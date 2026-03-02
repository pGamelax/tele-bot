import { v2 as cloudinary } from "cloudinary";

let cloudName: string | undefined;
let apiKey: string | undefined;
let apiSecret: string | undefined;

if (process.env.CLOUDINARY_URL) {
  const url = process.env.CLOUDINARY_URL;
  const match = url.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
  
  if (match) {
    [, apiKey, apiSecret, cloudName] = match;
  }
} else {
  cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  apiKey = process.env.CLOUDINARY_API_KEY;
  apiSecret = process.env.CLOUDINARY_API_SECRET;
}

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

/**
 * Deleta um arquivo do Cloudinary pelo public_id ou URL.
 */
export async function deleteFromCloudinary(publicIdOrUrl: string): Promise<void> {
  try {
    let publicId = publicIdOrUrl;
    
    if (publicIdOrUrl.includes("cloudinary.com")) {
      const urlParts = publicIdOrUrl.split("/");
      const uploadIndex = urlParts.findIndex((part) => part === "upload");
      if (uploadIndex !== -1 && urlParts[uploadIndex + 2]) {
        const versionIndex = uploadIndex + 1;
        const folderAndFile = urlParts.slice(versionIndex + 1).join("/");
        publicId = folderAndFile.replace(/\.[^/.]+$/, "");
      }
    }

    await cloudinary.uploader.destroy(publicId, {
      resource_type: "auto",
    });
  } catch (error) {
    console.error(`[Cloudinary] Erro ao deletar arquivo:`, error);
    throw error;
  }
}

/**
 * Verifica se uma URL é do Cloudinary
 */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes("cloudinary.com") || url.includes("res.cloudinary.com");
}
