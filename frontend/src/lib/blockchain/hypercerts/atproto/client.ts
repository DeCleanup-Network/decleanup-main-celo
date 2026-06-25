import { AtpAgent } from '@atproto/api'
import {
  getAtProtoAppPassword,
  getAtProtoHandle,
  getAtProtoOrgDid,
  getAtProtoPdsUrl,
} from '../config'
import {
  validateActivity,
  validateAttachment,
  validateEvaluation,
  validateMeasurement,
} from './validation'

let agentInstance: AtpAgent | null = null
let loginPromise: Promise<AtpAgent> | null = null

export type AtProtoConnectionStatus = {
  ok: boolean
  pdsUrl: string
  handle: string
  configuredDid: string
  sessionDid?: string
  didMatch?: boolean
  error?: string
}

function formatAtProtoError(err: unknown): string {
  if (err instanceof Error) {
    const e = err as Error & {
      status?: number
      error?: string
      message?: string
    }
    const parts: string[] = []
    if (e.error) parts.push(String(e.error))
    if (e.status) parts.push(`HTTP ${e.status}`)
    if (e.message && !parts.includes(e.message)) parts.push(e.message)
    return parts.length > 0 ? parts.join(': ') : String(err)
  }
  return String(err)
}

function resolveRepoDid(agent: AtpAgent): string {
  const sessionDid = agent.did?.trim()
  if (!sessionDid) {
    throw new Error('AT Protocol session has no DID after login')
  }

  const configuredDid = getAtProtoOrgDid().trim()
  if (configuredDid && configuredDid !== sessionDid) {
    throw new Error(
      `HYPERCERTS_ATPROTO_DID (${configuredDid}) does not match AT login DID (${sessionDid}). ` +
        'Use an app password for the org handle that owns that DID, or update HYPERCERTS_ATPROTO_DID.'
    )
  }

  return sessionDid
}

function createAtpAgent(): AtpAgent {
  const pdsUrl = getAtProtoPdsUrl()
  try {
    return new AtpAgent({ service: pdsUrl })
  } catch (err) {
    throw new Error(
      `AT Protocol PDS URL is invalid (${pdsUrl}): ${formatAtProtoError(err)}. ` +
        'Set HYPERCERTS_ATPROTO_PDS_URL to https://pds.certified.app (include https://).'
    )
  }
}

async function getAgent(): Promise<AtpAgent> {
  if (agentInstance) return agentInstance
  if (loginPromise) return loginPromise

  loginPromise = (async () => {
    const agent = createAtpAgent()
    try {
      await agent.login({
        identifier: getAtProtoHandle(),
        password: getAtProtoAppPassword(),
      })
    } catch (err) {
      throw new Error(`AT Protocol login failed: ${formatAtProtoError(err)}`)
    }

    resolveRepoDid(agent)
    agentInstance = agent
    return agent
  })()

  try {
    return await loginPromise
  } finally {
    loginPromise = null
  }
}

/** Login test for diagnostics — does not publish. */
export async function testAtProtoConnection(): Promise<AtProtoConnectionStatus> {
  const configuredDid = getAtProtoOrgDid().trim()
  const handle = getAtProtoHandle().trim()
  const pdsUrl = getAtProtoPdsUrl()

  try {
    const agent = createAtpAgent()
    await agent.login({
      identifier: handle,
      password: getAtProtoAppPassword(),
    })
    const sessionDid = agent.did?.trim()
    const didMatch = Boolean(sessionDid && configuredDid && sessionDid === configuredDid)

    if (!sessionDid) {
      return {
        ok: false,
        pdsUrl,
        handle,
        configuredDid,
        error: 'Login succeeded but session returned no DID',
      }
    }

    if (configuredDid && !didMatch) {
      return {
        ok: false,
        pdsUrl,
        handle,
        configuredDid,
        sessionDid,
        didMatch: false,
        error:
          `HYPERCERTS_ATPROTO_DID (${configuredDid}) does not match login DID (${sessionDid}). ` +
          'Fix env or use credentials for the org account that owns the configured DID.',
      }
    }

    return { ok: true, pdsUrl, handle, configuredDid: configuredDid || sessionDid, sessionDid, didMatch: true }
  } catch (err) {
    return {
      ok: false,
      pdsUrl,
      handle,
      configuredDid,
      error: formatAtProtoError(err),
    }
  }
}

export interface StrongRef {
  $type: 'com.atproto.repo.strongRef'
  uri: string
  cid: string
}

function toStrongRef(uri: string, cid: string): StrongRef {
  return { $type: 'com.atproto.repo.strongRef', uri, cid }
}

function extractCreateRecordResult(response: unknown): { uri: string; cid: string } {
  const data = (response as { data?: { uri?: string; cid?: string } })?.data
  if (!data?.uri || !data?.cid) {
    throw new Error('PDS createRecord succeeded but returned no uri/cid')
  }
  return { uri: data.uri, cid: data.cid }
}

export async function publishActivity(
  record: unknown,
): Promise<{ uri: string; cid: string }> {
  validateActivity(record)
  const agent = await getAgent()
  const repo = resolveRepoDid(agent)
  try {
    const response = await agent.com.atproto.repo.createRecord({
      repo,
      collection: 'org.hypercerts.claim.activity',
      record: record as never,
    })
    return extractCreateRecordResult(response)
  } catch (err) {
    throw new Error(`PDS activity publish failed: ${formatAtProtoError(err)}`)
  }
}

export async function publishAttachment(
  record: unknown,
  parent: StrongRef,
): Promise<{ uri: string; cid: string }> {
  validateAttachment(record)
  const agent = await getAgent()
  const repo = resolveRepoDid(agent)
  try {
    const response = await agent.com.atproto.repo.createRecord({
      repo,
      collection: 'org.hypercerts.context.attachment',
      record: { ...(record as object), subjects: [parent] } as never,
    })
    return extractCreateRecordResult(response)
  } catch (err) {
    throw new Error(formatAtProtoError(err))
  }
}

export async function publishMeasurement(
  record: unknown,
  parent: StrongRef,
): Promise<{ uri: string; cid: string }> {
  validateMeasurement(record)
  const agent = await getAgent()
  const repo = resolveRepoDid(agent)
  try {
    const response = await agent.com.atproto.repo.createRecord({
      repo,
      collection: 'org.hypercerts.context.measurement',
      record: { ...(record as object), subjects: [parent] } as never,
    })
    return extractCreateRecordResult(response)
  } catch (err) {
    throw new Error(formatAtProtoError(err))
  }
}

export async function publishEvaluation(
  record: unknown,
  parent: StrongRef,
): Promise<{ uri: string; cid: string }> {
  validateEvaluation(record)
  const agent = await getAgent()
  const repo = resolveRepoDid(agent)
  try {
    const response = await agent.com.atproto.repo.createRecord({
      repo,
      collection: 'org.hypercerts.context.evaluation',
      record: { ...(record as object), subject: parent } as never,
    })
    return extractCreateRecordResult(response)
  } catch (err) {
    throw new Error(formatAtProtoError(err))
  }
}

export { toStrongRef }
