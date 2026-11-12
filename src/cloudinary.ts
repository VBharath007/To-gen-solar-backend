import crypto from 'node:crypto';

export interface CloudinaryUploadResult {
  url: string;
  secure_url: string;
  public_id: string;
  bytes: number;
  format: string;
  width?: number;
  height?: number;
}

export async function uploadToCloudinary(
  base64Data: string,
  fileName: string,
  mimeType: string,
  folder = 'togen_solar'
): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dbvns9uwy';
  const apiKey = process.env.CLOUDINARY_API_KEY || '925334277142473';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || 'uByNTCm5Lw2D_FBC9-9dDRTCdeU';

  const timestamp = Math.floor(Date.now() / 1000);

  // Clean public_id base name
  const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const publicId = `${cleanName}_${Date.now()}`;

  // Parameters to sign in alphabetical order
  const paramsToSign: Record<string, string> = {
    folder,
    public_id: publicId,
    timestamp: String(timestamp),
  };

  const sortedKeys = Object.keys(paramsToSign).sort();
  const signatureString = sortedKeys.map((k) => `${k}=${paramsToSign[k]}`).join('&') + apiSecret;
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  const formData = new FormData();
  formData.append('file', `data:${mimeType};base64,${base64Data}`);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', folder);
  formData.append('public_id', publicId);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  const resJson = (await response.json()) as any;
  if (!response.ok) {
    throw new Error(resJson.error?.message || `Cloudinary upload failed with status ${response.status}`);
  }

  return {
    url: resJson.secure_url || resJson.url,
    secure_url: resJson.secure_url || resJson.url,
    public_id: resJson.public_id,
    bytes: resJson.bytes || 0,
    format: resJson.format || '',
    width: resJson.width,
    height: resJson.height,
  };
}

