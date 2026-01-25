import { getAuthenticatedUser } from '@/lib/server-auth'
import ScholarshipApplicationForm from '@/app/components/ScholarshipApplicationForm'
import ScholarshipDonationCard from '@/app/components/ScholarshipDonationCard'

export default async function ResourcesPage() {
  await getAuthenticatedUser()

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Resources</h1>
            <p className="text-gray-600">Find internal tools and trusted resources for families.</p>
          </div>

          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Internal Resources</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Scholarship Application</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Request fee assistance through the scholarship fund for your current session fees.
                </p>
                <ScholarshipApplicationForm />
              </div>
              <ScholarshipDonationCard />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">External Resources</h2>
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <ul className="space-y-3 text-sm text-gray-700">
                <li>
                  <a className="text-blue-600 hover:text-blue-700 font-medium" href="https://www.khanacademy.org" target="_blank" rel="noreferrer">
                    Khan Academy
                  </a>
                  <span className="block text-xs text-gray-500">Free lessons and practice across subjects.</span>
                </li>
                <li>
                  <a className="text-blue-600 hover:text-blue-700 font-medium" href="https://www.readworks.org" target="_blank" rel="noreferrer">
                    ReadWorks
                  </a>
                  <span className="block text-xs text-gray-500">Reading passages and comprehension support.</span>
                </li>
                <li>
                  <a className="text-blue-600 hover:text-blue-700 font-medium" href="https://www.nationalgeographic.com/education" target="_blank" rel="noreferrer">
                    National Geographic Education
                  </a>
                  <span className="block text-xs text-gray-500">Science, geography, and exploration resources.</span>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
