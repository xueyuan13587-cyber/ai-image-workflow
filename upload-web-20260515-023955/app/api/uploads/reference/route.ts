import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/modules/auth/server/auth";
import {
  isObjectStorageConfigured,
  uploadImageDataUrlToObjectStorage
} from "@/modules/assets/server/object-storage";

export const runtime = "nodejs";

type UploadRequest = {
  imageData: string;
  fileName?: string;
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  url?: string;
  error?: {
    message?: string;
  };
};

async function uploadToCloudinary(body: UploadRequest) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "未配置对象存储或 Cloudinary。请优先配置 R2/S3 环境变量，或设置 CLOUDINARY_CLOUD_NAME 和 CLOUDINARY_UPLOAD_PRESET。"
    );
  }

  const formData = new FormData();
  formData.append("file", body.imageData);
  formData.append("upload_preset", uploadPreset);

  if (body.fileName) {
    formData.append("context", `caption=${body.fileName}`);
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData
  });
  const payload = (await response.json()) as CloudinaryUploadResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "图片上传失败。");
  }

  const imageUrl = payload.secure_url ?? payload.url;

  if (!imageUrl) {
    throw new Error("上传成功但没有返回图片 URL。");
  }

  return imageUrl;
}

export async function POST(request: Request) {
  try {
    const session = getSessionFromCookieHeader(request.headers.get("cookie"));

    if (!session) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }

    const body = (await request.json()) as UploadRequest;

    if (!body.imageData) {
      return NextResponse.json({ error: "缺少图片数据。" }, { status: 400 });
    }

    if (isObjectStorageConfigured()) {
      const stored = await uploadImageDataUrlToObjectStorage({
        imageData: body.imageData,
        fileName: body.fileName,
        folder: `users/${session.username}/references`
      });

      return NextResponse.json({
        imageUrl: stored.url,
        storageKey: stored.key,
        provider: "s3"
      });
    }

    const imageUrl = await uploadToCloudinary(body);

    return NextResponse.json({ imageUrl, provider: "cloudinary" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "图片上传失败。" },
      { status: 500 }
    );
  }
}
