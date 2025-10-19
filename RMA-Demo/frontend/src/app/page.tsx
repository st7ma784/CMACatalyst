'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import NotesToCoA from '@/components/NotesToCoA'
import QRCodeGenerator from '@/components/QRCodeGenerator'
import AskTheManuals from '@/components/AskTheManuals'
import ClientDocumentSearch from '@/components/ClientDocumentSearch'
import Documentation from '@/components/Documentation'
import DebugVectorStore from '@/components/DebugVectorStore'
import { FileText, QrCode, BookOpen, Search, HelpCircle, LogIn, LogOut, RefreshCw, Bug } from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState('notes')
  const { isAuthenticated, username, logout, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/advisor-login')
    }
  }, [loading, isAuthenticated, router])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect in useEffect
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              RMA Dashboard
            </h1>
            <p className="text-gray-600">
              Risk Management Advice - Advisor Portal
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Logged in as: <span className="font-semibold">{username}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/advisor-dashboard">
              <Button variant="outline">
                View Client Uploads
              </Button>
            </Link>
            <Button 
              onClick={logout}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes to CoA
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Client QR Codes
            </TabsTrigger>
            <TabsTrigger value="client-search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search Client Docs
            </TabsTrigger>
            <TabsTrigger value="manuals" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Ask the Manuals
            </TabsTrigger>
            <TabsTrigger value="debug" className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Debug
            </TabsTrigger>
            <TabsTrigger value="docs" className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Documentation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes">
            <NotesToCoA />
          </TabsContent>

          <TabsContent value="qr">
            <QRCodeGenerator />
          </TabsContent>

          <TabsContent value="client-search">
            <ClientDocumentSearch />
          </TabsContent>

          <TabsContent value="manuals">
            <AskTheManuals />
          </TabsContent>

          <TabsContent value="debug">
            <DebugVectorStore />
          </TabsContent>

          <TabsContent value="docs">
            <Documentation />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
