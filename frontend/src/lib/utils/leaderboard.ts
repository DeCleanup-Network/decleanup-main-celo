import { Address, formatEther } from 'viem'
import { getDCUBalance, getCleanupCounter, getCleanupDetails } from '@/lib/blockchain/contracts'

export interface LeaderboardUser {
  address: Address
  totalDCU: number
  country?: string
  cleanups: number
  rank: number
}

/**
 * Reverse geocode coordinates to country
 * Uses a simple API to get country from lat/lng
 */
async function getCountryFromCoordinates(lat: number, lng: number): Promise<string | undefined> {
  try {
    // Using a free geocoding service
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    )
    const data = await response.json()
    return data.countryName || data.countryCode || undefined
  } catch (error) {
    console.warn('Failed to geocode coordinates:', error)
    return undefined
  }
}

/**
 * Get leaderboard data - top 10 users by total cDCU
 */
export async function getLeaderboardData(): Promise<LeaderboardUser[]> {
  try {
    // Get all cleanup submissions to find unique users
    const cleanupCount = await getCleanupCounter()
    if (cleanupCount === BigInt(0)) {
      return []
    }

    // Collect unique users and their data
    const userMap = new Map<Address, {
      totalDCU: number
      cleanups: number
      coordinates: Array<{ lat: number; lng: number }>
    }>()

    // Fetch recent cleanups (last 100 to avoid too many calls)
    const maxCheck = 100
    const startId = cleanupCount > BigInt(maxCheck) ? cleanupCount - BigInt(maxCheck) : BigInt(1)
    
    for (let id = cleanupCount - BigInt(1); id >= startId && id >= BigInt(1); id--) {
      try {
        const details = await getCleanupDetails(id)
        const user = details.user
        
        if (!userMap.has(user)) {
          // Get user's total DCU balance
          let totalDCU = 0
          try {
            const balance = await getDCUBalance(user)
            
            // Ensure balance is a bigint
            let balanceBigInt: bigint
            if (typeof balance === 'bigint') {
              balanceBigInt = balance
            } else if (typeof balance === 'number') {
              // If it's already a number, it might be in wei format - convert to bigint first
              balanceBigInt = BigInt(Math.floor(balance))
            } else {
              balanceBigInt = BigInt(balance)
            }
            
            // Convert from wei (bigint) to ether (number) using formatEther
            // formatEther returns a string like "0.02", parse it to number
            const balanceString = formatEther(balanceBigInt)
            totalDCU = parseFloat(balanceString)
            
            // Safety check - if the number is unreasonably large, it means formatEther didn't work
            // In that case, manually divide by 1e18
            if (isNaN(totalDCU) || totalDCU > 1000000) {
              // Fallback: manual conversion from wei
              totalDCU = Number(balanceBigInt) / 1e18
              if (process.env.NODE_ENV === 'development') {
                console.warn(`DCU balance conversion issue for ${user}: using fallback. Raw: ${balanceBigInt.toString()}, Converted: ${totalDCU}`)
              }
            }
          } catch (error) {
            console.warn(`Failed to get DCU balance for ${user}:`, error)
            totalDCU = 0
          }


          userMap.set(user, {
            totalDCU,
            cleanups: 0,
            coordinates: [],
          })
        }

        const userData = userMap.get(user)!
        userData.cleanups++
        
        // Store coordinates for geocoding
        // Coordinates are stored as int256 scaled by 1e6
        const lat = Number(details.latitude)
        const lng = Number(details.longitude)
        if (lat !== 0 && lng !== 0) {
          userData.coordinates.push({
            lat: lat / 1e6, // Convert from scaled int
            lng: lng / 1e6,
          })
        }
      } catch (error) {
        console.warn(`Failed to fetch cleanup ${id}:`, error)
        // Continue with next cleanup
      }
    }

    // Convert to array and sort by total DCU
    const users = Array.from(userMap.entries()).map(([address, data]) => ({
      address,
      totalDCU: data.totalDCU,
      cleanups: data.cleanups,
      coordinates: data.coordinates,
    }))

    // Sort by total DCU (descending)
    users.sort((a, b) => b.totalDCU - a.totalDCU)

    // Get top 10
    const topUsers = users.slice(0, 10)

    // Geocode countries for top users (use most recent coordinates)
    const leaderboardUsers: LeaderboardUser[] = await Promise.all(
      topUsers.map(async (user, index) => {
        let country: string | undefined
        if (user.coordinates.length > 0) {
          // Use most recent coordinates
          const latestCoords = user.coordinates[user.coordinates.length - 1]
          country = await getCountryFromCoordinates(latestCoords.lat, latestCoords.lng)
        }

        return {
          address: user.address,
          totalDCU: user.totalDCU,
          country,
          cleanups: user.cleanups,
          rank: index + 1,
        }
      })
    )

    return leaderboardUsers
  } catch (error) {
    console.error('Error fetching leaderboard data:', error)
    return []
  }
}

