'use client'

import { useEffect } from 'react'

export default function EmulatePage() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    const activeToken = token || sessionStorage.getItem('dvclc_emulation_token')
    if (activeToken) {
      sessionStorage.setItem('dvclc_emulation_token', activeToken)
      document.cookie = `dvclc_emulation_token=${encodeURIComponent(activeToken)}; Path=/emulate; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
      window.location.replace('/emulate/dashboard')
    }
  }, [])

  return <div className="min-h-screen flex items-center justify-center text-gray-600">Starting emulation...</div>
}
