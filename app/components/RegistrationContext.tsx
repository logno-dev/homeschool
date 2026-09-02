'use client'
'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'

interface PendingRegistration {
  childId: string
  period: string
  scheduleId: string
  className: string
  teacher: string
  classroom: string
  status?: 'registered' | 'waitlisted'
  holdId?: string
  holdExpiresAt?: string | null
}

interface PendingVolunteerAssignment {
  guardianId: string
  guardianName: string
  period: string
  volunteerType: string
  scheduleId?: string
  sessionVolunteerJobId?: string
  volunteerJobId?: string
  holdId?: string
  holdExpiresAt?: string | null
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
  sessionId?: string | null
  setSessionId: (sessionId: string) => void
  addChildRegistration: (registration: PendingRegistration) => Promise<void>
  removeChildRegistration: (childId: string, period: string, scheduleId?: string) => Promise<void>
  addVolunteerAssignment: (assignment: PendingVolunteerAssignment) => Promise<void>
  removeVolunteerAssignment: (period: string) => Promise<void>
  isChildRegisteredInPeriod: (childId: string, period: string) => boolean
  isGuardianAssignedInPeriod: (guardianId: string, period: string) => boolean
  getChildRegistrationForPeriod: (childId: string, period: string) => PendingRegistration | null
  getVolunteerAssignmentForPeriod: (period: string) => PendingVolunteerAssignment | null
  clearAllRegistrations: (releaseHolds?: boolean) => Promise<void>
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
  sessionId?: string
  initialRegistrations?: PendingRegistration[]
  initialVolunteerAssignments?: PendingVolunteerAssignment[]
  modifyMode?: boolean
  children: ReactNode
}

export function RegistrationProvider({
  children,
  teachingAssignments = [],
  sessionId: initialSessionId,
  initialRegistrations = [],
  initialVolunteerAssignments = [],
  modifyMode = false
}: RegistrationProviderProps) {
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>(initialRegistrations)
  const [pendingVolunteerAssignments, setPendingVolunteerAssignments] = useState<PendingVolunteerAssignment[]>(initialVolunteerAssignments)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null)

  const addChildRegistration = useCallback(async (registration: PendingRegistration) => {
    if (!sessionId) {
      throw new Error('Missing session information for registration holds.')
    }

    if (modifyMode) {
      setPendingRegistrations(prev => [
        ...prev.filter((entry) => !(entry.childId === registration.childId && entry.period === registration.period)),
        registration
      ])
      return
    }

    const existingRegistration = pendingRegistrations.find((entry) =>
      entry.childId === registration.childId &&
      entry.period === registration.period &&
      entry.status !== 'waitlisted'
    )

    if (existingRegistration?.holdId) {
      await fetch('/api/registration/holds/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId: existingRegistration.holdId, holdType: 'class' })
      })
    }

    if (registration.status === 'waitlisted') {
      setPendingRegistrations(prev => {
        const filtered = prev.filter((entry) => {
          if (entry.childId !== registration.childId) return true
          if (entry.scheduleId === registration.scheduleId) return false
          return !(entry.period === registration.period && entry.status !== 'waitlisted')
        })
        return [...filtered, registration]
      })
      return
    }

    const response = await fetch('/api/registration/holds/class', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        scheduleId: registration.scheduleId,
        childId: registration.childId,
        status: registration.status
      })
    })

    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to reserve class spot.')
    }

    const registrationWithHold = {
      ...registration,
      holdId: payload.holdId,
      holdExpiresAt: payload.holdExpiresAt
    }

    setPendingRegistrations(prev => {
      const filtered = prev.filter((entry) => {
        if (entry.childId !== registration.childId) return true
        if (entry.scheduleId === registration.scheduleId) return false
        return !(entry.period === registration.period && entry.status !== 'waitlisted')
      })
      return [...filtered, registrationWithHold]
    })
  }, [sessionId, pendingRegistrations, modifyMode])

  const removeChildRegistration = useCallback(async (childId: string, period: string, scheduleId?: string) => {
    const match = pendingRegistrations.find((entry) => {
      if (entry.childId !== childId || entry.period !== period) return false
      if (scheduleId) return entry.scheduleId === scheduleId
      return true
    })

    if (match?.holdId) {
      await fetch('/api/registration/holds/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId: match.holdId, holdType: 'class' })
      })
    }

    setPendingRegistrations(prev => prev.filter(r => {
      if (r.childId !== childId || r.period !== period) return true
      if (scheduleId) return r.scheduleId !== scheduleId
      return false
    }))
  }, [pendingRegistrations])

  const addVolunteerAssignment = useCallback(async (assignment: PendingVolunteerAssignment) => {
    if (!sessionId) {
      throw new Error('Missing session information for volunteer holds.')
    }

    if (modifyMode) {
      setPendingVolunteerAssignments(prev => [
        ...prev.filter((entry) => entry.period !== assignment.period),
        assignment
      ])
      return
    }

    const existingAssignment = pendingVolunteerAssignments.find((entry) => entry.period === assignment.period)

    if (existingAssignment?.holdId) {
      await fetch('/api/registration/holds/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId: existingAssignment.holdId, holdType: 'volunteer' })
      })
    }

    const response = await fetch('/api/registration/holds/volunteer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        guardianId: assignment.guardianId,
        period: assignment.period,
        volunteerType: assignment.volunteerType,
        scheduleId: assignment.scheduleId,
        volunteerJobId: assignment.volunteerJobId
      })
    })

    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to reserve volunteer slot.')
    }

    const assignmentWithHold = {
      ...assignment,
      holdId: payload.holdId,
      holdExpiresAt: payload.holdExpiresAt
    }

    setPendingVolunteerAssignments(prev => {
      const filtered = prev.filter(a => a.period !== assignment.period)
      return [...filtered, assignmentWithHold]
    })
  }, [sessionId, pendingVolunteerAssignments, modifyMode])

  const removeVolunteerAssignment = useCallback(async (period: string) => {
    const match = pendingVolunteerAssignments.find((assignment) => assignment.period === period)

    if (match?.holdId) {
      await fetch('/api/registration/holds/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId: match.holdId, holdType: 'volunteer' })
      })
    }

    setPendingVolunteerAssignments(prev => prev.filter(a => a.period !== period))
  }, [pendingVolunteerAssignments])

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

  const clearAllRegistrations = useCallback(async (releaseHolds: boolean = true) => {
    if (releaseHolds) {
      const classHolds = pendingRegistrations.filter((registration) => registration.holdId)
      const volunteerHolds = pendingVolunteerAssignments.filter((assignment) => assignment.holdId)

      await Promise.all([
        ...classHolds.map((registration) =>
          fetch('/api/registration/holds/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ holdId: registration.holdId, holdType: 'class' })
          })
        ),
        ...volunteerHolds.map((assignment) =>
          fetch('/api/registration/holds/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ holdId: assignment.holdId, holdType: 'volunteer' })
          })
        )
      ])
    }

    setPendingRegistrations([])
    setPendingVolunteerAssignments([])
  }, [pendingRegistrations, pendingVolunteerAssignments])

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
        .filter(a => a.period !== 'non_period' && periodsWithStudents.includes(a.period))
        .map(a => a.period)
    )

    teachingAssignments
      .filter(t => t.period !== 'lunch' && periodsWithStudents.includes(t.period))
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

  useEffect(() => {
    if (!sessionId) return
    const hasHolds = pendingRegistrations.some((registration) => registration.holdId)
      || pendingVolunteerAssignments.some((assignment) => assignment.holdId)

    if (!hasHolds) return

    const interval = setInterval(() => {
      fetch('/api/registration/holds/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      }).catch((error) => {
        console.error('Failed to refresh holds:', error)
      })
    }, 10 * 60 * 1000)

    return () => clearInterval(interval)
  }, [sessionId, pendingRegistrations, pendingVolunteerAssignments])

  const isScheduleConflicted = useCallback((scheduleId: string) => {
    return conflicts.some(conflict => conflict.scheduleId === scheduleId)
  }, [conflicts])

  const contextValue: RegistrationContextType = {
    pendingRegistrations,
    pendingVolunteerAssignments,
    conflicts,
    sessionId,
    setSessionId,
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
