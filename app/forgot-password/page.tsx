import Link from 'next/link'

export default function ForgotPassword() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-6 text-center">
        <h2 className="text-3xl font-extrabold text-gray-900">Reset your password</h2>
        <p className="text-sm text-gray-600">
          Password resets are handled through WorkOS. Continue to sign in to reset your password.
        </p>
        <Link
          href="/signin"
          className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Go to WorkOS Sign In
        </Link>
      </div>
    </div>
  )
}
