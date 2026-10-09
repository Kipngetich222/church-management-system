const DAILY_VERSES = [
  'john 3:16',
  'psalm 23:1',
  'philippians 4:13',
  'romans 8:28',
  'proverbs 3:5-6',
  'isaiah 40:31',
  'matthew 11:28',
  'joshua 1:9',
  'psalm 46:10',
  'jeremiah 29:11',
]

export type Scripture = {
  reference: string
  text: string
  translation: string
}

export async function getDailyScripture(): Promise<Scripture> {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  )
  const verse = DAILY_VERSES[dayOfYear % DAILY_VERSES.length]

  try {
    const res = await fetch(
      `https://bible-api.com/${encodeURIComponent(verse)}?translation=kjv`,
      { next: { revalidate: 86400 } } // cache for 24h
    )
    const data = await res.json()
    return {
      reference: data.reference,
      text: data.text.trim(),
      translation: data.translation_name,
    }
  } catch {
    return {
      reference: 'Psalm 23:1',
      text: 'The Lord is my shepherd; I shall not want.',
      translation: 'KJV',
    }
  }
}
