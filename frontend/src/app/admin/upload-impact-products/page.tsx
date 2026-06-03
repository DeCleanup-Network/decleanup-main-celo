'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { batchUploadImpactProducts } from '@/lib/utils/impact-product-ipfs'
import Link from 'next/link'

export default function UploadImpactProductsPage() {
  const [images, setImages] = useState<File[]>([])
  const [animation, setAnimation] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<Map<number, { imageHash: string; metadataHash: string; animationHash?: string }> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      if (files.length !== 10) {
        setError('Please select exactly 10 image files (one for each level)')
        return
      }
      setImages(files)
      setError(null)
    }
  }

  const handleAnimationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAnimation(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (images.length !== 10) {
      setError('Please select exactly 10 image files')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const uploadResults = await batchUploadImpactProducts(images, animation || undefined)
      setResults(uploadResults)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload images')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-4xl tracking-wider text-foreground">
              UPLOAD IMPACT PRODUCTS
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload all 10 Impact Product images and metadata to IPFS
            </p>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm">
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Instructions */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-xl tracking-wider text-foreground">
            INSTRUCTIONS
          </h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Select exactly 10 PNG image files (one for each level 1-10)</li>
            <li>Optionally select 1 GIF file for level 10 animation</li>
            <li>Click "Upload to IPFS" to upload all images and generate metadata</li>
            <li>Copy the IPFS CIDs and update your environment variables</li>
          </ol>
        </div>

        {/* File Upload */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block font-heading text-lg tracking-wider text-foreground">
                Impact Product Images (10 PNG files)
              </label>
              <input
                type="file"
                accept="image/png"
                multiple
                onChange={handleImageChange}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-brand-green file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-green/90"
                disabled={uploading}
              />
              {images.length > 0 && (
                <p className="mt-2 text-sm text-brand-green">
                  {images.length} file(s) selected
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block font-heading text-lg tracking-wider text-foreground">
                Level 10 Animation (Optional GIF file)
              </label>
              <input
                type="file"
                accept="image/gif"
                onChange={handleAnimationChange}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-brand-green file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-green/90"
                disabled={uploading}
              />
              {animation && (
                <p className="mt-2 text-sm text-brand-green">
                  Animation file selected: {animation.name}
                </p>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading || images.length !== 10}
              className="w-full gap-2 bg-brand-green font-heading text-lg tracking-wider text-black hover:bg-brand-green/90"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  UPLOADING...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  UPLOAD TO IPFS
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-brand-green/50 bg-brand-green/10 p-6">
              <div className="mb-4 flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-brand-green" />
                <h2 className="font-heading text-2xl tracking-wider text-brand-green">
                  UPLOAD SUCCESSFUL!
                </h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Copy these IPFS CIDs and add them to your environment variables:
              </p>
              <div className="space-y-3">
                {Array.from(results.entries()).map(([level, data]) => (
                  <div key={level} className="rounded-lg border border-border bg-background p-4">
                    <h3 className="mb-2 font-heading text-lg text-foreground">
                      Level {level}
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Image Hash:</span>
                        <code className="ml-2 rounded bg-gray-900 px-2 py-1 text-brand-green">
                          {data.imageHash}
                        </code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Metadata Hash:</span>
                        <code className="ml-2 rounded bg-gray-900 px-2 py-1 text-brand-green">
                          {data.metadataHash}
                        </code>
                      </div>
                      {data.animationHash && (
                        <div>
                          <span className="text-muted-foreground">Animation Hash:</span>
                          <code className="ml-2 rounded bg-gray-900 px-2 py-1 text-brand-green">
                            {data.animationHash}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-border bg-background p-4">
                <p className="mb-2 text-xs font-semibold text-foreground">
                  Environment Variables:
                </p>
                <code className="block text-xs text-muted-foreground">
                  NEXT_PUBLIC_IMPACT_IMAGES_CID=your_images_cid_here
                  <br />
                  NEXT_PUBLIC_IMPACT_METADATA_CID=your_metadata_cid_here
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

