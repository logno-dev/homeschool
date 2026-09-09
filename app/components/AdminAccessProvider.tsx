'use client'

import { createContext, useContext } from 'react'
import type { AdminModule } from '@/lib/admin-access'

const AdminAccessContext = createContext<AdminModule[]>([])

export function useAdminModules() {
  return useContext(AdminAccessContext)
}

export default function AdminAccessProvider({ modules, children }: { modules: AdminModule[]; children: React.ReactNode }) {
  return <AdminAccessContext.Provider value={modules}>{children}</AdminAccessContext.Provider>
}
