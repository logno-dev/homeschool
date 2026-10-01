'use client'

import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  School,
  Trash2
} from 'lucide-react'
import type { Classroom } from '@/lib/schema'
import ConfirmModal from './ConfirmModal'
import Modal from './Modal'
import { useToast } from './ToastContainer'

interface ClassroomManagementProps {
  initialClassrooms: Classroom[]
}

export default function ClassroomManagement({ initialClassrooms }: ClassroomManagementProps) {
  const [classrooms, setClassrooms] = useState<Classroom[]>(initialClassrooms)
  const [isSaving, setIsSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null)
  const [deletingClassroom, setDeletingClassroom] = useState<Classroom | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    syncActiveSessions: true
  })
  const { showError, showSuccess } = useToast()

  const resetForm = () => {
    setFormData({ name: '', description: '', syncActiveSessions: true })
    setEditingClassroom(null)
    setShowForm(false)
  }

  const handleCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const handleEdit = (classroom: Classroom) => {
    setFormData({
      name: classroom.name,
      description: classroom.description || '',
      syncActiveSessions: true
    })
    setEditingClassroom(classroom)
    setShowForm(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)

    try {
      const response = await fetch(
        editingClassroom ? `/api/admin/classrooms/${editingClassroom.id}` : '/api/admin/classrooms',
        {
          method: editingClassroom ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        }
      )
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to save classroom')

      setClassrooms((current) => editingClassroom
        ? current.map((classroom) => classroom.id === editingClassroom.id ? data.classroom : classroom)
        : [...current, data.classroom]
      )
      showSuccess(
        editingClassroom ? 'Classroom updated' : 'Classroom created',
        editingClassroom && formData.syncActiveSessions
          ? 'The active session schedule now uses the updated classroom details.'
          : undefined
      )
      resetForm()
    } catch (error) {
      console.error('Error saving classroom:', error)
      showError(error instanceof Error ? error.message : 'Failed to save classroom')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingClassroom) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/classrooms/${deletingClassroom.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to delete classroom')

      setClassrooms((current) => current.filter((classroom) => classroom.id !== deletingClassroom.id))
      setDeletingClassroom(null)
      showSuccess('Classroom deleted')
    } catch (error) {
      console.error('Error deleting classroom:', error)
      showError(error instanceof Error ? error.message : 'Failed to delete classroom')
    } finally {
      setIsSaving(false)
    }
  }

  const saveOrder = async (reordered: Classroom[], previous: Classroom[]) => {
    setClassrooms(reordered)
    setIsReordering(true)

    try {
      const response = await fetch('/api/admin/classrooms/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: reordered.map((classroom) => ({ id: classroom.id, orderIndex: classroom.orderIndex }))
        })
      })

      if (!response.ok) throw new Error('Failed to update classroom order')
    } catch (error) {
      console.error('Error updating classroom order:', error)
      setClassrooms(previous)
      showError('The classroom order could not be saved. Your previous order was restored.')
    } finally {
      setIsReordering(false)
    }
  }

  const moveClassroom = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= classrooms.length || isReordering) return

    const previous = classrooms
    const updated = [...classrooms]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    const reordered = updated.map((classroom, index) => ({ ...classroom, orderIndex: index }))
    void saveOrder(reordered, previous)
  }

  const handleDrop = (targetId: string) => {
    const currentIndex = classrooms.findIndex((classroom) => classroom.id === draggedId)
    const targetIndex = classrooms.findIndex((classroom) => classroom.id === targetId)
    setDraggedId(null)
    setDropTargetId(null)

    if (currentIndex >= 0 && targetIndex >= 0) moveClassroom(currentIndex, targetIndex)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Schedule setup</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">Classrooms</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Set the rooms and display order used when building schedules. Changes can safely sync to active sessions without altering class assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add classroom
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/70 px-4 py-3 sm:px-6">
          <p className="text-sm font-medium text-gray-700">
            {classrooms.length} {classrooms.length === 1 ? 'classroom' : 'classrooms'}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500" aria-live="polite">
            {isReordering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GripVertical className="h-3.5 w-3.5" />}
            {isReordering ? 'Saving order...' : 'Drag to reorder'}
          </div>
        </div>

        {classrooms.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <School className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-semibold text-gray-900">No classrooms yet</h2>
            <p className="mt-1 text-sm text-gray-500">Add the first room to start building a schedule.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {classrooms.map((classroom, index) => {
              const isDragged = draggedId === classroom.id
              const isDropTarget = dropTargetId === classroom.id && draggedId !== classroom.id

              return (
                <li
                  key={classroom.id}
                  draggable={!isReordering}
                  onDragStart={(event) => {
                    setDraggedId(classroom.id)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', classroom.id)
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    if (draggedId !== classroom.id) setDropTargetId(classroom.id)
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    handleDrop(classroom.id)
                  }}
                  onDragEnd={() => {
                    setDraggedId(null)
                    setDropTargetId(null)
                  }}
                  className={`group relative transition ${
                    isDragged ? 'bg-blue-50/60 opacity-50' : 'bg-white hover:bg-gray-50/70'
                  } ${isDropTarget ? 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-blue-500' : ''}`}
                >
                  <div className="flex items-center gap-3 px-3 py-4 sm:gap-4 sm:px-6">
                    <button
                      type="button"
                      className="cursor-grab touch-none rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
                      aria-label={`Drag ${classroom.name} to reorder`}
                      title="Drag to reorder"
                    >
                      <GripVertical className="h-5 w-5" aria-hidden="true" />
                    </button>

                    <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 sm:flex">
                      <School className="h-5 w-5" aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold text-gray-950">{classroom.name}</h2>
                      <p className={`mt-0.5 truncate text-sm ${classroom.description ? 'text-gray-500' : 'italic text-gray-400'}`}>
                        {classroom.description || 'No description'}
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveClassroom(index, index - 1)}
                        disabled={index === 0 || isReordering}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Move ${classroom.name} up`}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveClassroom(index, index + 1)}
                        disabled={index === classrooms.length - 1 || isReordering}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Move ${classroom.name} down`}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 border-l border-gray-200 pl-2 sm:pl-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(classroom)}
                        disabled={isSaving || isReordering}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-gray-600 transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 sm:px-3"
                        aria-label={`Edit ${classroom.name}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden lg:inline">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingClassroom(classroom)}
                        disabled={isSaving || isReordering}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50 sm:px-3"
                        aria-label={`Delete ${classroom.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden lg:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={isSaving ? () => {} : resetForm}
        title={editingClassroom ? 'Edit classroom' : 'Add classroom'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="classroom-name" className="mb-1.5 block text-sm font-medium text-gray-700">
              Classroom name
            </label>
            <input
              id="classroom-name"
              type="text"
              required
              autoFocus
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="e.g. Art Studio"
            />
          </div>

          <div>
            <label htmlFor="classroom-description" className="mb-1.5 block text-sm font-medium text-gray-700">
              Description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              id="classroom-description"
              rows={3}
              value={formData.description}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              className="w-full resize-none rounded-xl border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="Equipment, location, or special features"
            />
          </div>

          {editingClassroom && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
              <input
                type="checkbox"
                checked={formData.syncActiveSessions}
                onChange={(event) => setFormData({ ...formData, syncActiveSessions: event.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">Update active session schedules</span>
                <span className="mt-0.5 block text-sm leading-5 text-gray-600">
                  Updates this room's name and description in active sessions only. Class assignments and historical sessions stay unchanged.
                </span>
              </span>
            </label>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={resetForm}
              disabled={isSaving}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !formData.name.trim()}
              className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSaving ? 'Saving...' : editingClassroom ? 'Save changes' : 'Add classroom'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(deletingClassroom)}
        onClose={() => setDeletingClassroom(null)}
        onConfirm={handleDelete}
        title="Delete classroom?"
        message={`Delete ${deletingClassroom?.name || 'this classroom'}? Rooms used in a schedule or saved draft are protected and cannot be deleted.`}
        confirmText="Delete classroom"
        confirmVariant="danger"
        isLoading={isSaving}
      />
    </div>
  )
}
