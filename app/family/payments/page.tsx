'use client'

import { useState } from 'react'
import FeesSummary from '@/app/components/FeesSummary'
import PaymentHistory from '@/app/components/PaymentHistory'

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<'fees' | 'history'>('fees')

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Family Payments</h1>
        <p className="text-gray-600">
          Manage your session fees and view payment history
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('fees')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'fees'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Outstanding Fees
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Payment History
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {activeTab === 'fees' && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Session Fees</h2>
              <p className="text-sm text-gray-600">
                View and pay outstanding fees for current and upcoming sessions
              </p>
            </div>
            <FeesSummary />
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <PaymentHistory />
          </div>
        )}
      </div>

      {/* Help Section */}
          {/* Help Section */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="text-blue-600 text-xl">ℹ️</div>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Payment Information</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Payments are processed securely using mock Stripe integration</li>
                    <li>You can make partial payments if needed</li>
                    <li>Payment confirmations are sent via email</li>
                    <li>For questions about fees or payments, contact the office</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}