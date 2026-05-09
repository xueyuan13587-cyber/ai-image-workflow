import { NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "@/lib/auth";

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

export async function POST(request: Request) {
  try {
    const session = getSessionFromCookieHeader(request.headers.get("cookie"));

    if (!session) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      return NextResponse.json(
        {
          error:
            "未配置 Cloudinary。请设置 CLOUDINARY_CLOUD_NAME 和 CLOUDINARY_UPLOAD_PRESET。"
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as UploadRequest;

    if (!body.imageData) {
      return NextResponse.json({ error: "缺少图片数据。" }, { status: 400 });
    }

    const formData = new FormData();
    formData.append("file", body.imageData);
    formData.append("upload_preset", uploadPreset);

    if (body.fileName) {
      formData.append("context", `caption=${body.fileName}`);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData
      }
    );
    const payload = (await response.json()) as CloudinaryUploadResponse;

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error?.message ?? "图片上传失败。" },
        { status: response.status }
      );
    }

    const imageUrl = payload.secure_url ?? payload.url;

    if (!imageUrl) {
      return NextResponse.json({ error: "上传成功但没有返回图片 URL。" }, { status: 500 });
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "图片上传失败。" },
      { status: 500 }
    );
  }
}
