/**
 * Grant VERIFIER_ROLE on Submission to one or more addresses (idempotent).
 *
 * Caller must hold DEFAULT_ADMIN_ROLE on Submission (deployer, Safe signer, or ADMIN_ROLE
 * holder if your deployment grants role admin — usually DEFAULT_ADMIN_ROLE).
 *
 * Usage (mainnet):
 *   VERIFIER_ADDRESS=0x50418699cb44bfda9c9afc9b7a0b0d244d8927d2 \
 *     npx hardhat run contracts/scripts/grant-verifier-role.ts --network celo
 *
 * Multiple addresses (comma-separated):
 *   VERIFIER_ADDRESSES=0x5041...,0x7D85... \
 *     npx hardhat run contracts/scripts/grant-verifier-role.ts --network celo
 *
 * Optional override:
 *   SETUP_SUBMISSION_ADDRESS=0x...
 */

import hre from 'hardhat'
import fs from 'fs'
import path from 'path'
import { isAddress } from 'viem'
import type { Address, Hex } from 'viem'

function parseVerifierAddresses(): Address[] {
  const raw =
    process.env.VERIFIER_ADDRESSES?.trim() ||
    process.env.VERIFIER_ADDRESS?.trim() ||
    ''
  if (!raw) {
    throw new Error(
      'Set VERIFIER_ADDRESS or VERIFIER_ADDRESSES (comma-separated 0x addresses).'
    )
  }
  const seen = new Set<string>()
  const out: Address[] = []
  for (const part of raw.split(',')) {
    const addr = part.trim()
    if (!addr) continue
    if (!isAddress(addr)) throw new Error(`Invalid address: ${addr}`)
    const lc = addr.toLowerCase()
    if (seen.has(lc)) continue
    seen.add(lc)
    out.push(addr as Address)
  }
  if (!out.length) throw new Error('No valid addresses in VERIFIER_ADDRESS(S)')
  return out
}

async function main() {
  const targets = parseVerifierAddresses()
  const [walletClient] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  const signer = walletClient.account.address as Address

  const deployedPath = path.join(__dirname, 'deployed_addresses.json')
  const deployed = JSON.parse(fs.readFileSync(deployedPath, 'utf8')) as { Submission?: Address }
  const submissionAddress = (process.env.SETUP_SUBMISSION_ADDRESS?.trim() ||
    deployed.Submission) as Address | undefined
  if (!submissionAddress) throw new Error('Submission address not found')

  const submission = await hre.viem.getContractAt('Submission', submissionAddress, {
    walletClient,
  })

  const DEFAULT_ADMIN_ROLE = (await submission.read.DEFAULT_ADMIN_ROLE()) as Hex
  const VERIFIER_ROLE = (await submission.read.VERIFIER_ROLE()) as Hex

  const canGrant = (await submission.read.hasRole([DEFAULT_ADMIN_ROLE, signer])) as boolean
  if (!canGrant) {
    throw new Error(
      `Signer ${signer} lacks DEFAULT_ADMIN_ROLE on Submission ${submissionAddress}. ` +
        'Use the deployer key, a Safe signer, or another admin account.'
    )
  }

  console.log('Network:', hre.network.name)
  console.log('Submission:', submissionAddress)
  console.log('Signer:', signer)
  console.log('Targets:', targets.join(', '))

  for (const target of targets) {
    const has = (await submission.read.hasRole([VERIFIER_ROLE, target])) as boolean
    if (has) {
      console.log(`✅ VERIFIER_ROLE already granted → ${target}`)
      continue
    }
    console.log(`⏳ grantRole(VERIFIER_ROLE) → ${target}`)
    const hash = await submission.write.grantRole([VERIFIER_ROLE, target], {
      account: walletClient.account,
    })
    await publicClient.waitForTransactionReceipt({ hash })
    console.log(`✅ Granted. Tx: ${hash}`)
  }

  for (const target of targets) {
    const ok = (await submission.read.hasRole([VERIFIER_ROLE, target])) as boolean
    console.log(`   ${target}: VERIFIER_ROLE=${ok}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
