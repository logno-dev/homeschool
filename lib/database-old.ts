// Database schema and types for the homeschool cooperative

export interface Family {
  id: string
  name: string // Family name (e.g., "The Smith Family")
  address: string
  phone: string
  email: string // Primary family contact email
  sharingCode: string // Unique code for other guardians to join
  annualFeePaid: boolean
  feePaymentDate?: string
  createdAt: string
  updatedAt: string
}

export interface Guardian {
  id: string // This should match the ID from your auth provider
  email: string
  firstName: string
  lastName: string
  role: 'user' | 'admin' | 'moderator' | 'member'
  familyId: string // Links to Family table
  isMainContact: boolean // The guardian who created the family
  phone?: string
  createdAt: string
  updatedAt: string
}

export interface Child {
  id: string
  familyId: string
  firstName: string
  lastName: string
  dateOfBirth: string
  grade: string
  allergies?: string
  medicalNotes?: string
  emergencyContact?: string
  emergencyPhone?: string
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string // This should match the ID from your auth provider
  email: string
  firstName: string
  lastName: string
  role: 'user' | 'admin' | 'moderator' | 'member'
  familyId?: string // Links to Family table
  dateOfBirth?: string // For students
  grade?: string // For students
  emergencyContact?: string // For students
  createdAt: string
  updatedAt: string
}

export interface FeePayment {
  id: string
  familyId: string
  amount: number
  paymentDate: string
  paymentMethod: 'cash' | 'check' | 'online'
  notes?: string
  createdAt: string
}

// In-memory storage (replace with actual database in production)
let families: Family[] = []
let guardians: Guardian[] = []
let children: Child[] = []
let users: User[] = []
let feePayments: FeePayment[] = []

// Helper function to generate sharing codes
function generateSharingCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Family management functions
export function createFamily(familyData: Omit<Family, 'id' | 'createdAt' | 'updatedAt' | 'sharingCode'>): Family {
  const family: Family = {
    ...familyData,
    id: Date.now().toString(),
    sharingCode: generateSharingCode(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  families.push(family)
  return family
}

export function findFamilyBySharingCode(sharingCode: string): Family | null {
  return families.find(f => f.sharingCode === sharingCode) || null
}

// Guardian management functions
export function createGuardian(guardianData: Omit<Guardian, 'createdAt' | 'updatedAt'>): Guardian {
  const guardian: Guardian = {
    ...guardianData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  guardians.push(guardian)
  return guardian
}

export function getGuardiansByFamily(familyId: string): Guardian[] {
  return guardians.filter(g => g.familyId === familyId)
}

export function getGuardianById(id: string): Guardian | null {
  return guardians.find(g => g.id === id) || null
}

export function updateGuardian(id: string, updates: Partial<Omit<Guardian, 'id' | 'createdAt'>>): Guardian | null {
  const guardianIndex = guardians.findIndex(g => g.id === id)
  if (guardianIndex === -1) return null
  
  guardians[guardianIndex] = {
    ...guardians[guardianIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }
  return guardians[guardianIndex]
}

// Child management functions
export function createChild(childData: Omit<Child, 'id' | 'createdAt' | 'updatedAt'>): Child {
  const child: Child = {
    ...childData,
    id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  children.push(child)
  return child
}

export function getChildrenByFamily(familyId: string): Child[] {
  return children.filter(c => c.familyId === familyId)
}

export function getChildById(id: string): Child | null {
  return children.find(c => c.id === id) || null
}

export function updateChild(id: string, updates: Partial<Omit<Child, 'id' | 'createdAt'>>): Child | null {
  const childIndex = children.findIndex(c => c.id === id)
  if (childIndex === -1) return null
  
  children[childIndex] = {
    ...children[childIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }
  return children[childIndex]
}

export function deleteChild(id: string): boolean {
  const childIndex = children.findIndex(c => c.id === id)
  if (childIndex === -1) return false
  
  children.splice(childIndex, 1)
  return true
}

export function getFamilies(): Family[] {
  return families
}

export function getFamilyById(id: string): Family | null {
  return families.find(f => f.id === id) || null
}

export function updateFamily(id: string, updates: Partial<Omit<Family, 'id' | 'createdAt'>>): Family | null {
  const familyIndex = families.findIndex(f => f.id === id)
  if (familyIndex === -1) return null
  
  families[familyIndex] = {
    ...families[familyIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }
  return families[familyIndex]
}

// User management functions
export function createUser(userData: Omit<User, 'createdAt' | 'updatedAt'>): User {
  const user: User = {
    ...userData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  users.push(user)
  return user
}

export function getUsers(): User[] {
  return users
}

export function getUserById(id: string): User | null {
  return users.find(u => u.id === id) || null
}

export function getUsersByFamily(familyId: string): User[] {
  return users.filter(u => u.familyId === familyId)
}

export function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): User | null {
  const userIndex = users.findIndex(u => u.id === id)
  if (userIndex === -1) return null
  
  users[userIndex] = {
    ...users[userIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }
  return users[userIndex]
}

// Fee payment functions
export function recordFeePayment(paymentData: Omit<FeePayment, 'id' | 'createdAt'>): FeePayment {
  const payment: FeePayment = {
    ...paymentData,
    id: Date.now().toString(),
    createdAt: new Date().toISOString()
  }
  feePayments.push(payment)
  
  // Update family fee status
  updateFamily(paymentData.familyId, { 
    annualFeePaid: true, 
    feePaymentDate: paymentData.paymentDate 
  })
  
  return payment
}

export function getFeePaymentsByFamily(familyId: string): FeePayment[] {
  return feePayments.filter(p => p.familyId === familyId)
}

// Permission checking functions
export function canAccessFeature(userId: string, feature: 'class_schedules' | 'class_registration' | 'activities'): boolean {
  const user = getUserById(userId)
  if (!user) return false
  
  // Admins have access to everything
  if (user.role === 'admin') return true
  
  // Check if user's family has paid fees for restricted features
  if (feature === 'class_schedules' || feature === 'class_registration') {
    if (user.familyId) {
      const family = getFamilyById(user.familyId)
      if (!family?.annualFeePaid) return false
    }
  }
  
  return true
}

// Initialize with some sample data
export function initializeSampleData() {
  // Create sample families
  const smithFamily = createFamily({
    name: "The Smith Family",
    address: "123 Main St, Anytown, ST 12345",
    phone: "(555) 123-4567",
    email: "smith.family@example.com",
    annualFeePaid: true,
    feePaymentDate: "2024-08-15"
  })
  
  const johnsonFamily = createFamily({
    name: "The Johnson Family", 
    address: "456 Oak Ave, Anytown, ST 12345",
    phone: "(555) 987-6543",
    email: "johnson.family@example.com",
    annualFeePaid: false
  })

  // Create sample guardians
  createGuardian({
    id: "user_1",
    email: "john.smith@example.com",
    firstName: "John",
    lastName: "Smith",
    role: "user",
    familyId: smithFamily.id,
    isMainContact: true,
    phone: "(555) 123-4567"
  })

  createGuardian({
    id: "user_2",
    email: "jane.smith@example.com",
    firstName: "Jane",
    lastName: "Smith",
    role: "user",
    familyId: smithFamily.id,
    isMainContact: false,
    phone: "(555) 123-4568"
  })

  createGuardian({
    id: "user_4",
    email: "mike.johnson@example.com",
    firstName: "Mike",
    lastName: "Johnson",
    role: "user",
    familyId: johnsonFamily.id,
    isMainContact: true,
    phone: "(555) 987-6543"
  })

  // Create sample children
  createChild({
    familyId: smithFamily.id,
    firstName: "Emma",
    lastName: "Smith",
    dateOfBirth: "2015-03-15",
    grade: "3rd Grade",
    allergies: "Peanuts",
    emergencyContact: "Grandma Smith",
    emergencyPhone: "(555) 123-9999"
  })

  createChild({
    familyId: smithFamily.id,
    firstName: "Liam",
    lastName: "Smith",
    dateOfBirth: "2017-07-22",
    grade: "1st Grade",
    emergencyContact: "Grandma Smith",
    emergencyPhone: "(555) 123-9999"
  })

  createChild({
    familyId: johnsonFamily.id,
    firstName: "Sophia",
    lastName: "Johnson",
    dateOfBirth: "2014-11-08",
    grade: "4th Grade",
    medicalNotes: "Asthma - has inhaler",
    emergencyContact: "Uncle Tom",
    emergencyPhone: "(555) 987-1111"
  })
  
  // Create sample users
  createUser({
    id: "user_1",
    email: "john.smith@example.com",
    firstName: "John",
    lastName: "Smith",
    role: "user",
    familyId: smithFamily.id
  })
  
  createUser({
    id: "user_2", 
    email: "jane.smith@example.com",
    firstName: "Jane",
    lastName: "Smith", 
    role: "user",
    familyId: smithFamily.id
  })
  
  createUser({
    id: "user_3",
    email: "admin@dvclc.org",
    firstName: "Admin",
    lastName: "User",
    role: "admin"
  })
  
  createUser({
    id: "user_4",
    email: "mike.johnson@example.com", 
    firstName: "Mike",
    lastName: "Johnson",
    role: "user",
    familyId: johnsonFamily.id
  })
}

// Initialize sample data
initializeSampleData()