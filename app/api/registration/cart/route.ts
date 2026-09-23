import { NextResponse } from 'next/server'
import { getFamilyRegistrationCart } from '@/lib/registration-cart'
import { getAuthenticatedUserSession } from '@/lib/server-auth'

export async function GET() {
  const auth = await getAuthenticatedUserSession()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const cart = await getFamilyRegistrationCart(auth.session.user.id)
  return NextResponse.json(cart, { headers: { 'Cache-Control': 'no-store' } })
}
