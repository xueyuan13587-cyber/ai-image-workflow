export async function downloadImage(imageUrl: string, fileName = "generated-image.png") {
  const anchor = document.createElement("a");

  if (imageUrl.startsWith("data:")) {
    anchor.href = imageUrl;
    anchor.download = fileName;
  } else {
    anchor.href = `/api/download-image?url=${encodeURIComponent(
      imageUrl
    )}&fileName=${encodeURIComponent(fileName)}`;
  }

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
