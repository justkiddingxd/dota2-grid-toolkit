import { createCanvas, loadImage } from '@napi-rs/canvas';

// Download only a Telegram-provided path. The bot token never leaves the server.
export async function telegramAvatar(api, token, userId, fetcher = fetch) {
  const result = await api.getUserProfilePhotos({ user_id: userId, limit: 1 });
  const sizes = result.photos?.[0];
  if (!sizes?.length) return null;
  const sorted = [...sizes].sort((a, b) => a.width - b.width);
  const photo = sorted.find(p => p.width >= 96) || sorted.at(-1);
  const file = await api.getFile({ file_id: photo.file_id });
  const path = file.file_path;
  if (!token || !path || !/^[\w./-]+$/.test(path) || path.split('/').includes('..') || path.startsWith('/') || file.file_size > 2_000_000) throw new Error('Avatar unavailable');
  const response = await fetcher(`https://api.telegram.org/file/bot${token}/${path}`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (!response.ok || Number(response.headers.get('content-length')) > 2_000_000) throw new Error('Avatar unavailable');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error('Avatar too large');
    chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks);
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8) && bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Avatar is not a photo');
  const image = await loadImage(bytes);
  if (!image.width || !image.height || image.width * image.height > 16_000_000) throw new Error('Avatar too large');
  const canvas = createCanvas(96, 96), ctx = canvas.getContext('2d');
  const edge = Math.min(image.width, image.height);
  ctx.drawImage(image, (image.width - edge) / 2, (image.height - edge) / 2, edge, edge, 0, 0, 96, 96);
  return canvas.toBuffer('image/png');
}
