import { redirect } from 'next/navigation'
import { getSignInUrl } from '@workos-inc/authkit-nextjs'

export default async function SignIn() {
  const signInUrl = await getSignInUrl()
  redirect(signInUrl)
}
