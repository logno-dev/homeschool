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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-lg shadow border-2 border-blue-200">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Family Profile</h3>
        <p className="text-gray-600 mb-4">Manage your family information, guardians, and children</p>
        <button
          onClick={() => router.push('/family/profile')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          View Profile
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border-2 border-orange-200">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Class Registration</h3>
        <p className="text-gray-600 mb-4">Register your children for published classes</p>
        <button
          onClick={() => router.push('/registration')}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          View Registration
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border-2 border-green-200">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Teacher Dashboard</h3>
        <p className="text-gray-600 mb-4">Register to teach classes and review schedules</p>
        <button
          onClick={() => router.push('/teacher')}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Teacher Dashboard
        </button>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Activities</h3>
        <p className="text-gray-600">Monitor cooperative activities and events</p>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow border-2 border-yellow-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Fees & Payments</h3>
        <FeesSummary />
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => router.push('/family/payments')}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-sm font-medium w-full"
          >
            View Payments
          </button>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow border-2 border-indigo-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Events</h3>
        <NextEvent />
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Resources</h3>
        <p className="text-gray-600">Access educational resources and materials</p>
      </div>
      
      {isAdmin && (
        <div className="bg-white p-6 rounded-lg shadow border-2 border-purple-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Admin Panel</h3>
          <p className="text-gray-600 mb-4">Manage families, users, and permissions</p>
          <button
            onClick={() => router.push('/admin')}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Access Admin
          </button>
        </div>
      )}
    </div>
  )
}