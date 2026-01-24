'use client'
'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface PendingRegistration {
  childId: string
  period: string
  scheduleId: string
  className: string
  teacher: string
  classroom: string
  status?: 'registered' | 'waitlisted'
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
  removeChildRegistration: (childId: string, period: string, scheduleId?: string) => void
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

interface RegistrationProviderProps {
  teachingAssignments?: TeachingAssignment[]
  children: ReactNode
}

export function RegistrationProvider({ children, teachingAssignments = [] }: RegistrationProviderProps) {
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([])
  const [pendingVolunteerAssignments, setPendingVolunteerAssignments] = useState<PendingVolunteerAssignment[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])

  const addChildRegistration = useCallback((registration: PendingRegistration) => {
    setPendingRegistrations(prev => {
      const filtered = prev.filter((entry) => {
        if (entry.childId !== registration.childId) return true
        if (entry.scheduleId === registration.scheduleId) return false
        if (registration.status === 'waitlisted') return true
        return !(entry.period === registration.period && entry.status !== 'waitlisted')
      })
      return [...filtered, registration]
    })
  }, [])

  const removeChildRegistration = useCallback((childId: string, period: string, scheduleId?: string) => {
    setPendingRegistrations(prev => prev.filter(r => {
      if (r.childId !== childId || r.period !== period) return true
      if (scheduleId) return r.scheduleId !== scheduleId
      return false
    }))
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
    return pendingRegistrations.some(r => r.childId === childId && r.period === period && r.status !== 'waitlisted')
  }, [pendingRegistrations])

  const isGuardianAssignedInPeriod = useCallback((guardianId: string, period: string) => {
    return pendingVolunteerAssignments.some(a => a.guardianId === guardianId && a.period === period)
  }, [pendingVolunteerAssignments])

  const getChildRegistrationForPeriod = useCallback((childId: string, period: string) => {
    return pendingRegistrations.find(r => r.childId === childId && r.period === period && r.status !== 'waitlisted') || null
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
    const periods = new Set(
      pendingRegistrations
        .filter(r => r.status !== 'waitlisted')
        .map(r => r.period)
    )
    return Array.from(periods).filter(period => period !== 'lunch') // Lunch doesn't count for volunteer requirements
  }, [pendingRegistrations])

  const getVolunteerRequirements = useCallback(() => {
    const periodsWithStudents = getPeriodsWithStudents()
    const requiredHours = periodsWithStudents.length

    const coveredPeriods = new Set(
      pendingVolunteerAssignments
        .filter(a => a.period !== 'non_period')
        .map(a => a.period)
    )

    teachingAssignments
      .filter(t => t.period !== 'lunch')
      .forEach(t => coveredPeriods.add(t.period))

    const nonPeriodHours = pendingVolunteerAssignments.filter(a => a.period === 'non_period').length
    const remainingPeriods = Math.max(0, requiredHours - coveredPeriods.size)
    const wildcardCoverage = Math.min(nonPeriodHours, remainingPeriods)
    const fulfilledHours = coveredPeriods.size + wildcardCoverage
    
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
    return pendingRegistrations.filter(registration => registration.scheduleId === scheduleId && registration.status !== 'waitlisted').length
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
