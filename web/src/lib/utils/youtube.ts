export function extractYoutubeId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url
  return null
}

export function youtubeEmbedUrl(id: string, autoplay = false) {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    ...(autoplay ? { autoplay: '1' } : {}),
  })
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`
}

export function youtubeThumb(id: string, quality: 'default' | 'hq' | 'max' = 'hq') {
  const q = quality === 'max' ? 'maxresdefault' : quality === 'hq' ? 'hqdefault' : 'default'
  return `https://img.youtube.com/vi/${id}/${q}.jpg`
}