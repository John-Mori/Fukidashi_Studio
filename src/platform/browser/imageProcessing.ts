function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = dataUrl;
  });
}

function isBlackLine(r: number, g: number, b: number, a: number): boolean {
  if (a < 24) return false;
  const luminance = r * 0.299 + g * 0.587 + b * 0.114;
  return luminance < 145;
}

export async function makeBubbleFrameWhiteTransparent(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const width = Math.max(1, image.naturalWidth || image.width);
  const height = Math.max(1, image.naturalHeight || image.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas context unavailable");

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  const pixelCount = width * height;
  const black = new Uint8Array(pixelCount);
  const outside = new Uint8Array(pixelCount);

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    black[index] = isBlackLine(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]) ? 1 : 0;
  }

  const queue = new Uint32Array(pixelCount);
  let head = 0;
  let tail = 0;
  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (outside[index] || black[index]) return;
    outside[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    if (black[index]) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 255;
    } else if (outside[index]) {
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = 0;
    } else {
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}
