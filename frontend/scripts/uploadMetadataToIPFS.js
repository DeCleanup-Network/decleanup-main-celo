/**
 * Upload Impact Product metadata folder to IPFS using Pinata
 * 
 * NOTE: Pinata's API has limitations with multiple files. 
 * For best results, use the manual upload method:
 *   1. Go to https://www.pinata.cloud/
 *   2. Upload the metadata/impact-products/ folder directly
 *   3. Get the CID and update the contract baseURI
 * 
 * This script attempts to upload but may fail due to API limitations.
 * 
 * Usage:
 *   node scripts/uploadMetadataToIPFS.js
 * 
 * Prerequisites:
 *   - Set PINATA_API_KEY and PINATA_SECRET_KEY in .env.local (or pass as env vars)
 *   - The metadata/impact-products/ folder must exist with all level JSON files
 */

const fs = require('fs')
const path = require('path')

// Try to load .env.local manually
try {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim().replace(/^["']|["']$/g, '')
        process.env[key] = value
      }
    })
  }
} catch (error) {
  console.warn('Could not load .env.local:', error.message)
}

const PINATA_API_KEY = process.env.PINATA_API_KEY
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY

const METADATA_DIR = path.join(__dirname, '..', 'metadata', 'impact-products')

async function uploadFolderToPinata() {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    throw new Error('Pinata API keys not found. Set PINATA_API_KEY and PINATA_SECRET_KEY in .env.local')
  }

  // Check if metadata directory exists
  if (!fs.existsSync(METADATA_DIR)) {
    throw new Error(`Metadata directory not found: ${METADATA_DIR}`)
  }

  // Get all JSON files
  const files = fs.readdirSync(METADATA_DIR)
    .filter(file => file.endsWith('.json'))
    .sort()

  if (files.length === 0) {
    throw new Error('No JSON files found in metadata directory')
  }

  console.log(`Found ${files.length} metadata files:`)
  files.forEach(file => console.log(`  - ${file}`))
  console.log('')

  // Use form-data package for proper multi-file upload
  const FormData = require('form-data')
  const formData = new FormData()
  
  // Pinata requires files to be uploaded with their directory path when using wrapWithDirectory
  // We'll upload them at the root level by using the filename as the path
  files.forEach(file => {
    const filePath = path.join(METADATA_DIR, file)
    const fileStream = fs.createReadStream(filePath)
    // Use the filename as the filepath so files are at root level
    formData.append('file', fileStream, {
      filepath: file, // This makes files appear at root: level1.json, level2.json, etc.
    })
  })

  // Add metadata
  const metadata = JSON.stringify({
    name: 'DeCleanup Impact Product Metadata',
    keyvalues: {
      type: 'nft-metadata',
      version: '2.0',
      timestamp: new Date().toISOString(),
    },
  })
  formData.append('pinataMetadata', metadata)

  // Add options - wrap with directory to create a proper directory structure
  const options = JSON.stringify({
    cidVersion: 1,
    wrapWithDirectory: true, // Wrap to create a directory
  })
  formData.append('pinataOptions', options)

  console.log('Uploading to Pinata...')
  
  try {
    const headers = {
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_KEY,
      ...formData.getHeaders(), // form-data package provides getHeaders()
    }
    
    // Use node-fetch or native fetch with proper stream handling
    const fetch = (() => {
      try {
        return require('node-fetch')
      } catch (e) {
        // Fallback to global fetch (Node 18+)
        if (global.fetch) {
          return global.fetch
        }
        throw new Error('fetch not available. Install node-fetch: npm install node-fetch')
      }
    })()
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: headers,
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Pinata upload error:', errorData)
      throw new Error(`Failed to upload to Pinata: ${errorData.error?.reason || response.statusText}`)
    }

    const data = await response.json()
    const ipfsHash = data.IpfsHash

    if (!ipfsHash) {
      throw new Error('No IPFS hash returned from Pinata')
    }

    console.log('')
    console.log('✅ Upload successful!')
    console.log('')
    console.log('📋 IPFS CID:', ipfsHash)
    console.log('📋 Base URI:', `ipfs://${ipfsHash}/`)
    console.log('')
    console.log('🌐 Test URLs (with wrapWithDirectory, files are at root):')
    console.log(`   Level 1: https://gateway.pinata.cloud/ipfs/${ipfsHash}/level1.json`)
    console.log(`   Level 10: https://gateway.pinata.cloud/ipfs/${ipfsHash}/level10.json`)
    console.log('')
    console.log('📝 Next steps:')
    console.log('   1. Update the contract baseURI:')
    console.log(`      cd contracts`)
    console.log(`      NEW_BASE_URI=ipfs://${ipfsHash}/ npx hardhat run scripts/updateBaseURI.js --network sepolia`)
    console.log('')
    console.log('   ⚠️  Note: With wrapWithDirectory: true, the CID points to a directory')
    console.log('      containing the files. Use: ipfs://CID/ (with trailing slash)')
    console.log('      The contract will append "level1.json", "level2.json", etc.')
    console.log('')
    console.log('   2. Update .env.local:')
    console.log(`      NEXT_PUBLIC_IMPACT_METADATA_CID=${ipfsHash}`)
    console.log('')

    return ipfsHash
  } catch (error) {
    console.error('❌ Upload failed:', error.message)
    throw error
  }
}

uploadFolderToPinata()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

