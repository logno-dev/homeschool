import { redirect } from 'next/navigation'
import { getSignInUrl } from '@workos-inc/authkit-nextjs'

export default async function SignIn() {
  const organizationId = process.env.WORKOS_ORGANIZATION_ID
  const signInUrl = await getSignInUrl({ organizationId })
  redirect(signInUrl)
}
