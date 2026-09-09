export type TrashAthleteStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type TrashAthleteLevelGrantStatus = 'pending' | 'granted' | 'skipped'

export type TrashAthleteChallenge = {
  id: string
  userId: string | null
  /** Signer EOA (import / MetaMask address). Not the smart account. */
  walletAddress: string
  email: string | null
  username: string
  socialProfileUrl: string
  notes: string | null
  status: TrashAthleteStatus
  submittedAt: number
  reviewedAt: number | null
  reviewedBy: string | null
  rejectionReason: string | null
  bonusCdcuAmount: string
  bonusCdcuClaimed: boolean
  bonusCdcuClaimTx: string | null
  levelTarget: number
  dcuPointsAmount: number
  levelGrantStatus: TrashAthleteLevelGrantStatus
}
