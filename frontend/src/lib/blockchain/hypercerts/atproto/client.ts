import { Agent, CredentialSession } from '@atproto/api'
import {
  getAtProtoAppPassword,
  getAtProtoHandle,
  getAtProtoLoginService,
  getAtProtoOrgDid,
} from '../config'
import {
  validateActivity,
  validateAttachment,
  validateEvaluation,
  validateMeasurement,
} from './validation'

let agentInstance: Agent | null = null
let loginPromise: Promise<Agent> | null = null

export type AtProtoConnectionStatus = {
  ok: boolean
  /** Handle-resolver / login entry point (e.g. bsky.social for Bluesky accounts). */
  loginService: string
  /** Account home PDS after login (from session). */
  homePdsUrl?: string
  /** @deprecated Use loginService */
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

function resolveRepoDid(agent: Agent): string {
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

async function loginAgent(): Promise<Agent> {
  const loginService = getAtProtoLoginService()
  const session = new CredentialSession(new URL(loginService))
  try {
    await session.login({
      identifier: getAtProtoHandle(),
      password: getAtProtoAppPassword(),
    })
  } catch (err) {
    throw new Error(
      `AT Protocol login failed (${loginService}): ${formatAtProtoError(err)}. ` +
        'Use an app password for the configured handle (not your account login password).'
    )
  }

  const agent = new Agent(session)
  resolveRepoDid(agent)
  return agent
}

async function getAgent(): Promise<Agent> {
  if (agentInstance) return agentInstance
  if (loginPromise) return loginPromise

  loginPromise = loginAgent().then((agent) => {
    agentInstance = agent
    return agent
  })

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
  const loginService = getAtProtoLoginService()

  try {
    const session = new CredentialSession(new URL(loginService))
    await session.login({
      identifier: handle,
      password: getAtProtoAppPassword(),
    })
    const agent = new Agent(session)
    const sessionDid = agent.did?.trim()
    const didMatch = Boolean(sessionDid && configuredDid && sessionDid === configuredDid)
    const homePdsUrl = session.pdsUrl?.href

    if (!sessionDid) {
      return {
        ok: false,
        loginService,
        pdsUrl: loginService,
        homePdsUrl,
        handle,
        configuredDid,
        error: 'Login succeeded but session returned no DID',
      }
    }

    if (configuredDid && !didMatch) {
      return {
        ok: false,
        loginService,
        pdsUrl: loginService,
        homePdsUrl,
        handle,
        configuredDid,
        sessionDid,
        didMatch: false,
        error:
          `HYPERCERTS_ATPROTO_DID (${configuredDid}) does not match login DID (${sessionDid}). ` +
          'Fix env or use credentials for the org account that owns the configured DID.',
      }
    }

    return {
      ok: true,
      loginService,
      pdsUrl: loginService,
      homePdsUrl,
      handle,
      configuredDid: configuredDid || sessionDid,
      sessionDid,
      didMatch: true,
    }
  } catch (err) {
    return {
      ok: false,
      loginService,
      pdsUrl: loginService,
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
