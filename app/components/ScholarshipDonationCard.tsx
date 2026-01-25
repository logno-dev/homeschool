'use client'

import { useState } from 'react'
import Button from './Button'
import ScholarshipDonationModal from './ScholarshipDonationModal'

interface ScholarshipDonationCardProps {
  compact?: boolean
}

export default function ScholarshipDonationCard({ compact = false }: ScholarshipDonationCardProps) {
  const [showDonationModal, setShowDonationModal] = useState(false)

  return (
    <div className={`rounded-lg border border-indigo-200 bg-white ${compact ? 'p-4' : 'p-6'} shadow-sm`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Support the Scholarship Fund</h3>
      <p className="text-sm text-gray-600">
        Your donation helps families access classes and community support when they need it most.
      </p>
      <Button
        variant="primary"
        className="mt-4"
        onClick={() => setShowDonationModal(true)}
      >
        Donate Now
      </Button>
      <ScholarshipDonationModal
        isOpen={showDonationModal}
        onClose={() => setShowDonationModal(false)}
      />
    </div>
  )
}
