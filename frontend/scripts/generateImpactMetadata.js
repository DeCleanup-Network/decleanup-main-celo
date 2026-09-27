/**
 * Generate tRWA metadata JSON files.
 *
 * Usage:
 *   npm run generate:metadata
 *
 * Outputs JSON files into metadata/impact-products/.
 */

const fs = require('fs')
const path = require('path')

// Root CID for assets (update if you re-upload)
// Can also be set via environment variable: NEXT_PUBLIC_IMPACT_IMAGES_CID
const BASE_CID = process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'

const OUTPUT_DIR = path.join(process.cwd(), 'metadata', 'impact-products')

const LEVELS = [
  { level: 1, name: 'Newbie', impactValue: 1, cleanups: 1, dcu: 10 },
  { level: 2, name: 'Newbie', impactValue: 2, cleanups: 2, dcu: 20 },
  { level: 3, name: 'Pro', impactValue: 3, cleanups: 5, dcu: 30 },
  { level: 4, name: 'Pro', impactValue: 4, cleanups: 8, dcu: 40 },
  { level: 5, name: 'Pro', impactValue: 5, cleanups: 12, dcu: 50 },
  { level: 6, name: 'Hero', impactValue: 6, cleanups: 16, dcu: 60 },
  { level: 7, name: 'Hero', impactValue: 7, cleanups: 20, dcu: 70 },
  { level: 8, name: 'Hero', impactValue: 8, cleanups: 25, dcu: 80 },
  { level: 9, name: 'Hero', impactValue: 9, cleanups: 30, dcu: 90 },
  { level: 10, name: 'Guardian', impactValue: 10, cleanups: 40, dcu: 100, hasAnimation: true },
]

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

function buildMetadata(levelConfig) {
  const { level, name, impactValue, cleanups, dcu, hasAnimation } = levelConfig

  const metadata = {
    name: `DeCleanup tRWA • Level ${level}`,
    description: 'Tokenized proof of real-world cleanups, verified by DeCleanup Rewards.',
    external_url: 'https://decleanup.network',
    image: `ipfs://${BASE_CID}/images/level${level}.png`,
    attributes: [
      { trait_type: 'Category', value: 'Cleanup NFT' },
      { trait_type: 'Type', value: 'Dynamic' },
      { trait_type: 'Impact', value: 'Environment' },
      { trait_type: 'Rarity', value: 'Unique' },
      { trait_type: 'Impact Value', value: impactValue.toString() },
      { trait_type: '$DCU', value: dcu.toString() },
      { trait_type: 'Level', value: name },
    ],
  }

  if (hasAnimation) {
    metadata.animation_url = `ipfs://${BASE_CID}/video/level${level}.mp4`
    metadata.image = `ipfs://${BASE_CID}/images/level${level}.png`
  }

  return metadata
}

function writeMetadataFile(levelConfig) {
  const metadata = buildMetadata(levelConfig)
  const filePath = path.join(OUTPUT_DIR, `level${levelConfig.level}.json`)
  fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2))
  console.log(`✓ Generated ${filePath}`)
}

function main() {
  ensureOutputDir()
  LEVELS.forEach(writeMetadataFile)
  console.log(`\nMetadata generated in ${OUTPUT_DIR}`)
}

main()

