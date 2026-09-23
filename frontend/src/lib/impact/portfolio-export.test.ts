import { openReportPrintWindow } from '@/lib/impact/portfolio-export'

describe('openReportPrintWindow', () => {
  const originalOpen = window.open
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL

  afterEach(() => {
    window.open = originalOpen
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
    jest.useRealTimers()
  })

  it('opens a blob URL instead of writing into the new document', () => {
    const create = jest.fn(() => 'blob:report')
    const revoke = jest.fn()
    const open = jest.fn(() => ({}) as Window)
    URL.createObjectURL = create
    URL.revokeObjectURL = revoke
    window.open = open

    openReportPrintWindow('<html><body>ok</body></html>')

    expect(create).toHaveBeenCalledTimes(1)
    const blob = create.mock.calls[0][0] as Blob
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toContain('text/html')
    expect(open).toHaveBeenCalledWith('blob:report', '_blank', 'noopener,noreferrer')
    expect(revoke).not.toHaveBeenCalled()
  })

  it('revokes the blob URL if the window is blocked', () => {
    const create = jest.fn(() => 'blob:blocked')
    const revoke = jest.fn()
    URL.createObjectURL = create
    URL.revokeObjectURL = revoke
    window.open = jest.fn(() => null)

    openReportPrintWindow('<html></html>')

    expect(revoke).toHaveBeenCalledWith('blob:blocked')
  })
})
