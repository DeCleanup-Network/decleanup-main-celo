/**
 * Create a zip file of metadata for easy upload to Pinata
 *
 * Usage:
 *   node scripts/createMetadataZip.js
 *
 * Then upload the generated zip file to Pinata web UI
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const METADATA_DIR = path.join(__dirname, '..', 'metadata', 'impact-products')
const ZIP_FILE = path.join(__dirname, '..', 'metadata-impact-products.zip')

try {
  const check = spawnSync('zip', ['-h'], { stdio: 'ignore' })
  if (check.error) {
    throw new Error('zip command not found. On macOS, install with: brew install zip')
  }

  if (!fs.existsSync(METADATA_DIR)) {
    throw new Error(`Metadata directory not found: ${METADATA_DIR}`)
  }

  const files = fs.readdirSync(METADATA_DIR).filter((name) => name.endsWith('.json'))
  if (files.length === 0) {
    throw new Error('No JSON metadata files found')
  }

  if (fs.existsSync(ZIP_FILE)) {
    fs.unlinkSync(ZIP_FILE)
  }

  console.log('Creating zip file...')
  const result = spawnSync('zip', ['-r', ZIP_FILE, ...files], {
    cwd: METADATA_DIR,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('zip failed')

  console.log('')
  console.log('✅ Zip file created:', ZIP_FILE)
  console.log('')
  console.log('📝 Next steps:')
  console.log('   1. Go to https://www.pinata.cloud/')
  console.log('   2. Click "Upload" → "File"')
  console.log('   3. Upload the zip file:', ZIP_FILE)
  console.log('   4. Pinata will extract it and give you a CID')
  console.log('   5. Update the contract baseURI with the new CID')
  console.log('')
} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}
