'use client'

import { Button } from '@/components/ui/button'
import { Share2 } from 'lucide-react'

export function ShareButton({ url, title }: { url: string; title: string }) {
  async function share() {
    if (navigator.share) {
      await navigator.share({ url, title })
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copied!')
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={share}>
      <Share2 className="h-4 w-4 mr-2" /> Share
    </Button>
  )
}
