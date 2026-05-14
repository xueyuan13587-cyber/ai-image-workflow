import { createHash, createHmac, randomUUID } from "crypto";

type UploadImageInput = {
  buffer: Buffer;
  contentType: string;
  key?: string;
  fileName?: string;
  folder?: string;
};

type StoredImage = {
  key: string;
  url: string;
  contentType: string;
  size: number;
};

type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
};

const DATA_URL_PATTERN = /^data:(?<mime>[^;]+);base64,(?<data>.+)$/;

function getStorageConfig(): StorageConfig | undefined {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    return undefined;
  }

  return {
    endpoint: endpoint.replace(/\/$/, ""),
    region: process.env.S3_REGION ?? "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, "")
  };
}

export function isObjectStorageConfigured() {
  return Boolean(getStorageConfig());
}

function hash(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function toAmzDate(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");

  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8)
  };
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function toCanonicalUri(bucket: string, key: string) {
  return `/${encodePathSegment(bucket)}/${key.split("/").map(encodePathSegment).join("/")}`;
}

function getSigningKey(secretAccessKey: string, dateStamp: string, region: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");

  return hmac(serviceKey, "aws4_request");
}

function getFileExtension(contentType: string, fileName?: string) {
  const fromFileName = fileName?.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  if (fromFileName && fromFileName.length <= 8) return fromFileName;
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  if (contentType === "image/avif") return "avif";

  return "png";
}

function createObjectKey(input: UploadImageInput) {
  if (input.key) return input.key.replace(/^\/+/, "");

  const folder = (input.folder ?? "images").replace(/^\/+|\/+$/g, "");
  const extension = getFileExtension(input.contentType, input.fileName);
  const now = new Date();
  const datePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;

  return `${folder}/${datePath}/${randomUUID()}.${extension}`;
}

export function parseImageDataUrl(imageData: string) {
  const match = imageData.match(DATA_URL_PATTERN);

  if (!match?.groups?.data) {
    throw new Error("图片数据格式不正确，请上传 base64 data URL。");
  }

  return {
    buffer: Buffer.from(match.groups.data, "base64"),
    contentType: match.groups.mime ?? "image/png"
  };
}

export async function uploadImageToObjectStorage(input: UploadImageInput): Promise<StoredImage> {
  const config = getStorageConfig();

  if (!config) {
    throw new Error("对象存储未配置，请设置 S3_ENDPOINT、S3_BUCKET、S3_ACCESS_KEY_ID、S3_SECRET_ACCESS_KEY 和 S3_PUBLIC_BASE_URL。");
  }

  const key = createObjectKey(input);
  const endpoint = new URL(config.endpoint);
  const canonicalUri = toCanonicalUri(config.bucket, key);
  const targetUrl = `${config.endpoint}${canonicalUri}`;
  const payloadHash = hash(input.buffer);
  const { amzDate, dateStamp } = toAmzDate();
  const canonicalHeaders = [
    `host:${endpoint.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join("\n");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hash(canonicalRequest)
  ].join("\n");
  const signature = hmacHex(getSigningKey(config.secretAccessKey, dateStamp, config.region), stringToSign);
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(", ");

  const response = await fetch(targetUrl, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Content-Type": input.contentType,
      "Content-Length": String(input.buffer.length),
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate
    },
    body: new Uint8Array(input.buffer)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`对象存储上传失败：${response.status} ${response.statusText} ${message.slice(0, 240)}`);
  }

  return {
    key,
    url: `${config.publicBaseUrl}/${key.split("/").map(encodePathSegment).join("/")}`,
    contentType: input.contentType,
    size: input.buffer.length
  };
}

export async function uploadImageDataUrlToObjectStorage(input: {
  imageData: string;
  fileName?: string;
  folder?: string;
}) {
  const image = parseImageDataUrl(input.imageData);

  return uploadImageToObjectStorage({
    ...image,
    fileName: input.fileName,
    folder: input.folder
  });
}

export async function imageSourceToBuffer(imageUrlOrDataUrl: string) {
  if (imageUrlOrDataUrl.startsWith("data:")) {
    return parseImageDataUrl(imageUrlOrDataUrl);
  }

  if (!imageUrlOrDataUrl.startsWith("http://") && !imageUrlOrDataUrl.startsWith("https://")) {
    throw new Error("图片地址必须是 http、https 或 data URL。");
  }

  const response = await fetch(imageUrlOrDataUrl);

  if (!response.ok) {
    throw new Error(`下载图片失败：${response.status} ${response.statusText}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type")?.split(";")[0] ?? "image/png"
  };
}

export async function persistImageSourceToObjectStorage(input: {
  imageUrlOrDataUrl: string;
  fileName?: string;
  folder?: string;
}) {
  const image = await imageSourceToBuffer(input.imageUrlOrDataUrl);

  return uploadImageToObjectStorage({
    ...image,
    fileName: input.fileName,
    folder: input.folder
  });
}
