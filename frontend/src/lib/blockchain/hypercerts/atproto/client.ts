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

async function getAgent(): Promise<AtpAgent> {
  if (agentInstance) return agentInstance
  if (loginPromise) return loginPromise

  loginPromise = (async () => {
    const agent = new AtpAgent({ service: getAtProtoPdsUrl() })
    await agent.login({
      identifier: getAtProtoHandle(),
      password: getAtProtoAppPassword(),
    })
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

export async function publishActivity(
  record: unknown,
): Promise<{ uri: string; cid: string }> {
  validateActivity(record)
  const agent = await getAgent()
  const response = await agent.com.atproto.repo.createRecord({
    repo: getAtProtoOrgDid(),
    collection: 'org.hypercerts.claim.activity',
    record: record as never,
  })
  const { uri, cid } = response as unknown as { uri: string; cid: string }
  return { uri, cid }
}

export async function publishAttachment(
  record: unknown,
  parent: StrongRef,
): Promise<{ uri: string; cid: string }> {
  validateAttachment(record)
  const agent = await getAgent()
  const response = await agent.com.atproto.repo.createRecord({
    repo: getAtProtoOrgDid(),
    collection: 'org.hypercerts.context.attachment',
    record: { ...(record as object), subjects: [parent] } as never,
  })
  const { uri, cid } = response as unknown as { uri: string; cid: string }
  return { uri, cid }
}

export async function publishMeasurement(
  record: unknown,
  parent: StrongRef,
): Promise<{ uri: string; cid: string }> {
  validateMeasurement(record)
  const agent = await getAgent()
  const response = await agent.com.atproto.repo.createRecord({
    repo: getAtProtoOrgDid(),
    collection: 'org.hypercerts.context.measurement',
    record: { ...(record as object), subjects: [parent] } as never,
  })
  const { uri, cid } = response as unknown as { uri: string; cid: string }
  return { uri, cid }
}

export async function publishEvaluation(
  record: unknown,
  parent: StrongRef,
): Promise<{ uri: string; cid: string }> {
  validateEvaluation(record)
  const agent = await getAgent()
  const response = await agent.com.atproto.repo.createRecord({
    repo: getAtProtoOrgDid(),
    collection: 'org.hypercerts.context.evaluation',
    record: { ...(record as object), subject: parent } as never,
  })
  const { uri, cid } = response as unknown as { uri: string; cid: string }
  return { uri, cid }
}

export { toStrongRef }
