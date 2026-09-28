import { convertHeicOnServer, looksLikeHeic } from '@/lib/utils/heic-convert'

function fileFromBytes(name: string, type: string, bytes: number[]): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('looksLikeHeic', () => {
  it('detects .heic extension', async () => {
    const file = fileFromBytes('IMG_0001.HEIC', '', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    await expect(looksLikeHeic(file)).resolves.toBe(true)
  })

  it('detects HEIC magic bytes on a .jpg name (AirDrop / iCloud)', async () => {
    const bytes = [
      0, 0, 0, 24,
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x68, 0x65, 0x69, 0x63, // heic
    ]
    const file = fileFromBytes('IMG_0001.JPG', 'image/jpeg', bytes)
    await expect(looksLikeHeic(file)).resolves.toBe(true)
  })

  it('rejects a normal JPEG', async () => {
    const bytes = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]
    const file = fileFromBytes('shot.jpg', 'image/jpeg', bytes)
    await expect(looksLikeHeic(file)).resolves.toBe(false)
  })
})

describe('convertHeicOnServer', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns a JPEG file when the convert API succeeds', async () => {
    const jpegBytes = new Uint8Array(64).fill(0x5a)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob([jpegBytes], { type: 'image/jpeg' }),
    }) as unknown as typeof fetch

    const file = fileFromBytes('IMG_0001.HEIC', 'image/heic', [0, 1, 2, 3])
    const converted = await convertHeicOnServer(file)
    expect(converted).not.toBeNull()
    expect(converted?.type).toBe('image/jpeg')
    expect(converted?.name).toMatch(/\.jpg$/)
    expect(global.fetch).toHaveBeenCalledWith('/api/photos/convert-heic', expect.objectContaining({ method: 'POST' }))
  })

  it('returns null when the convert API fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    const file = fileFromBytes('IMG_0001.HEIC', 'image/heic', [0, 1, 2, 3])
    await expect(convertHeicOnServer(file)).resolves.toBeNull()
  })
})
