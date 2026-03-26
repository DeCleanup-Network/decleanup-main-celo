/**
 * Photo Serving Endpoint
 * Serves photos stored on VPS filesystem
 * 
 * GET /api/uploads/{submissionId}/{filename}
 */

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads')

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ submissionId: string; filename: string }> | { submissionId: string; filename: string } }
) {
  try {
    // Handle both sync and async params (Next.js 13 vs 14)
    const params = 'then' in context.params ? await context.params : context.params
    const { submissionId, filename } = params
    
    // Security: Validate filename (only allow .jpg, .jpeg, .png)
    if (!/^before\.(jpg|jpeg|png)$|^after\.(jpg|jpeg|png)$/i.test(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }
    
    // Security: Validate submissionId (alphanumeric and dashes only)
    if (!/^[a-zA-Z0-9-_]+$/.test(submissionId)) {
      return NextResponse.json({ error: 'Invalid submission ID' }, { status: 400 })
    }
    
    const filepath = join(UPLOAD_DIR, submissionId, filename)
    
    if (!existsSync(filepath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    // Read and serve file
    const fileBuffer = await readFile(filepath)
    
    // Determine content type
    const contentType = filename.toLowerCase().endsWith('.png') 
      ? 'image/png' 
      : 'image/jpeg'
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    })
    
  } catch (error) {
    console.error('[Photo Serving] Error:', error)
    return NextResponse.json(
      { error: 'Failed to serve photo' },
      { status: 500 }
    )
  }
}
