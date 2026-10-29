import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { RESOURCE_BUCKET } from '@/lib/resources'

const privateHeaders = { 'Cache-Control': 'private, no-store' }

export async function GET(
  request: Request,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  const { resourceId } = await params
  const search = new URL(request.url).searchParams
  const churchId = search.get('churchId')
  if (
    !z.uuid().safeParse(resourceId).success ||
    !z.uuid().safeParse(churchId).success
  ) {
    return NextResponse.json(
      { error: 'Invalid resource.' },
      { status: 400, headers: privateHeaders }
    )
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json(
      { error: 'Please sign in to access this resource.' },
      { status: 401, headers: privateHeaders }
    )

  // The session client applies RLS in addition to the explicit church scope.
  const { data: resource, error } = await supabase
    .from('resources')
    .select('file_path, file_name, type')
    .eq('id', resourceId)
    .eq('church_id', churchId!)
    .eq('active', true)
    .maybeSingle()
  if (error)
    return NextResponse.json(
      { error: 'Unable to load this resource.' },
      { status: 500, headers: privateHeaders }
    )
  if (!resource?.file_path || !resource.file_name) {
    return NextResponse.json(
      { error: 'This resource is no longer available.' },
      { status: 404, headers: privateHeaders }
    )
  }
  const preview = search.get('preview') === '1'
  if (preview && resource.type !== 'image') {
    return NextResponse.json(
      { error: 'Only photos can be previewed.' },
      { status: 400, headers: privateHeaders }
    )
  }
  const { data, error: storageError } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .createSignedUrl(
      resource.file_path,
      300,
      preview ? {} : { download: resource.file_name }
    )
  if (storageError || !data) {
    return NextResponse.json(
      { error: 'Unable to open this file. Please try again.' },
      { status: 503, headers: privateHeaders }
    )
  }
  if (preview)
    return NextResponse.redirect(data.signedUrl, {
      status: 307,
      headers: privateHeaders,
    })
  return NextResponse.json({ url: data.signedUrl }, { headers: privateHeaders })
}
