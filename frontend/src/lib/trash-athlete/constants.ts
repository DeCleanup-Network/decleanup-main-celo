/** Trash Athlete Challenge (global cleanup games) reward package. */
export const TRASH_ATHLETE_BONUS_CDCU = '150'
export const TRASH_ATHLETE_DCU_POINTS = 30
/**
 * First-time mint lands at level 1. If the user already has an Impact Product NFT,
 * they must call upgradeNFT once (+1 level) — Safe must not mint again.
 */
export const TRASH_ATHLETE_TARGET_LEVEL = 1
/** User-facing package description (mint L1 or upgrade +1). */
export const TRASH_ATHLETE_LEVEL_COPY = '+1 Impact Product level'

export const TRASH_ATHLETE_LABEL = 'Trash Athlete Challenge'

/** Ops checklist: mint vs tell-user-upgrade */
export const TRASH_ATHLETE_OPS_NOTE =
  'After approve: check Celoscan NFT balance for the signer. If 0 → Safe verifyPOI + mint. If >0 → tell user to Claim/Upgrade level once in the app (do not Safe-mint again).'
