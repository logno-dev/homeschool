export const ADMIN_MODULES = [
  { key: 'users', label: 'User Management', supremeOnly: true },
  { key: 'groups', label: 'User Groups', supremeOnly: true },
  { key: 'newsletters', label: 'Newsletters', supremeOnly: false },
  { key: 'sessions', label: 'Session Management', supremeOnly: false },
  { key: 'registrations', label: 'Registrations', supremeOnly: false },
  { key: 'reports', label: 'Reports', supremeOnly: false },
  { key: 'class-requests', label: 'Classes', supremeOnly: false },
  { key: 'classrooms', label: 'Classrooms', supremeOnly: false },
  { key: 'volunteer-jobs', label: 'Volunteer Jobs', supremeOnly: false },
  { key: 'registration-overrides', label: 'Registration Overrides', supremeOnly: false },
  { key: 'events', label: 'Events', supremeOnly: false },
  { key: 'payments', label: 'Payments', supremeOnly: false },
  { key: 'scholarships', label: 'Scholarships', supremeOnly: false },
  { key: 'settings', label: 'Settings', supremeOnly: true },
  { key: 'faqs', label: 'FAQs', supremeOnly: false },
] as const

export type AdminModule = typeof ADMIN_MODULES[number]['key']
