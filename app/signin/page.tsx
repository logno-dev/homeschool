import Link from 'next/link'
import { getSignInUrl, getSignUpUrl } from '@workos-inc/authkit-nextjs'

export default async function SignIn() {
  const signInUrl = await getSignInUrl()
  const signUpUrl = await getSignUpUrl()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Use your WorkOS credentials to access DVCLC.
          </p>
        </div>

        <div className="space-y-4">
          <a
            href={signInUrl}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Sign in with WorkOS
          </a>
          <a
            href={signUpUrl}
            className="w-full flex justify-center py-2 px-4 border border-indigo-200 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create an account
          </a>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-500">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
