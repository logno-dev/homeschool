'use client'

import { useMemo } from 'react'
import type { ClassTeachingRequest, Session } from '@/lib/schema'
import Popover from './Popover'

// Global cache for popover content to prevent re-rendering
const popoverCache = new Map<string, React.ReactNode>()

interface ClassDetailsPopoverProps {
  classRequest: ClassTeachingRequest & { session: Session, guardian: { firstName: string, lastName: string } }
  children: React.ReactNode
  isDragging?: boolean
}

// Skeleton component for loading state
const PopoverSkeleton = () => (
  <div className="space-y-3 min-w-80 max-w-md animate-pulse">
    <div className="border-b border-gray-200 pb-2">
      <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
    
    <div>
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-1"></div>
      <div className="h-4 bg-gray-200 rounded w-full mb-1"></div>
      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
    </div>
    
    <div>
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-1"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
    </div>
    
    <div>
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-1"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  </div>
)

export default function ClassDetailsPopover({ classRequest, children, isDragging = false }: ClassDetailsPopoverProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // Create a cache key based on class request data
  const cacheKey = useMemo(() => {
    if (!classRequest || !classRequest.session || !classRequest.guardian) return null
    return `${classRequest.id}-${classRequest.updatedAt || classRequest.createdAt}-${classRequest.guardian.firstName}-${classRequest.guardian.lastName}`
  }, [classRequest])

  // Get or create cached content
  const popoverContent = useMemo(() => {
    if (!classRequest || !classRequest.session || !classRequest.guardian) {
      return <PopoverSkeleton />
    }

    // Check cache first
    if (cacheKey && popoverCache.has(cacheKey)) {
      return popoverCache.get(cacheKey)
    }

    // Create new content
    const content = (
      <div className="space-y-3 min-w-80 max-w-md">
        {/* Class Title */}
        <div className="border-b border-gray-200 pb-2">
          <h3 className="font-semibold text-gray-900 text-lg">{classRequest.className}</h3>
          <p className="text-sm text-gray-600">Grade Range: {classRequest.gradeRange}</p>
        </div>

        {/* Description */}
        {classRequest.description && (
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-1">Description</h4>
            <p className="text-sm text-gray-700">{classRequest.description}</p>
          </div>
        )}

        {/* Teacher Information */}
        <div>
          <h4 className="font-medium text-gray-900 text-sm mb-1">Teaching Team</h4>
          <div className="text-sm text-gray-700">
            <p>Primary Teacher: <span className="font-medium">{classRequest.guardian.firstName} {classRequest.guardian.lastName}</span></p>
            {classRequest.coTeacher && (
              <p>Co-Teacher: <span className="font-medium">{classRequest.coTeacher}</span></p>
            )}
          </div>
        </div>

        {/* Classroom Requirements */}
        {classRequest.classroomNeeds && (
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-1">Classroom Requirements</h4>
            <p className="text-sm text-gray-700">{classRequest.classroomNeeds}</p>
          </div>
        )}

        {/* Fee Information */}
        <div>
          <h4 className="font-medium text-gray-900 text-sm mb-1">Fee Information</h4>
          <div className="text-sm text-gray-700">
            {classRequest.requiresFee ? (
              <p>Supply Fee: {classRequest.feeAmount ? formatCurrency(classRequest.feeAmount) : 'Amount TBD'}</p>
            ) : (
              <p>No supply fee required</p>
            )}
          </div>
        </div>

        {/* Scheduling Requirements */}
        {classRequest.schedulingRequirements && (
          <div>
            <h4 className="font-medium text-gray-900 text-sm mb-1">Scheduling Notes</h4>
            <p className="text-sm text-gray-700">{classRequest.schedulingRequirements}</p>
          </div>
        )}

        {/* Status and Review Info */}
        <div className="border-t border-gray-200 pt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Status:</span>
            <span className={`font-medium px-2 py-1 rounded-full text-xs ${
              classRequest.status === 'approved' 
                ? 'bg-green-100 text-green-800'
                : classRequest.status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {classRequest.status.charAt(0).toUpperCase() + classRequest.status.slice(1)}
            </span>
          </div>
          
          {classRequest.reviewedAt && (
            <div className="text-xs text-gray-500 mt-1">
              Reviewed: {formatDate(classRequest.reviewedAt)}
            </div>
          )}
          
          {classRequest.reviewNotes && (
            <div className="mt-2">
              <h5 className="font-medium text-gray-900 text-xs mb-1">Review Notes</h5>
              <p className="text-xs text-gray-600">{classRequest.reviewNotes}</p>
            </div>
          )}
        </div>

        {/* Session Information */}
        <div className="border-t border-gray-200 pt-2">
          <div className="text-xs text-gray-500">
            <p>Session: {classRequest.session.name}</p>
            <p>Submitted: {formatDate(classRequest.createdAt)}</p>
          </div>
        </div>
      </div>
    )

    // Cache the content
    if (cacheKey) {
      popoverCache.set(cacheKey, content)
    }

    return content
  }, [classRequest, cacheKey, formatDate, formatCurrency])

  return (
    <Popover
      content={popoverContent}
      trigger="hover"
      delay={100} // Reduced delay for better responsiveness
      placement="top"
      disabled={isDragging}
    >
      {children}
    </Popover>
  )
}