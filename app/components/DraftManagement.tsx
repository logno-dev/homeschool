'use client'

import { useState, useEffect } from 'react'
import { useToast } from './ToastContainer'
import Modal from './Modal'
import ConfirmModal from './ConfirmModal'

interface Draft {
  id: string
  sessionId: string
  createdBy: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  creator: {
    firstName: string
    lastName: string
  }
  entryCount: number
}

interface Conflict {
  classroomId: string
  period: string
  conflictingDrafts: Array<{
    draftId: string
    draftName: string
    creatorName: string
    classTeachingRequestId: string
    className: string
  }>
}

interface DraftManagementProps {
  sessionId: string
  isOpen: boolean
  onClose: () => void
  onDraftSelected: (draftId: string) => void
  currentDraftId?: string | null
}

export default function DraftManagement({ 
  sessionId, 
  isOpen, 
  onClose, 
  onDraftSelected,
  currentDraftId 
}: DraftManagementProps) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [draftToDelete, setDraftToDelete] = useState<Draft | null>(null)
  const [newDraftName, setNewDraftName] = useState('')
  const [newDraftDescription, setNewDraftDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  
  const { showSuccess, showError } = useToast()

  useEffect(() => {
    if (isOpen) {
      fetchDrafts()
    }
  }, [isOpen, sessionId])

  const fetchDrafts = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/schedule/${sessionId}/drafts`)
      if (response.ok) {
        const data = await response.json()
        setDrafts(data.drafts)
        setConflicts(data.conflicts)
      } else {
        showError('Failed to fetch drafts')
      }
    } catch (error) {
      console.error('Error fetching drafts:', error)
      showError('Failed to fetch drafts')
    } finally {
      setIsLoading(false)
    }
  }

  const createDraft = async () => {
    if (!newDraftName.trim()) {
      showError('Draft name is required')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch(`/api/admin/schedule/${sessionId}/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newDraftName.trim(),
          description: newDraftDescription.trim() || undefined
        }),
      })

      if (response.ok) {
        const data = await response.json()
        showSuccess('Draft created successfully')
        setNewDraftName('')
        setNewDraftDescription('')
        setShowCreateForm(false)
        await fetchDrafts()
        onDraftSelected(data.draft.id)
      } else {
        showError('Failed to create draft')
      }
    } catch (error) {
      console.error('Error creating draft:', error)
      showError('Failed to create draft')
    } finally {
      setIsCreating(false)
    }
  }

  const deleteDraft = async () => {
    if (!draftToDelete) return

    try {
      const response = await fetch(`/api/admin/schedule/${sessionId}/drafts/${draftToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        showSuccess('Draft deleted successfully')
        setShowDeleteModal(false)
        setDraftToDelete(null)
        await fetchDrafts()
        
        // If the deleted draft was the current one, we'll need to reload
        // The parent component should handle loading another draft
        if (currentDraftId === draftToDelete.id) {
          // The parent will need to handle this case by loading another draft
          window.location.reload() // Temporary solution - parent should handle this better
        }
      } else {
        showError('Failed to delete draft')
      }
    } catch (error) {
      console.error('Error deleting draft:', error)
      showError('Failed to delete draft')
    }
  }

  const selectDraft = (draftId: string) => {
    onDraftSelected(draftId)
    onClose()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDraftConflicts = (draftId: string) => {
    return conflicts.filter(conflict => 
      conflict.conflictingDrafts.some(draft => draft.draftId === draftId)
    )
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Manage Schedule Drafts"
        size="xl"
      >
        <div className="space-y-6">
          {/* Header with Create Button */}
          <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Schedule Drafts</h3>
                <p className="text-sm text-gray-600">
                  Create alternative schedule versions when multiple people are working on different arrangements
                </p>
              </div>            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Create New Draft
            </button>
          </div>

          {/* Conflicts Alert */}
          {conflicts.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Schedule Conflicts Detected
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>{conflicts.length} conflict(s) found between drafts. Multiple people have assigned different classes to the same time slots. Review and choose the preferred arrangement.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create Form */}
          {showCreateForm && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <h4 className="text-md font-medium text-gray-900 mb-3">Create New Draft</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Draft Name *
                  </label>
                  <input
                    type="text"
                    value={newDraftName}
                    onChange={(e) => setNewDraftName(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., John's Schedule v1"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={newDraftDescription}
                    onChange={(e) => setNewDraftDescription(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Brief description of this draft..."
                    rows={2}
                    maxLength={500}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={createDraft}
                    disabled={isCreating || !newDraftName.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCreating ? 'Creating...' : 'Create Draft'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false)
                      setNewDraftName('')
                      setNewDraftDescription('')
                    }}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Drafts List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading drafts...</p>
              </div>
            ) : drafts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No drafts found. Create your first draft to get started.</p>
              </div>
            ) : (
              <>
                {/* Draft Items */}
                {drafts.map((draft) => {
                  const draftConflicts = getDraftConflicts(draft.id)
                  const hasConflicts = draftConflicts.length > 0
                  
                  return (
                    <div 
                      key={draft.id}
                      className={`border rounded-md p-4 cursor-pointer transition-colors ${
                        currentDraftId === draft.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : hasConflicts
                          ? 'border-yellow-300 bg-yellow-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => selectDraft(draft.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-gray-900">{draft.name}</h4>
                            {draft.isActive && (
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                Active
                              </span>
                            )}
                            {hasConflicts && (
                              <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                                {draftConflicts.length} Conflict{draftConflicts.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {currentDraftId === draft.id && (
                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                Current
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 mt-1">
                            By {draft.creator.firstName} {draft.creator.lastName} • {draft.entryCount} classes
                          </p>
                          
                          {draft.description && (
                            <p className="text-sm text-gray-500 mt-1">{draft.description}</p>
                          )}
                          
                          <p className="text-xs text-gray-400 mt-2">
                            Updated {formatDate(draft.updatedAt)}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDraftToDelete(draft)
                              setShowDeleteModal(true)
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setDraftToDelete(null)
        }}
        onConfirm={deleteDraft}
        title="Delete Draft"
        message={`Are you sure you want to delete "${draftToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </>
  )
}