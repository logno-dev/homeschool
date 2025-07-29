'use client'

import { useRouter } from 'next/navigation'

export default function FamilyRegistrationOptions() {
  const router = useRouter()

  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to DVCLC!</h2>
        <p className="text-lg text-gray-600 mb-8">
          You're not currently associated with a family. Choose an option below to get started.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow border-2 border-blue-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Register New Family</h3>
            <p className="text-gray-600 mb-4">
              Create a new family profile and get a sharing code for other guardians.
            </p>
            <button
              onClick={() => router.push('/family/register')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium"
            >
              Register Family
            </button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border-2 border-green-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Join Existing Family</h3>
            <p className="text-gray-600 mb-4">
              Use a sharing code from another guardian to join their family profile.
            </p>
            <button
              onClick={() => router.push('/family/join')}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md font-medium"
            >
              Join Family
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}