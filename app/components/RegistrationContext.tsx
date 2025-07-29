'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface PendingRegistration {
  childId: string
  period: string
  scheduleId: string
  className: string
  teacher: string
  classroom: string
}

interface PendingVolunteerAssignment {
  guardianId: string
  guardianName: string
  period: string
  volunteerType: string
  scheduleId?: string
  sessionVolunteerJobId?: string
  className?: string
  teacher?: string
  classroom?: string
  jobTitle?: string
}

interface Conflict {
  type: 'class' | 'volunteer'
  scheduleId?: string
  sessionVolunteerJobId?: string
  className?: string
  jobTitle?: string
  message: string
}

interface TeachingAssignment {
  guardianId: string
  period: string
  className: string
  volunteerType: string
  guardianName?: string
}

interface RegistrationContextType {
  pendingRegistrations: PendingRegistration[]
  pendingVolunteerAssignments: PendingVolunteerAssignment[]
  conflicts: Conflict[]
  addChildRegistration: (registration: PendingRegistration) => void
  removeChildRegistration: (childId: string, period: string) => void
  addVolunteerAssignment: (assignment: PendingVolunteerAssignment) => void
  removeVolunteerAssignment: (period: string) => void
  isChildRegisteredInPeriod: (childId: string, period: string) => boolean
  isGuardianAssignedInPeriod: (guardianId: string, period: string) => boolean
  getChildRegistrationForPeriod: (childId: string, period: string) => PendingRegistration | null
  getVolunteerAssignmentForPeriod: (period: string) => PendingVolunteerAssignment | null
  clearAllRegistrations: () => void
  getTotalPendingRegistrations: () => number
  getPeriodsWithStudents: () => string[]
  getVolunteerRequirements: () => { requiredHours: number; fulfilledHours: number; periodsWithStudents: string[] }
  isVolunteerRequirementsMet: () => boolean
  hasGuardianConflictInPeriod: (guardianId: string, period: string, teachingAssignments?: any[]) => boolean
  getGuardianConflictDetails: (guardianId: string, period: string, teachingAssignments?: any[]) => string | null
  setConflicts: (conflicts: Conflict[]) => void
  isScheduleConflicted: (scheduleId: string) => boolean
  getPendingRegistrationsForSchedule: (scheduleId: string) => number
}

const RegistrationContext = createContext<RegistrationContextType | undefined>(undefined)

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([])
  const [pendingVolunteerAssignments, setPendingVolunteerAssignments] = useState<PendingVolunteerAssignment[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignment[]>([])

  // Fetch teaching assignments when session is available
  useEffect(() => {
    if (session?.user?.id) {
      fetchTeachingAssignments()
    }
  }, [session?.user?.id])

  const fetchTeachingAssignments = async () => {
    try {
      // Get current session ID from URL
      const pathSegments = window.location.pathname.split('/')
      const sessionId = pathSegments[pathSegments.indexOf('registration') + 1]
      
      if (!sessionId) return

      // Fetch both schedules and family status to get family guardian info
      const [schedulesResponse, statusResponse] = await Promise.all([
        fetch(`/api/registration/schedules/${sessionId}`),
        fetch(`/api/registration/family-status?sessionId=${sessionId}`)
      ])

      if (schedulesResponse.ok && statusResponse.ok) {
        const schedulesData = await schedulesResponse.json()
        const statusData = await statusResponse.json()
        const schedules = schedulesData.schedules || []
        
        // Get all family guardian IDs and create a lookup map
        const familyGuardians = statusData.familyGuardians || []
        const familyGuardianIds = familyGuardians.map((g: any) => g.id)
        const guardianLookup = familyGuardians.reduce((acc: any, guardian: any) => {
          acc[guardian.id] = `${guardian.firstName} ${guardian.lastName}`
          return acc
        }, {})
        
        // Filter schedules where any family guardian is the teacher
        const familyTeachingAssignments = schedules
          .filter((schedule: any) => familyGuardianIds.includes(schedule.teacher.id))
          .map((schedule: any) => ({
            guardianId: schedule.teacher.id,
            period: schedule.schedule.period,
            className: schedule.classTeachingRequest.className,
            volunteerType: 'teacher',
            guardianName: guardianLookup[schedule.teacher.id] || 'Unknown'
          }))
        
        setTeachingAssignments(familyTeachingAssignments)
      }
    } catch (error) {
      console.error('Error fetching teaching assignments:', error)
    }
  }

  const addChildRegistration = useCallback((registration: PendingRegistration) => {
    setPendingRegistrations(prev => {
      // Remove any existing registration for this child in this period
      const filtered = prev.filter(r => !(r.childId === registration.childId && r.period === registration.period))
      return [...filtered, registration]
    })
  }, [])

  const removeChildRegistration = useCallback((childId: string, period: string) => {
    setPendingRegistrations(prev => prev.filter(r => !(r.childId === childId && r.period === period)))
  }, [])

  const addVolunteerAssignment = useCallback((assignment: PendingVolunteerAssignment) => {
    setPendingVolunteerAssignments(prev => {
      // Remove any existing assignment for this period
      const filtered = prev.filter(a => a.period !== assignment.period)
      return [...filtered, assignment]
    })
  }, [])

  const removeVolunteerAssignment = useCallback((period: string) => {
    setPendingVolunteerAssignments(prev => prev.filter(a => a.period !== period))
  }, [])

  const isChildRegisteredInPeriod = useCallback((childId: string, period: string) => {
    return pendingRegistrations.some(r => r.childId === childId && r.period === period)
  }, [pendingRegistrations])

  const isGuardianAssignedInPeriod = useCallback((guardianId: string, period: string) => {
    return pendingVolunteerAssignments.some(a => a.guardianId === guardianId && a.period === period)
  }, [pendingVolunteerAssignments])

  const getChildRegistrationForPeriod = useCallback((childId: string, period: string) => {
    return pendingRegistrations.find(r => r.childId === childId && r.period === period) || null
  }, [pendingRegistrations])

  const getVolunteerAssignmentForPeriod = useCallback((period: string) => {
    return pendingVolunteerAssignments.find(a => a.period === period) || null
  }, [pendingVolunteerAssignments])

  const clearAllRegistrations = useCallback(() => {
    setPendingRegistrations([])
    setPendingVolunteerAssignments([])
  }, [])

  const getTotalPendingRegistrations = useCallback(() => {
    return pendingRegistrations.length
  }, [pendingRegistrations])

  const getPeriodsWithStudents = useCallback(() => {
    const periods = new Set(pendingRegistrations.map(r => r.period))
    return Array.from(periods).filter(period => period !== 'lunch') // Lunch doesn't count for volunteer requirements
  }, [pendingRegistrations])

  const getVolunteerRequirements = useCallback(() => {
    const periodsWithStudents = getPeriodsWithStudents()
    const requiredHours = periodsWithStudents.length
    
    // Count period-based volunteer assignments (excluding non-period jobs)
    const periodBasedHours = pendingVolunteerAssignments.filter(a => a.period !== 'non_period').length
    
    // Count non-period volunteer jobs (each counts as 1 hour regardless of period)
    const nonPeriodHours = pendingVolunteerAssignments.filter(a => a.period === 'non_period').length
    
    // Count teaching assignments (each counts as 1 hour per period, excluding lunch)
    const teachingHours = teachingAssignments.filter(t => t.period !== 'lunch').length
    
    const fulfilledHours = periodBasedHours + nonPeriodHours + teachingHours
    
    return {
      requiredHours,
      fulfilledHours,
      periodsWithStudents
    }
  }, [getPeriodsWithStudents, pendingVolunteerAssignments, teachingAssignments])

  const isVolunteerRequirementsMet = useCallback(() => {
    const requirements = getVolunteerRequirements()
    return requirements.fulfilledHours >= requirements.requiredHours
  }, [getVolunteerRequirements])

  const hasGuardianConflictInPeriod = useCallback((guardianId: string, period: string, teachingAssignments?: any[]) => {
    // Check if guardian is already assigned as volunteer in this period
    const hasVolunteerAssignment = pendingVolunteerAssignments.some(a => 
      a.guardianId === guardianId && a.period === period
    )
    
    // Check if guardian is teaching, co-teaching, or helping in this period from external data
    const hasTeachingAssignment = teachingAssignments?.some(assignment => 
      assignment.guardianId === guardianId && assignment.period === period
    )
    
    return hasVolunteerAssignment || hasTeachingAssignment || false
  }, [pendingVolunteerAssignments])

  const getGuardianConflictDetails = useCallback((guardianId: string, period: string, teachingAssignments?: any[]) => {
    // Check volunteer assignments first
    const volunteerAssignment = pendingVolunteerAssignments.find(a => 
      a.guardianId === guardianId && a.period === period
    )
    
    if (volunteerAssignment) {
      if (volunteerAssignment.volunteerType === 'volunteer_job') {
        return `Already volunteering for ${volunteerAssignment.jobTitle}`
      } else {
        return `Already ${volunteerAssignment.volunteerType} for ${volunteerAssignment.className}`
      }
    }
    
    // Check teaching assignments from external data
    const teachingAssignment = teachingAssignments?.find(assignment => 
      assignment.guardianId === guardianId && assignment.period === period
    )
    
    if (teachingAssignment) {
      return `Teaching ${teachingAssignment.className}`
    }
    
    return null
  }, [pendingVolunteerAssignments])

  const getPendingRegistrationsForSchedule = useCallback((scheduleId: string) => {
    return pendingRegistrations.filter(registration => registration.scheduleId === scheduleId).length
  }, [pendingRegistrations])

  const isScheduleConflicted = useCallback((scheduleId: string) => {
    return conflicts.some(conflict => conflict.scheduleId === scheduleId)
  }, [conflicts])

  const contextValue: RegistrationContextType = {
    pendingRegistrations,
    pendingVolunteerAssignments,
    conflicts,
    addChildRegistration,
    removeChildRegistration,
    addVolunteerAssignment,
    removeVolunteerAssignment,
    isChildRegisteredInPeriod,
    isGuardianAssignedInPeriod,
    getChildRegistrationForPeriod,
    getVolunteerAssignmentForPeriod,
    clearAllRegistrations,
    getTotalPendingRegistrations,
    getPeriodsWithStudents,
    getVolunteerRequirements,
    isVolunteerRequirementsMet,
    hasGuardianConflictInPeriod,
    getGuardianConflictDetails,
    setConflicts,
    isScheduleConflicted,
    getPendingRegistrationsForSchedule
  }

  return (
    <RegistrationContext.Provider value={contextValue}>
      {children}
    </RegistrationContext.Provider>
  )
}

export function useRegistration() {
  const context = useContext(RegistrationContext)
  if (context === undefined) {
    throw new Error('useRegistration must be used within a RegistrationProvider')
  }
  return context
}