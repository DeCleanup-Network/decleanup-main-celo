import 'next-auth'

declare module 'next-auth' {
  interface Session {
    /** Set on sign-in: google | email (embedded smart account). MetaMask does not use Auth.js. */
    authProvider?: string
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub?: string
    authProvider?: string
  }
}
