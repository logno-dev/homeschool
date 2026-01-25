'use client'

import { useEffect } from 'react'

interface PrintTriggerProps {
  autoPrint?: boolean
}

export default function PrintTrigger({ autoPrint = false }: PrintTriggerProps) {
  useEffect(() => {
    if (autoPrint) {
      window.print()
    }
  }, [autoPrint])

  return null
}
