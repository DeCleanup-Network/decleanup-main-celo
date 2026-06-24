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

function formatAtProtoError(err: unknown): string {
  if (err instanceof Error) {
    const e = err as Error & { status?: number; error?: string }
    const code = e.status ?? e.error
    if (code) return `PDS error (${code}): ${e.message}`
    return e.message
  }
  return String(err)
}

async function getAgent(): Promise<AtpAgent> {
  if (agentInstance) return agentInstance
  if (loginPromise) return loginPromise

  loginPromise = (async () => {
    const agent = new AtpAgent({ service: getAtProtoPdsUrl() })
    try {
      await agent.login({
        identifier: getAtProtoHandle(),
        password: getAtProtoAppPassword(),
      })
    } catch (err) {
      throw new Error(`AT Protocol login failed: ${formatAtProtoError(err)}`)
    }
    agentInstance = agent
    return agent
  })()

  try {
    return await loginPromise
  } finally {
    loginPromise = null
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
  try {
    const response = await agent.com.atproto.repo.createRecord({
      repo: getAtProtoOrgDid(),
      collection: 'org.hypercerts.claim.activity',
      record: record as never,
    })
    return extractCreateRecordResult(response)
  } catch (err) {
    throw new Error(formatAtProtoError(err))
  }
}

export async function publishAttachment(
  record: unknown,
  parent: StrongRef,
): Promise<{ uri: string; cid: string }> {
  validateAttachment(record)
  const agent = await getAgent()
  try {
    const response = await agent.com.atproto.repo.createRecord({
      repo: getAtProtoOrgDid(),
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
  try {
    const response = await agent.com.atproto.repo.createRecord({
      repo: getAtProtoOrgDid(),
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
  try {
    const response = await agent.com.atproto.repo.createRecord({
      repo: getAtProtoOrgDid(),
      collection: 'org.hypercerts.context.evaluation',
      record: { ...(record as object), subject: parent } as never,
    })
    return extractCreateRecordResult(response)
  } catch (err) {
    throw new Error(formatAtProtoError(err))
  }
}

export { toStrongRef }
