'use client'

import { useState } from 'react'
import type { Classroom } from '@/lib/schema'

interface ClassroomManagementProps {
  initialClassrooms: Classroom[]
}

export default function ClassroomManagement({ initialClassrooms }: ClassroomManagementProps) {
  const [classrooms, setClassrooms] = useState<Classroom[]>(initialClassrooms)
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: ''
    })
    setEditingClassroom(null)
    setShowForm(false)
  }

  const handleEdit = (classroom: Classroom) => {
    setFormData({
      name: classroom.name,
      description: classroom.description || ''
    })
    setEditingClassroom(classroom)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const url = editingClassroom 
        ? `/api/admin/classrooms/${editingClassroom.id}`
        : '/api/admin/classrooms'
      
      const method = editingClassroom ? 'PATCH' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Failed to save classroom')
      }

      const data = await response.json()
      
      if (editingClassroom) {
        setClassrooms(classrooms.map(c => c.id === editingClassroom.id ? data.classroom : c))
      } else {
        setClassrooms([...classrooms, data.classroom])
      }

      resetForm()
    } catch (error) {
      console.error('Error saving classroom:', error)
      alert('Failed to save classroom')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (classroomId: string) => {
    if (!confirm('Are you sure you want to delete this classroom?')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/classrooms/${classroomId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete classroom')
      }

      setClassrooms(classrooms.filter(c => c.id !== classroomId))
    } catch (error) {
      console.error('Error deleting classroom:', error)
      alert('Failed to delete classroom')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Classroom Management</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Add New Classroom
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingClassroom ? 'Edit Classroom' : 'Create New Classroom'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Classroom Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Room 101, Art Studio, Science Lab"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optional description of the classroom, equipment, or special features"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : editingClassroom ? 'Update Classroom' : 'Create Classroom'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {classrooms.length === 0 ? (
            <li className="px-6 py-4 text-center text-gray-500">
              No classrooms found. Create your first classroom to get started.
            </li>
          ) : (
            classrooms.map((classroom) => (
              <li key={classroom.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {classroom.name}
                    </h3>
                    {classroom.description && (
                      <p className="mt-1 text-sm text-gray-600">{classroom.description}</p>
                    )}
                    <div className="mt-2 text-sm text-gray-500">
                      Created: {formatDate(classroom.createdAt)}
                      {classroom.updatedAt !== classroom.createdAt && (
                        <span className="ml-4">
                          Updated: {formatDate(classroom.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(classroom)}
                      disabled={isLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(classroom.id)}
                      disabled={isLoading}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}