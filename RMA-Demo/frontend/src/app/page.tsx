'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import NotesToCoA from '@/components/NotesToCoA'
import QRCodeGenerator from '@/components/QRCodeGenerator'
import AskTheManuals from '@/components/AskTheManuals'
import Documentation from '@/components/Documentation'
import { FileText, QrCode, BookOpen, HelpCircle } from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState('notes')

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            RMA Dashboard
          </h1>
          <p className="text-gray-600">
            Risk Management Advice - Client Portal
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes to CoA
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Client QR Codes
            </TabsTrigger>
            <TabsTrigger value="manuals" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Ask the Manuals
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

          <TabsContent value="manuals">
            <AskTheManuals />
          </TabsContent>

          <TabsContent value="docs">
            <Documentation />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
