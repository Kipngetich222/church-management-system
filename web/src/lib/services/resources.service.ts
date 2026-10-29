import { createClient } from '@/lib/supabase/server'
import type { LibraryResource } from '@/lib/resources'

export async function listResources(
  churchId: string
): Promise<LibraryResource[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('church_id', churchId)
    .eq('active', true)
    .not('file_path', 'is', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error('Unable to load resources. Please try again.')
  return (data ?? []) as LibraryResource[]
}
