import { redirect } from 'next/navigation'
import { getSignUpUrl } from '@workos-inc/authkit-nextjs'

export default async function SignUp() {
  const signUpUrl = await getSignUpUrl()
  redirect(signUpUrl)
}
