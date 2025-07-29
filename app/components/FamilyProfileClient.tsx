'use client'

import { useState } from 'react'
import Modal from './Modal'
import { useToast } from './ToastContainer'

interface Child {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string
  grade: string
  allergies: string | null
  medicalNotes: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
}

interface Guardian {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  isMainContact: boolean
}

interface Family {
  id: string
  name: string
  address: string
  phone: string
  email: string
  sharingCode: string
  createdAt: string
  updatedAt: string
}

interface FamilyProfileClientProps {
  family: Family
  guardians: Guardian[]
  children: Child[]
}

export default function FamilyProfileClient({ family, guardians, children: initialChildren }: FamilyProfileClientProps) {
  const [children, setChildren] = useState(initialChildren)
  const [selectedChild, setSelectedChild] = useState<Child | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editForm, setEditForm] = useState<Child | null>(null)
  const [addForm, setAddForm] = useState<Partial<Child>>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    grade: '',
    allergies: '',
    medicalNotes: '',
    emergencyContact: '',
    emergencyPhone: ''
  })
  const [loading, setLoading] = useState(false)
  const [expandedChildren, setExpandedChildren] = useState<Set<string>>(new Set())
  const { showSuccess, showError } = useToast()

  const openEditModal = (child: Child) => {
    setSelectedChild(child)
    setEditForm({ ...child })
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedChild(null)
    setEditForm(null)
  }

  const openAddModal = () => {
    setAddForm({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      grade: '',
      allergies: '',
      medicalNotes: '',
      emergencyContact: '',
      emergencyPhone: ''
    })
    setIsAddModalOpen(true)
  }

  const closeAddModal = () => {
    setIsAddModalOpen(false)
    setAddForm({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      grade: '',
      allergies: '',
      medicalNotes: '',
      emergencyContact: '',
      emergencyPhone: ''
    })
  }

  const toggleChildExpansion = (childId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newExpanded = new Set(expandedChildren)
    if (newExpanded.has(childId)) {
      newExpanded.delete(childId)
    } else {
      newExpanded.add(childId)
    }
    setExpandedChildren(newExpanded)
  }

  const handleInputChange = (field: keyof Child, value: string) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value })
    }
  }

  const handleAddInputChange = (field: keyof Child, value: string) => {
    setAddForm({ ...addForm, [field]: value })
  }

  const handleSave = async () => {
    if (!editForm || !selectedChild) return

    setLoading(true)

    try {
      const response = await fetch(`/api/family/children/${selectedChild.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      })

      const data = await response.json()

      if (response.ok) {
        setChildren(children.map(child => 
          child.id === selectedChild.id ? data.child : child
        ))
        showSuccess('Child information updated successfully!')
        closeEditModal()
      } else {
        showError('Failed to update child information', data.error)
      }
    } catch (error) {
      console.error('Error updating child:', error)
      showError('Error updating child information')
    } finally {
      setLoading(false)
    }
  }

  const handleAddChild = async () => {
    if (!addForm.firstName || !addForm.lastName || !addForm.dateOfBirth || !addForm.grade) {
      showError('Please fill in all required fields')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/family/children', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addForm),
      })

      const data = await response.json()

      if (response.ok) {
        setChildren([...children, data.child])
        showSuccess('Child added successfully!')
        closeAddModal()
      } else {
        showError('Failed to add child', data.error)
      }
    } catch (error) {
      console.error('Error adding child:', error)
      showError('Error adding child')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Children */}
      <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Children</h2>
          <button
            onClick={openAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Child
          </button>
        </div>
        {children.length === 0 ? (
          <p className="text-gray-500">No children registered yet. Click "Add Child" to get started.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children.map((child) => {
              const isExpanded = expandedChildren.has(child.id)
              const hasAdditionalInfo = child.allergies || child.medicalNotes || child.emergencyContact
              
              return (
                <div 
                  key={child.id} 
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900">
                      {child.firstName} {child.lastName}
                    </h3>
                    <div className="flex items-center space-x-2">
                      {hasAdditionalInfo && (
                        <button
                          onClick={(e) => toggleChildExpansion(child.id, e)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={isExpanded ? 'Show less' : 'Show more'}
                        >
                          <svg 
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(child)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        aria-label="Edit child"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Always visible basic info */}
                  <div className="space-y-1 text-sm text-gray-700">
                    <p><span className="font-medium text-gray-900">Grade:</span> {child.grade}</p>
                    <p><span className="font-medium text-gray-900">DOB:</span> {new Date(child.dateOfBirth).toLocaleDateString()}</p>
                  </div>
                  
                  {/* Collapsible additional info */}
                  {hasAdditionalInfo && (
                    <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 mt-2' : 'max-h-0'}`}>
                      <div className="space-y-1 text-sm text-gray-700 pt-2 border-t border-gray-100">
                        {child.allergies && (
                          <p><span className="font-medium text-gray-900">Allergies:</span> {child.allergies}</p>
                        )}
                        {child.medicalNotes && (
                          <p><span className="font-medium text-gray-900">Medical:</span> {child.medicalNotes}</p>
                        )}
                        {child.emergencyContact && (
                          <p><span className="font-medium text-gray-900">Emergency:</span> {child.emergencyContact} {child.emergencyPhone && `(${child.emergencyPhone})`}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Show more indicator for mobile */}
                  {hasAdditionalInfo && !isExpanded && (
                    <div className="mt-2 md:hidden">
                      <button
                        onClick={(e) => toggleChildExpansion(child.id, e)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <span>Show additional info</span>
                        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Child Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        title={`Edit ${selectedChild?.firstName} ${selectedChild?.lastName}`}
        size="lg"
      >
        {editForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={editForm.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={editForm.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grade
                </label>
                <select
                  value={editForm.grade}
                  onChange={(e) => handleInputChange('grade', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  required
                >
                  <option value="">Select Grade</option>
                  <option value="Pre-K">Pre-K</option>
                  <option value="Kindergarten">Kindergarten</option>
                  <option value="1st Grade">1st Grade</option>
                  <option value="2nd Grade">2nd Grade</option>
                  <option value="3rd Grade">3rd Grade</option>
                  <option value="4th Grade">4th Grade</option>
                  <option value="5th Grade">5th Grade</option>
                  <option value="6th Grade">6th Grade</option>
                  <option value="7th Grade">7th Grade</option>
                  <option value="8th Grade">8th Grade</option>
                  <option value="9th Grade">9th Grade</option>
                  <option value="10th Grade">10th Grade</option>
                  <option value="11th Grade">11th Grade</option>
                  <option value="12th Grade">12th Grade</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allergies
                </label>
                <input
                  type="text"
                  value={editForm.allergies || ''}
                  onChange={(e) => handleInputChange('allergies', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="None or list allergies"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medical Notes
                </label>
                <input
                  type="text"
                  value={editForm.medicalNotes || ''}
                  onChange={(e) => handleInputChange('medicalNotes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="Any medical conditions or notes"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emergency Contact
                </label>
                <input
                  type="text"
                  value={editForm.emergencyContact || ''}
                  onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="Grandparent, relative, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emergency Phone
                </label>
                <input
                  type="tel"
                  value={editForm.emergencyPhone || ''}
                  onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:bg-blue-400"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Child Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        title="Add New Child"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                value={addForm.firstName || ''}
                onChange={(e) => handleAddInputChange('firstName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                value={addForm.lastName || ''}
                onChange={(e) => handleAddInputChange('lastName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth *
              </label>
              <input
                type="date"
                value={addForm.dateOfBirth || ''}
                onChange={(e) => handleAddInputChange('dateOfBirth', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grade *
              </label>
              <select
                value={addForm.grade || ''}
                onChange={(e) => handleAddInputChange('grade', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                required
              >
                <option value="">Select Grade</option>
                <option value="Pre-K">Pre-K</option>
                <option value="Kindergarten">Kindergarten</option>
                <option value="1st Grade">1st Grade</option>
                <option value="2nd Grade">2nd Grade</option>
                <option value="3rd Grade">3rd Grade</option>
                <option value="4th Grade">4th Grade</option>
                <option value="5th Grade">5th Grade</option>
                <option value="6th Grade">6th Grade</option>
                <option value="7th Grade">7th Grade</option>
                <option value="8th Grade">8th Grade</option>
                <option value="9th Grade">9th Grade</option>
                <option value="10th Grade">10th Grade</option>
                <option value="11th Grade">11th Grade</option>
                <option value="12th Grade">12th Grade</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allergies
              </label>
              <input
                type="text"
                value={addForm.allergies || ''}
                onChange={(e) => handleAddInputChange('allergies', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="None or list allergies"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medical Notes
              </label>
              <input
                type="text"
                value={addForm.medicalNotes || ''}
                onChange={(e) => handleAddInputChange('medicalNotes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="Any medical conditions or notes"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Emergency Contact
              </label>
              <input
                type="text"
                value={addForm.emergencyContact || ''}
                onChange={(e) => handleAddInputChange('emergencyContact', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="Grandparent, relative, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Emergency Phone
              </label>
              <input
                type="tel"
                value={addForm.emergencyPhone || ''}
                onChange={(e) => handleAddInputChange('emergencyPhone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={closeAddModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleAddChild}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:bg-blue-400"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Child'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}