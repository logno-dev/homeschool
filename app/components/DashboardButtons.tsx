'use client'

import { useRouter } from 'next/navigation'
import FeesSummary from './FeesSummary'
import NextEvent from './NextEvent'

interface DashboardButtonsProps {
  isAdmin: boolean
}

export default function DashboardButtons({ isAdmin }: DashboardButtonsProps) {
  const router = useRouter()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow border-2 border-blue-200 hover:shadow-md transition-shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Family Profile</h3>
        <p className="text-gray-600 mb-4 text-sm sm:text-base">Manage your family information, guardians, and children</p>
        <button
          onClick={() => router.push('/family/profile')}
          className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 sm:py-2 rounded-md text-base sm:text-sm font-medium w-full sm:w-auto touch-manipulation transition-colors"
        >
          View Profile
        </button>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow border-2 border-orange-200 hover:shadow-md transition-shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Class Registration</h3>
        <p className="text-gray-600 mb-4 text-sm sm:text-base">Register your children for published classes</p>
        <button
          onClick={() => router.push('/registration')}
          className="bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white px-4 py-3 sm:py-2 rounded-md text-base sm:text-sm font-medium w-full sm:w-auto touch-manipulation transition-colors"
        >
          View Registration
        </button>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow border-2 border-green-200 hover:shadow-md transition-shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Teacher Dashboard</h3>
        <p className="text-gray-600 mb-4 text-sm sm:text-base">Register to teach classes and review schedules</p>
        <button
          onClick={() => router.push('/teacher')}
          className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-4 py-3 sm:py-2 rounded-md text-base sm:text-sm font-medium w-full sm:w-auto touch-manipulation transition-colors"
        >
          Teacher Dashboard
        </button>
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow hover:shadow-md transition-shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Activities</h3>
        <p className="text-gray-600 text-sm sm:text-base">Monitor cooperative activities and events</p>
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow border-2 border-yellow-200 hover:shadow-md transition-shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Fees & Payments</h3>
        <FeesSummary />
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => router.push('/family/payments')}
            className="bg-yellow-600 hover:bg-yellow-700 active:bg-yellow-800 text-white px-4 py-3 sm:py-2 rounded-md text-base sm:text-sm font-medium w-full touch-manipulation transition-colors"
          >
            View Payments
          </button>
        </div>
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow border-2 border-indigo-200 hover:shadow-md transition-shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Events</h3>
        <NextEvent />
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow hover:shadow-md transition-shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Resources</h3>
        <p className="text-gray-600 text-sm sm:text-base">Access educational resources and materials</p>
      </div>
      
      {isAdmin && (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow border-2 border-purple-200 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Admin Panel</h3>
          <p className="text-gray-600 mb-4 text-sm sm:text-base">Manage families, users, and permissions</p>
          <button
            onClick={() => router.push('/admin')}
            className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-4 py-3 sm:py-2 rounded-md text-base sm:text-sm font-medium w-full sm:w-auto touch-manipulation transition-colors"
          >
            Access Admin
          </button>
        </div>
      )}
    </div>
  )
}