import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { ExecutionContext } from '@nestjs/common'
import { ChurchGuard } from '../../common/guards/church.guard'
import { SupabaseService } from '../../supabase/supabase.service'
import { ResourcesController } from './resources.controller'
import { ResourcesService } from './resources.service'
import { MAX_PHOTO_BYTES, RESOURCE_BUCKET } from './resource-files'

describe('Resource library', () => {
  const churchId = 'church-a'
  const row = {
    id: 'resource-a',
    church_id: churchId,
    type: 'document',
    file_path: `${churchId}/file.pdf`,
    file_name: 'Study guide.pdf',
    active: true,
  }
  const file = {
    originalname: 'Study guide.pdf',
    size: 5,
    buffer: Buffer.from('%PDF-'),
  }
  const dto = { name: 'Study guide', type: 'document' as const }
  let query: Record<string, jest.Mock>
  let storage: Record<string, jest.Mock>
  let service: ResourcesService
  let from: jest.Mock

  beforeEach(() => {
    query = Object.fromEntries(
      ['select', 'eq', 'not', 'order', 'insert', 'update', 'delete'].map(
        (key) => [key, jest.fn()]
      )
    )
    for (const fn of Object.values(query)) fn.mockReturnValue(query)
    query.single = jest.fn().mockResolvedValue({ data: row, error: null })
    query.maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null })
    query.order.mockResolvedValue({ data: [row], error: null })
    storage = {
      upload: jest.fn().mockResolvedValue({ error: null }),
      remove: jest.fn().mockResolvedValue({ error: null }),
      createSignedUrl: jest.fn().mockResolvedValue({
        data: { signedUrl: 'https://storage.test/signed' },
        error: null,
      }),
    }
    from = jest.fn().mockReturnValue(query)
    service = new ResourcesService({
      admin: { from, storage: { from: jest.fn().mockReturnValue(storage) } },
      unwrap: (data: unknown, error: { message: string } | null) => {
        if (error) throw new Error(error.message)
        return data
      },
    } as unknown as SupabaseService)
  })

  it('lists active files from the requested church without querying bookings', async () => {
    await service.list(churchId)
    expect(from).toHaveBeenCalledWith('resources')
    expect(from).not.toHaveBeenCalledWith('resource_bookings')
    expect(query.eq).toHaveBeenCalledWith('church_id', churchId)
    expect(query.eq).toHaveBeenCalledWith('active', true)
    expect(query.not).toHaveBeenCalledWith('file_path', 'is', null)
  })

  it('uploads a file with a unique church-scoped path and original download name', async () => {
    await service.create(churchId, dto, file)
    const path = storage.upload.mock.calls[0][0]
    expect(path).toMatch(/^church-a\/[a-f0-9-]+\.pdf$/)
    expect(storage.upload).toHaveBeenCalledWith(path, file.buffer, {
      contentType: 'application/pdf',
      upsert: false,
    })
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        file_path: path,
        file_name: file.originalname,
        church_id: churchId,
        type: 'document',
      })
    )
  })

  it('retains photo event names and calendar dates', async () => {
    await service.create(
      churchId,
      {
        name: 'Retreat',
        type: 'image',
        eventName: 'Youth retreat',
        photoDate: '2026-10-29',
      },
      { ...file, originalname: 'Retreat.JPG' }
    )
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: 'Youth retreat',
        photo_date: '2026-10-29',
        mime_type: 'image/jpeg',
      })
    )
  })

  it.each([
    ['missing file', undefined],
    ['empty file', { ...file, buffer: Buffer.alloc(0), size: 0 }],
    ['unsupported executable', { ...file, originalname: 'program.exe' }],
    ['image in document category', { ...file, originalname: 'photo.png' }],
  ])(
    'rejects %s before creating any storage objects',
    async (_name, invalidFile) => {
      await expect(
        service.create(churchId, dto, invalidFile)
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(storage.upload).not.toHaveBeenCalled()
    }
  )

  it('rejects photos larger than 10 MB', async () => {
    await expect(
      service.create(
        churchId,
        { name: 'Photo', type: 'image' },
        { ...file, originalname: 'photo.jpg', size: MAX_PHOTO_BYTES + 1 }
      )
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('cleans up the uploaded object if saving its library entry fails', async () => {
    query.single.mockResolvedValue({
      data: null,
      error: { message: 'Save failed' },
    })
    await expect(service.create(churchId, dto, file)).rejects.toThrow(
      'Save failed'
    )
    expect(storage.remove).toHaveBeenCalledWith([
      storage.upload.mock.calls[0][0],
    ])
  })

  it('does not create an entry when the storage upload fails', async () => {
    storage.upload.mockResolvedValue({ error: { message: 'Storage full' } })
    await expect(service.create(churchId, dto, file)).rejects.toThrow(
      'Storage full'
    )
    expect(query.insert).not.toHaveBeenCalled()
  })

  it('signs downloads as attachments using the original file name', async () => {
    await expect(service.fileUrl(churchId, row.id)).resolves.toEqual({
      url: 'https://storage.test/signed',
      expiresIn: 300,
    })
    expect(query.eq).toHaveBeenCalledWith('church_id', churchId)
    expect(storage.createSignedUrl).toHaveBeenCalledWith(row.file_path, 300, {
      download: row.file_name,
    })
  })

  it('does not sign URLs for missing, inactive or other-church resources', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(service.fileUrl('church-b', row.id)).rejects.toBeInstanceOf(
      NotFoundException
    )
    expect(query.eq).toHaveBeenCalledWith('church_id', 'church-b')
    expect(query.eq).toHaveBeenCalledWith('active', true)
    expect(storage.createSignedUrl).not.toHaveBeenCalled()
  })

  it('allows inline previews only for photos', async () => {
    await expect(
      service.fileUrl(churchId, row.id, true)
    ).rejects.toBeInstanceOf(BadRequestException)
    query.maybeSingle.mockResolvedValue({
      data: { ...row, type: 'image' },
      error: null,
    })
    await service.fileUrl(churchId, row.id, true)
    expect(storage.createSignedUrl).toHaveBeenCalledWith(row.file_path, 300, {})
  })

  it('keeps the entry available for retry if deleting storage fails', async () => {
    storage.remove.mockResolvedValue({
      error: { message: 'Storage unavailable' },
    })
    await expect(service.remove(churchId, row.id)).rejects.toThrow(
      'Storage unavailable'
    )
    expect(query.delete).not.toHaveBeenCalled()
  })

  it('deletes the uploaded object and only the matching church entry', async () => {
    await service.remove(churchId, row.id)
    expect(storage.remove).toHaveBeenCalledWith([row.file_path])
    expect(query.eq).toHaveBeenCalledWith('church_id', churchId)
    expect(query.eq).toHaveBeenCalledWith('id', row.id)
    expect(query.delete).toHaveBeenCalled()
  })

  it.each(['create', 'update', 'remove'] as const)(
    'blocks members from %s, but allows church admins',
    (method) => {
      const request = {
        params: { churchId },
        headers: {},
        user: { memberships: [{ churchId, role: 'member' }] },
      }
      const context = {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => ResourcesController.prototype[method],
        getClass: () => ResourcesController,
      } as unknown as ExecutionContext
      const guard = new ChurchGuard(new Reflector())
      expect(() => guard.canActivate(context)).toThrow(
        'Insufficient permissions'
      )
      request.user.memberships[0].role = 'super_admin'
      expect(guard.canActivate(context)).toBe(true)
      request.user.memberships[0].churchId = 'church-b'
      expect(() => guard.canActivate(context)).toThrow(
        'You do not belong to this church'
      )
    }
  )

  it('allows a church member to download without an approval or booking', () => {
    const request = {
      params: { churchId },
      user: { memberships: [{ churchId, role: 'member' }] },
    }
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ResourcesController.prototype.download,
      getClass: () => ResourcesController,
    } as unknown as ExecutionContext
    expect(new ChurchGuard(new Reflector()).canActivate(context)).toBe(true)
    expect(RESOURCE_BUCKET).toBe('church-resources')
  })
})
