import { redirect } from 'next/navigation'
import { getSignUpUrl } from '@workos-inc/authkit-nextjs'

export default async function SignUp() {
  const organizationId = process.env.WORKOS_ORGANIZATION_ID
  const signUpUrl = await getSignUpUrl({ organizationId })
  redirect(signUpUrl)
}
