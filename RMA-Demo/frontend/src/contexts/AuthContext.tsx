'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface AuthContextType {
  isAuthenticated: boolean
  username: string | null
  token: string | null
  login: (username: string, token: string) => void
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Check for existing token on mount
    const storedToken = localStorage.getItem('advisor_token')
    const storedUsername = localStorage.getItem('advisor_username')
    
    if (storedToken && storedUsername) {
      setIsAuthenticated(true)
      setUsername(storedUsername)
      setToken(storedToken)
    }
    
    setLoading(false)
  }, [])

  useEffect(() => {
    // Redirect logic for protected routes
    if (!loading && !isAuthenticated) {
      const publicRoutes = ['/advisor-login', '/client-upload']
      const isPublicRoute = publicRoutes.some(route => 
        pathname?.startsWith(route)
      )
      
      // If not authenticated and not on a public route, redirect to login
      if (pathname && !isPublicRoute && pathname !== '/advisor-login') {
        router.push('/advisor-login')
      }
    }
  }, [isAuthenticated, loading, pathname, router])

  const login = (username: string, token: string) => {
    localStorage.setItem('advisor_token', token)
    localStorage.setItem('advisor_username', username)
    setIsAuthenticated(true)
    setUsername(username)
    setToken(token)
  }

  const logout = () => {
    localStorage.removeItem('advisor_token')
    localStorage.removeItem('advisor_username')
    setIsAuthenticated(false)
    setUsername(null)
    setToken(null)
    router.push('/advisor-login')
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
