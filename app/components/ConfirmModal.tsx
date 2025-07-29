'use client'

import Modal from './Modal'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'danger' | 'primary' | 'warning'
  isLoading?: boolean
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  isLoading = false
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm()
  }

  const getConfirmButtonStyles = () => {
    switch (confirmVariant) {
      case 'danger':
        return {
          backgroundColor: '#dc2626',
          color: 'white',
          borderColor: '#b91c1c'
        }
      case 'warning':
        return {
          backgroundColor: '#ea580c',
          color: 'white',
          borderColor: '#c2410c'
        }
      case 'primary':
      default:
        return {
          backgroundColor: '#2563eb',
          color: 'white',
          borderColor: '#1d4ed8'
        }
    }
  }

  const getConfirmButtonHoverStyles = () => {
    switch (confirmVariant) {
      case 'danger':
        return '#b91c1c'
      case 'warning':
        return '#c2410c'
      case 'primary':
      default:
        return '#1d4ed8'
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-gray-600">
          {message}
        </p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors border"
            style={getConfirmButtonStyles()}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = getConfirmButtonHoverStyles()
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = getConfirmButtonStyles().backgroundColor
              }
            }}
          >
            {isLoading ? 'Loading...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}