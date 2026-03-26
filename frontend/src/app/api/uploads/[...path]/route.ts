/**
 * Serve uploaded images from the uploads directory
 * GET /api/uploads/[submissionId]/[filename]
 */

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads')

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = join(UPLOAD_DIR, ...params.path)
    
    // Security: ensure path is within uploads directory
    const resolvedPath = join(UPLOAD_DIR, ...params.path)
    if (!resolvedPath.startsWith(UPLOAD_DIR)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    const fileBuffer = await readFile(filePath)
    
    // Determine content type from file extension
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentType = ext === 'jpg' || ext === 'jpeg' 
      ? 'image/jpeg' 
      : ext === 'png' 
      ? 'image/png' 
      : 'application/octet-stream'
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('[Uploads API] Error serving file:', error)
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    )
  }
}
