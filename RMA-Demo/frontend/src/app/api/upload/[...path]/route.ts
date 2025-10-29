import { NextRequest, NextResponse } from 'next/server'

const UPLOAD_SERVICE_URL = process.env.UPLOAD_SERVICE_URL || 'http://upload-service:8103'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/')
  const url = `${UPLOAD_SERVICE_URL}/${path}${request.nextUrl.search}`

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
    console.error('Upload proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy request to upload service' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/')
  const url = `${UPLOAD_SERVICE_URL}/${path}${request.nextUrl.search}`
  const body = await request.json()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        })
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Upload proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy request to upload service' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/')
  const url = `${UPLOAD_SERVICE_URL}/${path}${request.nextUrl.search}`

  try {
    const response = await fetch(url, {
      method: 'DELETE',
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
    console.error('Upload proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy request to upload service' },
      { status: 500 }
    )
  }
}
