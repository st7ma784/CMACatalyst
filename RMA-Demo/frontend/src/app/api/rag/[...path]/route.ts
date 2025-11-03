import { NextRequest, NextResponse } from 'next/server'

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://rag-service:8102'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/')
  const url = `${RAG_SERVICE_URL}/${path}${request.nextUrl.search}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        })
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('RAG proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy request to RAG service' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/')
  const url = `${RAG_SERVICE_URL}/${path}${request.nextUrl.search}`
  const body = await request.json()

  try {
    // Create an AbortController with a 5 minute timeout for long-running queries
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minutes

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        })
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('RAG proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy request to RAG service' },
      { status: 500 }
    )
  }
}
