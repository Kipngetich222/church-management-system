import {
  Award,
  Baby,
  BookOpen,
  Church,
  Clapperboard,
  Crown,
  Droplets,
  Flame,
  GraduationCap,
  HandHeart,
  Heart,
  Megaphone,
  Mic,
  Music,
  Shield,
  Sparkles,
  Star,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'

export const BADGE_ICON_OPTIONS = [
  { value: 'award', label: 'Award', icon: Award },
  { value: 'crown', label: 'Crown', icon: Crown },
  { value: 'star', label: 'Star', icon: Star },
  { value: 'shield', label: 'Shield', icon: Shield },
  { value: 'hand-heart', label: 'Serving heart', icon: HandHeart },
  { value: 'heart', label: 'Heart', icon: Heart },
  { value: 'users', label: 'People', icon: Users },
  { value: 'music', label: 'Music', icon: Music },
  { value: 'mic', label: 'Microphone', icon: Mic },
  { value: 'book-open', label: 'Bible / book', icon: BookOpen },
  { value: 'graduation-cap', label: 'Teaching', icon: GraduationCap },
  { value: 'megaphone', label: 'Evangelism', icon: Megaphone },
  { value: 'sparkles', label: 'Youth / sparkle', icon: Sparkles },
  { value: 'baby', label: 'Children', icon: Baby },
  { value: 'clapperboard', label: 'Media', icon: Clapperboard },
  { value: 'flame', label: 'Prayer / fire', icon: Flame },
  { value: 'target', label: 'Mission', icon: Target },
  { value: 'church', label: 'Church', icon: Church },
  { value: 'droplets', label: 'Baptism', icon: Droplets },
] as const

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  BADGE_ICON_OPTIONS.map((option) => [option.value, option.icon])
)

export function BadgeIcon({
  name,
  className,
}: {
  name: string | null | undefined
  className?: string
}) {
  const Icon = ICON_MAP[name ?? ''] ?? Award
  return <Icon className={className} />
}
