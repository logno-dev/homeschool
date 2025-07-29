'use client'

import { useState, useEffect } from 'react'
import type { Classroom, ClassTeachingRequest, Session } from '@/lib/schema'
import { useToast } from './ToastContainer'
import ConfirmModal from './ConfirmModal'
import ClassDetailsPopover from './ClassDetailsPopover'
import DraftManagement from './DraftManagement'
import Modal from './Modal'
import LoadingSpinner, { SkeletonCard, SkeletonTable } from './LoadingSpinner'

interface ScheduleGridProps {
  sessionId: string
}

interface ScheduleData {
  approvedClasses: (ClassTeachingRequest & { session: Session, guardian: { firstName: string, lastName: string } })[]
  classrooms: Classroom[]
}



interface DraftSchedule {
  [key: string]: string | null // key: "classroomId-period", value: classId or null
}

const PERIODS = [
  { id: 'first', name: 'First Period' },
  { id: 'second', name: 'Second Period' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'third', name: 'Third Period' }
]

export default function ScheduleGrid({ sessionId }: ScheduleGridProps) {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [draggedClass, setDraggedClass] = useState<ClassTeachingRequest | null>(null)
  const [draggedFromSlot, setDraggedFromSlot] = useState<string | null>(null)
  const [draftSchedule, setDraftSchedule] = useState<DraftSchedule>({})
  const [scheduleStatus, setScheduleStatus] = useState<'draft' | 'submitted' | 'published'>('draft')
  const [isDragging, setIsDragging] = useState(false)
  const [hoveredDropZone, setHoveredDropZone] = useState<string | null>(null)
  const [selectedClass, setSelectedClass] = useState<ClassTeachingRequest | null>(null)
  const [selectedFromSlot, setSelectedFromSlot] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showPullBackModal, setShowPullBackModal] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [showDraftManagement, setShowDraftManagement] = useState(false)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const [currentDraftName, setCurrentDraftName] = useState<string>('')
  const [isLoadingDraft, setIsLoadingDraft] = useState(true)
  const [showQuickSaveModal, setShowQuickSaveModal] = useState(false)
  const [quickSaveName, setQuickSaveName] = useState('')
  const [quickSaveDescription, setQuickSaveDescription] = useState('')
  const [isQuickSaving, setIsQuickSaving] = useState(false)
  
  const { showSuccess, showError } = useToast()

  useEffect(() => {
    initializeSchedule()
  }, [sessionId])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const initializeSchedule = async () => {
    setIsLoading(true)
    setIsLoadingDraft(true)
    
    try {
      // First, get the basic schedule data (approved classes and classrooms)
      const scheduleResponse = await fetch(`/api/admin/schedule/${sessionId}`)
      if (scheduleResponse.ok) {
        const scheduleData = await scheduleResponse.json()
        setScheduleData(scheduleData)
        
        // Set status based on existing data
        if (scheduleData.scheduleEntries && scheduleData.scheduleEntries.length > 0) {
          setScheduleStatus(scheduleData.scheduleEntries[0].status || 'draft')
        }
      }

      // Then, get or create a draft to work with
      await loadOrCreateDraft()
      
    } catch (error) {
      console.error('Error initializing schedule:', error)
    } finally {
      setIsLoading(false)
      setIsLoadingDraft(false)
    }
  }

  const loadOrCreateDraft = async () => {
    try {
      // Get user's drafts for this session
      const draftsResponse = await fetch(`/api/admin/schedule/${sessionId}/drafts`)
      if (draftsResponse.ok) {
        const draftsData = await draftsResponse.json()
        const userDrafts = draftsData.drafts
        
        if (userDrafts.length > 0) {
          // Load the most recent draft
          const mostRecentDraft = userDrafts[0] // Already sorted by updatedAt desc
          await loadDraft(mostRecentDraft.id, mostRecentDraft.name)
        } else {
          // Create a default draft
          await createDefaultDraft()
        }
      }
    } catch (error) {
      console.error('Error loading or creating draft:', error)
      // Fallback to empty schedule
      setDraftSchedule({})
      setCurrentDraftId(null)
      setCurrentDraftName('Untitled Draft')
    }
  }

  const createDefaultDraft = async () => {
    try {
      const response = await fetch(`/api/admin/schedule/${sessionId}/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Working Draft',
          description: 'Default working draft'
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentDraftId(data.draft.id)
        setCurrentDraftName(data.draft.name)
        setDraftSchedule({})
      }
    } catch (error) {
      console.error('Error creating default draft:', error)
    }
  }

  const loadDraft = async (draftId: string, draftName: string) => {
    try {
      const response = await fetch(`/api/admin/schedule/${sessionId}/drafts/${draftId}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentDraftId(draftId)
        setCurrentDraftName(draftName)
        
        // Convert draft entries to draftSchedule format
        const draftScheduleData: DraftSchedule = {}
        data.entries.forEach((entry: any) => {
          const key = `${entry.classroomId}-${entry.period}`
          draftScheduleData[key] = entry.classTeachingRequestId
        })
        setDraftSchedule(draftScheduleData)
      }
    } catch (error) {
      console.error('Error loading draft:', error)
    }
  }

  const fetchScheduleData = async () => {
    // This is now just for refreshing the basic data, not for loading drafts
    try {
      const response = await fetch(`/api/admin/schedule/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setScheduleData(data)
      }
    } catch (error) {
      console.error('Error fetching schedule data:', error)
    }
  }

  const getSlotKey = (classroomId: string, period: string) => `${classroomId}-${period}`

  const handleDragStart = (e: React.DragEvent, classRequest: ClassTeachingRequest, fromSlot?: string) => {
    // Disable dragging if schedule is submitted or published
    if (scheduleStatus === 'submitted' || scheduleStatus === 'published') {
      e.preventDefault()
      return
    }
    
    setDraggedClass(classRequest)
    setDraggedFromSlot(fromSlot || null)
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedClass(null)
    setDraggedFromSlot(null)
    setIsDragging(false)
    setHoveredDropZone(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, dropZoneId: string) => {
    e.preventDefault()
    if (isDragging) {
      setHoveredDropZone(dropZoneId)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // Only clear hover if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setHoveredDropZone(null)
    }
  }

  const handleDrop = (e: React.DragEvent, classroomId: string, period: string) => {
    e.preventDefault()
    
    if (!draggedClass) return

    const slotKey = getSlotKey(classroomId, period)
    const newSchedule = { ...draftSchedule }

    // Remove class from previous slot if it was moved from a slot
    if (draggedFromSlot) {
      newSchedule[draggedFromSlot] = null
    }

    // Add class to new slot
    newSchedule[slotKey] = draggedClass.id

    setDraftSchedule(newSchedule)
    handleDragEnd()
  }

  const handleDropToPool = (e: React.DragEvent) => {
    e.preventDefault()
    
    if (!draggedClass || !draggedFromSlot) return

    const newSchedule = { ...draftSchedule }
    newSchedule[draggedFromSlot] = null

    setDraftSchedule(newSchedule)
    handleDragEnd()
  }

  // Touch interaction handlers for mobile
  const handleClassSelect = (classRequest: ClassTeachingRequest, fromSlot?: string) => {
    if (scheduleStatus === 'submitted' || scheduleStatus === 'published') return
    
    if (selectedClass?.id === classRequest.id && selectedFromSlot === fromSlot) {
      // Deselect if clicking the same class
      setSelectedClass(null)
      setSelectedFromSlot(null)
    } else {
      // Select the class
      setSelectedClass(classRequest)
      setSelectedFromSlot(fromSlot || null)
    }
  }

  const handleSlotTap = (classroomId: string, period: string) => {
    if (scheduleStatus === 'submitted' || scheduleStatus === 'published') return
    
    const slotKey = getSlotKey(classroomId, period)
    const existingClass = getClassInSlot(classroomId, period)
    
    if (selectedClass) {
      // Place selected class in this slot
      const newSchedule = { ...draftSchedule }
      
      // Remove class from previous slot if it was moved from a slot
      if (selectedFromSlot) {
        newSchedule[selectedFromSlot] = null
      }
      
      // Add class to new slot
      newSchedule[slotKey] = selectedClass.id
      
      setDraftSchedule(newSchedule)
      setSelectedClass(null)
      setSelectedFromSlot(null)
    } else if (existingClass) {
      // Select the existing class in this slot
      handleClassSelect(existingClass, slotKey)
    }
  }

  const handlePoolTap = () => {
    if (selectedClass && selectedFromSlot) {
      // Remove selected class from schedule
      const newSchedule = { ...draftSchedule }
      newSchedule[selectedFromSlot] = null
      
      setDraftSchedule(newSchedule)
      setSelectedClass(null)
      setSelectedFromSlot(null)
    }
  }

  const getClassInSlot = (classroomId: string, period: string) => {
    const slotKey = getSlotKey(classroomId, period)
    const classId = draftSchedule[slotKey]
    if (!classId) return null
    
    return scheduleData?.approvedClasses.find(c => c.id === classId) || null
  }

  const getUnscheduledClasses = () => {
    if (!scheduleData) return []
    
    const scheduledClassIds = new Set(
      Object.values(draftSchedule).filter(Boolean)
    )
    
    return scheduleData.approvedClasses.filter(
      classRequest => !scheduledClassIds.has(classRequest.id)
    )
  }

  const saveDraft = async () => {
    setIsSaving(true)
    try {
      const scheduleEntries = Object.entries(draftSchedule)
        .filter(([_, classId]) => classId !== null)
        .map(([slotKey, classId]) => {
          const [classroomId, period] = slotKey.split('-')
          return {
            classTeachingRequestId: classId,
            classroomId,
            period,
            status: 'draft'
          }
        })

      const response = await fetch(`/api/admin/schedule/${sessionId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scheduleEntries }),
      })

      if (response.ok) {
        setScheduleStatus('draft')
        showSuccess('Draft saved successfully!')
      } else {
        showError('Failed to save draft')
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      showError('Failed to save draft')
    } finally {
      setIsSaving(false)
    }
  }

  const submitForReview = async () => {
    setIsSaving(true)
    try {
      const scheduleEntries = Object.entries(draftSchedule)
        .filter(([_, classId]) => classId !== null)
        .map(([slotKey, classId]) => {
          const [classroomId, period] = slotKey.split('-')
          return {
            classTeachingRequestId: classId,
            classroomId,
            period,
            status: 'submitted'
          }
        })

      const response = await fetch(`/api/admin/schedule/${sessionId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scheduleEntries }),
      })

      if (response.ok) {
        setScheduleStatus('submitted')
        showSuccess('Schedule submitted for review!')
      } else {
        showError('Failed to submit schedule')
      }
    } catch (error) {
      console.error('Error submitting schedule:', error)
      showError('Failed to submit schedule')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePullBackClick = () => {
    setShowPullBackModal(true)
  }

  const confirmPullBack = async () => {
    setShowPullBackModal(false)
    setIsSaving(true)
    
    try {
      const response = await fetch(`/api/admin/schedule/${sessionId}/pullback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setScheduleStatus('draft')
        showSuccess('Schedule pulled back to draft status!')
      } else {
        showError('Failed to pull back schedule')
      }
    } catch (error) {
      console.error('Error pulling back schedule:', error)
      showError('Failed to pull back schedule')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublishClick = () => {
    setShowPublishModal(true)
  }

  const confirmPublish = async () => {
    setShowPublishModal(false)
    setIsSaving(true)
    
    try {
      const response = await fetch(`/api/admin/schedule/${sessionId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setScheduleStatus('published')
        showSuccess('Schedule published successfully!')
      } else {
        showError('Failed to publish schedule')
      }
    } catch (error) {
      console.error('Error publishing schedule:', error)
      showError('Failed to publish schedule')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDraftSelected = async (draftId: string | null) => {
    if (draftId === null) {
      // This shouldn't happen anymore since we always work with drafts
      return
    } else {
      // Load the selected draft
      try {
        const response = await fetch(`/api/admin/schedule/${sessionId}/drafts/${draftId}`)
        if (response.ok) {
          const data = await response.json()
          await loadDraft(draftId, data.draft.name)
        } else {
          showError('Failed to load draft')
        }
      } catch (error) {
        console.error('Error loading draft:', error)
        showError('Failed to load draft')
      }
    }
  }

  const saveCurrentDraft = async () => {
    if (!currentDraftId) {
      showError('No draft selected to save')
      return
    }

    setIsSaving(true)
    try {
      const entries = Object.entries(draftSchedule)
        .filter(([_, classId]) => classId !== null)
        .map(([slotKey, classId]) => {
          const [classroomId, period] = slotKey.split('-')
          return {
            classTeachingRequestId: classId,
            classroomId,
            period
          }
        })

      const response = await fetch(`/api/admin/schedule/${sessionId}/drafts/${currentDraftId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entries }),
      })

      if (response.ok) {
        showSuccess('Draft saved successfully!')
      } else {
        showError('Failed to save draft')
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      showError('Failed to save draft')
    } finally {
      setIsSaving(false)
    }
  }

  const quickSaveAsDraft = async () => {
    if (!quickSaveName.trim()) {
      showError('Draft name is required')
      return
    }

    setIsQuickSaving(true)
    try {
      // First create the draft
      const createResponse = await fetch(`/api/admin/schedule/${sessionId}/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: quickSaveName.trim(),
          description: quickSaveDescription.trim() || undefined
        }),
      })

      if (!createResponse.ok) {
        showError('Failed to create draft')
        return
      }

      const createData = await createResponse.json()
      const newDraftId = createData.draft.id

      // Then save the current schedule to the new draft
      const entries = Object.entries(draftSchedule)
        .filter(([_, classId]) => classId !== null)
        .map(([slotKey, classId]) => {
          const [classroomId, period] = slotKey.split('-')
          return {
            classTeachingRequestId: classId,
            classroomId,
            period
          }
        })

      const saveResponse = await fetch(`/api/admin/schedule/${sessionId}/drafts/${newDraftId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entries }),
      })

      if (saveResponse.ok) {
        showSuccess(`Draft "${quickSaveName}" created and saved successfully!`)
        setQuickSaveName('')
        setQuickSaveDescription('')
        setShowQuickSaveModal(false)
        
        // Switch to the new draft
        setCurrentDraftId(newDraftId)
        setCurrentDraftName(quickSaveName.trim())
      } else {
        showError('Failed to save schedule to draft')
      }
    } catch (error) {
      console.error('Error creating draft:', error)
      showError('Failed to create draft')
    } finally {
      setIsQuickSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="animate-pulse h-10 bg-gray-200 rounded w-20"></div>
            <div className="animate-pulse h-10 bg-gray-200 rounded w-32"></div>
            <div className="animate-pulse h-10 bg-gray-200 rounded w-28"></div>
          </div>
        </div>

        {/* Classes pool skeleton */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </div>

        {/* Schedule grid skeleton */}
        <SkeletonTable rows={4} />
        
        {/* Mobile loading indicator */}
        <div className="md:hidden text-center">
          <LoadingSpinner text="Loading schedule..." />
        </div>
      </div>
    )
  }

  if (!scheduleData) {
    return (
      <div className="text-center py-8 text-gray-600">
        Failed to load schedule data
      </div>
    )
  }

  const unscheduledClasses = getUnscheduledClasses()

  return (
    <>
      <ConfirmModal
        isOpen={showPullBackModal}
        onClose={() => setShowPullBackModal(false)}
        onConfirm={confirmPullBack}
        title="Pull Back Schedule"
        message="Are you sure you want to pull back this schedule to draft status? This will allow you to make changes again."
        confirmText="Pull Back"
        confirmVariant="warning"
        isLoading={isSaving}
      />
      
      <ConfirmModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={confirmPublish}
        title="Publish Schedule"
        message="Are you sure you want to publish this schedule? Once published, the schedule will be finalized and visible to all families. This action cannot be undone."
        confirmText="Publish"
        confirmVariant="primary"
        isLoading={isSaving}
      />
      
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Session Schedule</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-600">Current:</span>
            <span className="text-sm font-medium text-blue-600">{currentDraftName}</span>
            <button
              onClick={() => setShowDraftManagement(true)}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Manage Drafts
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm text-gray-600">
            Status: <span className={`font-medium ${
              scheduleStatus === 'draft' ? 'text-yellow-600' :
              scheduleStatus === 'submitted' ? 'text-blue-600' : 'text-green-600'
            }`}>
              {scheduleStatus.charAt(0).toUpperCase() + scheduleStatus.slice(1)}
            </span>
          </div>
          <button
            onClick={saveCurrentDraft}
            disabled={isSaving || !currentDraftId || scheduleStatus === 'submitted' || scheduleStatus === 'published'}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setShowQuickSaveModal(true)}
            disabled={isSaving}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            Save as New Draft
          </button>
          <button
            onClick={submitForReview}
            disabled={isSaving || scheduleStatus === 'submitted' || scheduleStatus === 'published'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {isSaving ? 'Submitting...' : 'Submit for Review'}
          </button>
          {scheduleStatus === 'submitted' && (
            <button
              onClick={handlePublishClick}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {isSaving ? 'Publishing...' : 'Publish Schedule'}
            </button>
          )}
          {scheduleStatus === 'submitted' && (
            <button
              onClick={handlePullBackClick}
              disabled={isSaving}
              className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 border"
              style={{ 
                backgroundColor: '#ea580c', 
                color: 'white',
                borderColor: '#c2410c'
              }}
              onMouseEnter={(e) => {
                if (!isSaving) {
                  e.currentTarget.style.backgroundColor = '#c2410c'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSaving) {
                  e.currentTarget.style.backgroundColor = '#ea580c'
                }
              }}
            >
              {isSaving ? 'Pulling Back...' : 'Pull Back to Draft'}
            </button>
          )}
        </div>
      </div>
      
      {/* Approved Classes Pool */}
      <div 
        className={`bg-white p-6 rounded-lg shadow border transition-colors ${
          hoveredDropZone === 'pool' && draggedFromSlot ? 'bg-gray-100 border-gray-400' : ''
        } ${selectedClass && selectedFromSlot ? 'ring-2 ring-red-300' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={(e) => handleDragEnter(e, 'pool')}
        onDragLeave={handleDragLeave}
        onDrop={handleDropToPool}
        onClick={isMobile ? handlePoolTap : undefined}
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Approved Classes Pool ({unscheduledClasses.length} unscheduled)
          </h3>
          {isMobile && selectedClass && (
            <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              {selectedFromSlot ? 'Tap here to remove from schedule' : 'Selected: ' + selectedClass.className}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[100px]">
          {unscheduledClasses.map((classRequest) => (
            <ClassDetailsPopover key={`pool-${classRequest.id}`} classRequest={classRequest} isDragging={isDragging}>
              <div
                draggable={!isMobile && scheduleStatus !== 'submitted' && scheduleStatus !== 'published'}
                onDragStart={(e) => handleDragStart(e, classRequest)}
                onDragEnd={handleDragEnd}
                onClick={isMobile ? (e) => {
                  e.stopPropagation()
                  handleClassSelect(classRequest)
                } : undefined}
                className={`bg-blue-50 border rounded-md p-3 transition-all min-h-[44px] ${
                  scheduleStatus === 'submitted' || scheduleStatus === 'published'
                    ? 'cursor-not-allowed opacity-60 border-blue-200' 
                    : selectedClass?.id === classRequest.id && !selectedFromSlot
                      ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-300 cursor-pointer'
                      : isMobile 
                        ? 'cursor-pointer hover:bg-blue-100 border-blue-200 active:bg-blue-200'
                        : 'cursor-move hover:bg-blue-100 border-blue-200'
                }`}
              >
                <h4 className="font-medium text-blue-900">{classRequest.className}</h4>
                <p className="text-sm text-blue-700">Grade: {classRequest.gradeRange}</p>
                {classRequest.coTeacher && (
                  <p className="text-sm text-blue-700">Co-teacher: {classRequest.coTeacher}</p>
                )}
              </div>
            </ClassDetailsPopover>
          ))}
           {unscheduledClasses.length === 0 && (
             <div className="col-span-full text-center text-gray-500 py-8">
               {hoveredDropZone === 'pool' && draggedFromSlot ? 'Drop here to remove from schedule' : 
                isDragging && draggedFromSlot ? 'Drop here to remove from schedule' :
                isMobile && selectedClass && selectedFromSlot ? 'Tap here to remove from schedule' :
                'All approved classes have been scheduled'}
             </div>
           )}        </div>
      </div>

      {/* Schedule Grid */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Classroom
                </th>
                {PERIODS.map((period) => (
                  <th
                    key={period.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {period.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {scheduleData.classrooms.map((classroom) => (
                <tr key={classroom.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{classroom.name}</div>
                    {classroom.description && (
                      <div className="text-sm text-gray-500">{classroom.description}</div>
                    )}
                  </td>
                   {PERIODS.map((period) => {
                     const scheduledClass = getClassInSlot(classroom.id, period.id)
                     const slotKey = getSlotKey(classroom.id, period.id)
                     const isValidDropZone = isDragging && slotKey !== draggedFromSlot
                     const isHovered = hoveredDropZone === slotKey
                     
                     return (
                       <td
                         key={period.id}
                         className="px-6 py-4 whitespace-nowrap"
                         onDragOver={handleDragOver}
                         onDragEnter={(e) => handleDragEnter(e, slotKey)}
                         onDragLeave={handleDragLeave}
                         onDrop={(e) => handleDrop(e, classroom.id, period.id)}
                       >
                         {scheduledClass ? (
                            <ClassDetailsPopover key={`scheduled-${scheduledClass.id}-${slotKey}`} classRequest={scheduledClass} isDragging={isDragging}>
                             <div 
                               draggable={scheduleStatus !== 'submitted' && scheduleStatus !== 'published'}
                               onDragStart={(e) => handleDragStart(e, scheduledClass, slotKey)}
                               onDragEnd={handleDragEnd}
                               className={`rounded-md p-3 transition-colors ${
                                 scheduleStatus === 'submitted' || scheduleStatus === 'published'
                                   ? 'cursor-not-allowed opacity-60 bg-green-50 border border-green-200'
                                   : isHovered && isValidDropZone
                                     ? 'bg-gray-100 border border-gray-400 cursor-move' 
                                     : 'bg-green-50 border border-green-200 hover:bg-green-100 cursor-move'
                               }`}
                             >
                               <h4 className="font-medium text-green-900 text-sm">
                                 {scheduledClass.className}
                               </h4>
                               <p className="text-xs text-green-700">
                                 Grade: {scheduledClass.gradeRange}
                               </p>
                               {scheduledClass.coTeacher && (
                                 <p className="text-xs text-green-700">
                                   Co-teacher: {scheduledClass.coTeacher}
                                 </p>
                               )}
                             </div>
                           </ClassDetailsPopover>
                         ) : (
                           <div className={`border-2 border-dashed rounded-md p-3 h-20 flex items-center justify-center text-sm transition-colors ${
                             isHovered && isValidDropZone
                               ? 'border-gray-400 bg-gray-100 text-gray-600' 
                               : 'border-gray-300 text-gray-400'
                           }`}>
                             {isHovered && isValidDropZone ? 'Drop class here' : 'Drop class here'}
                           </div>
                         )}
                       </td>
                    )
                  })}
                </tr>
              ))}
              {scheduleData.classrooms.length === 0 && (
                <tr>
                  <td colSpan={PERIODS.length + 1} className="px-6 py-4 text-center text-gray-500">
                    No classrooms available. Please add classrooms first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden p-4 space-y-6">
          {PERIODS.map((period) => (
            <div key={period.id} className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                {period.name}
              </h3>
              <div className="space-y-3">
                {scheduleData.classrooms.map((classroom) => {
                  const scheduledClass = getClassInSlot(classroom.id, period.id)
                  const slotKey = getSlotKey(classroom.id, period.id)
                  const isSelected = selectedClass && selectedFromSlot === slotKey
                  
                  return (
                    <div key={classroom.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{classroom.name}</h4>
                          {classroom.description && (
                            <p className="text-sm text-gray-500">{classroom.description}</p>
                          )}
                        </div>
                      </div>
                      
                      <div 
                        onClick={() => handleSlotTap(classroom.id, period.id)}
                        className={`border-2 rounded-lg p-4 min-h-[80px] transition-all ${
                          scheduledClass 
                            ? selectedClass?.id === scheduledClass.id && selectedFromSlot === slotKey
                              ? 'border-green-500 bg-green-100 ring-2 ring-green-300'
                              : 'border-green-200 bg-green-50 hover:bg-green-100 active:bg-green-200'
                            : selectedClass
                              ? 'border-blue-400 bg-blue-50 border-dashed hover:bg-blue-100 active:bg-blue-200'
                              : 'border-gray-300 bg-white border-dashed hover:bg-gray-50 active:bg-gray-100'
                        } ${
                          scheduleStatus === 'submitted' || scheduleStatus === 'published'
                            ? 'cursor-not-allowed opacity-60'
                            : 'cursor-pointer'
                        }`}
                      >
                        {scheduledClass ? (
                          <ClassDetailsPopover key={`mobile-${scheduledClass.id}-${slotKey}`} classRequest={scheduledClass} isDragging={false}>
                            <div>
                              <h5 className="font-medium text-green-900">
                                {scheduledClass.className}
                              </h5>
                              <p className="text-sm text-green-700">
                                Grade: {scheduledClass.gradeRange}
                              </p>
                              {scheduledClass.coTeacher && (
                                <p className="text-sm text-green-700">
                                  Co-teacher: {scheduledClass.coTeacher}
                                </p>
                              )}
                              {isSelected && (
                                <p className="text-xs text-green-600 mt-2 font-medium">
                                  Selected - Tap another slot to move
                                </p>
                              )}
                            </div>
                          </ClassDetailsPopover>
                        ) : (
                          <div className="flex items-center justify-center h-full text-center">
                            <p className="text-sm text-gray-500">
                              {selectedClass 
                                ? `Tap to place "${selectedClass.className}" here`
                                : 'Tap a class above to schedule here'
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          
          {scheduleData.classrooms.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No classrooms available. Please add classrooms first.
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Draft Management Modal */}
    <DraftManagement
      sessionId={sessionId}
      isOpen={showDraftManagement}
      onClose={() => setShowDraftManagement(false)}
      onDraftSelected={handleDraftSelected}
      currentDraftId={currentDraftId}
    />

    {/* Quick Save Modal */}
    <Modal
      isOpen={showQuickSaveModal}
      onClose={() => {
        setShowQuickSaveModal(false)
        setQuickSaveName('')
        setQuickSaveDescription('')
      }}
      title="Save as New Draft"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Save your current schedule as an alternative draft. Useful when exploring different arrangements or when multiple people are working on the schedule.
        </p>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Draft Name *
          </label>
          <input
            type="text"
            value={quickSaveName}
            onChange={(e) => setQuickSaveName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="e.g., My Schedule v2"
            maxLength={100}
            autoFocus
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            value={quickSaveDescription}
            onChange={(e) => setQuickSaveDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Brief description of this draft..."
            rows={3}
            maxLength={500}
          />
        </div>
        
        <div className="flex justify-end space-x-3 pt-4">
          <button
            onClick={() => {
              setShowQuickSaveModal(false)
              setQuickSaveName('')
              setQuickSaveDescription('')
            }}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={quickSaveAsDraft}
            disabled={isQuickSaving || !quickSaveName.trim()}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isQuickSaving ? 'Creating...' : 'Create Draft'}
          </button>
        </div>
      </div>
    </Modal>
    </>
  )
}