declare module '@workos-inc/node' {
  export class WorkOS {
    constructor(apiKey: string)
    userManagement: {
      listOrganizationMemberships: (params: {
        organizationId: string
        limit?: number
        offset?: number
      }) => Promise<{
        data: Array<{
          id: string
          role: string
          status?: string
          userId?: string
          user: {
            email: string
            firstName?: string | null
            lastName?: string | null
          }
        }>
        listMetadata?: {
          total?: number
        }
      }>
      getUser: (id: string) => Promise<{
        id: string
        email: string
        firstName?: string | null
        lastName?: string | null
      }>
      updateOrganizationMembership: (id: string, params: { roleSlug?: string; roleSlugs?: string[] }) => Promise<{ id: string; role?: string; status?: string }>
      deactivateOrganizationMembership: (id: string) => Promise<void>
    }
  }
}
