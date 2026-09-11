'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Event, Session } from '@/lib/schema'
import Modal from './Modal'
import Button from './Button'
import Toast from './Toast'
import SessionOptions from './SessionOptions'
import { descriptionEditorHtml, descriptionPreview, eventHref, formatEventDate } from '@/lib/calendar'
import { EVENT_IMAGE_TYPES, MAX_EVENT_IMAGE_SIZE } from '@/lib/event-images'

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false, loading: () => <p className="p-3 text-sm text-gray-500">Loading editor…</p> })
const editorModules = { toolbar: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline', 'strike'], [{ list: 'ordered' }, { list: 'bullet' }], ['blockquote', 'link'], ['clean']] }
const editorFormats = ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'blockquote', 'link']

interface EventWithCreator extends Event {
  creatorName?: string
}

export default function EventManagement() {
  const [events, setEvents] = useState<EventWithCreator[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventWithCreator | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [toast, setToast] = useState<{ id: string; title: string; type: 'success' | 'error' } | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    bannerUrl: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    isAllDay: false,
    eventType: 'general',
    sessionId: '',
    location: '',
    color: '#3b82f6',
    isPublic: true
  })

  useEffect(() => {
    fetchEvents()
    fetchSessions()
  }, [])

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/admin/events')
      if (response.ok) {
        const data = await response.json()
        setEvents(data)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/admin/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || data)
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    }
  }

  const resetForm = () => {
    setUploadError('')
    setFormData({
      title: '',
      description: '',
      bannerUrl: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      isAllDay: false,
      eventType: 'general',
      sessionId: '',
      location: '',
      color: '#3b82f6',
      isPublic: true
    })
    setEditingEvent(null)
  }

  const openModal = (event?: EventWithCreator) => {
    setUploadError('')
    if (event) {
      setEditingEvent(event)
      setFormData({
        title: event.title,
        description: descriptionEditorHtml(event.description || ''),
        bannerUrl: event.bannerUrl || '',
        startDate: event.startDate,
        endDate: event.endDate || '',
        startTime: event.startTime || '',
        endTime: event.endTime || '',
        isAllDay: event.isAllDay,
        eventType: event.eventType,
        sessionId: event.sessionId || '',
        location: event.location || '',
        color: event.color,
        isPublic: event.isPublic
      })
    } else {
      resetForm()
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    if (isUploading || isSaving) return
    setIsModalOpen(false)
    resetForm()
  }

  const uploadBanner = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setUploadError('')
    if (!EVENT_IMAGE_TYPES.includes(file.type) || file.size === 0 || file.size > MAX_EVENT_IMAGE_SIZE) {
      setUploadError('Choose a JPG, PNG, WebP, or GIF image up to 4 MB.')
      return
    }
    setIsUploading(true)
    try {
      const data = new FormData()
      data.append('file', file)
      const response = await fetch('/api/admin/events/banner', { method: 'POST', body: data })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to upload banner')
      setFormData(current => ({ ...current, bannerUrl: payload.url }))
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Unable to upload banner')
    } finally { setIsUploading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isUploading || isSaving) return
    setIsSaving(true)
    
    try {
      const url = editingEvent ? `/api/admin/events/${editingEvent.id}` : '/api/admin/events'
      const method = editingEvent ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setToast({
          id: 'success',
          title: editingEvent ? 'Event updated successfully' : 'Event created successfully',
          type: 'success'
        })
        fetchEvents()
        setIsModalOpen(false)
        resetForm()
      } else {
        const error = await response.json()
        setToast({
          id: 'error',
          title: error.error || 'Failed to save event',
          type: 'error'
        })
      }
    } catch (error) {
      setToast({
        id: 'error',
        title: 'Failed to save event',
        type: 'error'
      })
    } finally { setIsSaving(false) }
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setToast({
          id: 'success',
          title: 'Event deleted successfully',
          type: 'success'
        })
        fetchEvents()
      } else {
        setToast({
          id: 'error',
          title: 'Failed to delete event',
          type: 'error'
        })
      }
    } catch (error) {
      setToast({
        id: 'error',
        title: 'Failed to delete event',
        type: 'error'
      })
    }
  }

  const eventTypeColors = {
    general: 'bg-blue-100 text-blue-800',
    session: 'bg-green-100 text-green-800',
    registration: 'bg-yellow-100 text-yellow-800',
    deadline: 'bg-red-100 text-red-800',
    holiday: 'bg-purple-100 text-purple-800'
  }

  if (isLoading) {
    return <div className="flex justify-center py-8">Loading events...</div>
  }

  return (
    <div className="space-y-6">
      {toast && (
        <Toast
          id={toast.id}
          title={toast.title}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Events</h2>
        <Button onClick={() => openModal()}>
          Add Event
        </Button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {events.length === 0 ? (
            <li className="px-6 py-4 text-center text-gray-500">
              No events found. Create your first event to get started.
            </li>
          ) : (
            events.map((event) => (
              <li key={event.id} className="px-6 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: event.color }}
                      />
                      <h3 className="text-sm font-medium text-gray-900">
                        {event.title}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${eventTypeColors[event.eventType as keyof typeof eventTypeColors]}`}>
                        {event.eventType}
                      </span>
                      {!event.isPublic && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Private
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 text-sm text-gray-600">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>
                          {formatEventDate(event)}
                        </span>
                        {!event.isAllDay && event.startTime && (
                          <span>
                            {event.startTime}
                            {event.endTime && ` - ${event.endTime}`}
                          </span>
                        )}
                        {event.location && (
                          <span>📍 {event.location}</span>
                        )}
                      </div>
                      {event.description && (
                        <p className="mt-1 line-clamp-2 break-words text-gray-500">{descriptionPreview(event.description)}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Link href={eventHref(event)} className="text-blue-600 hover:text-blue-900 text-sm font-medium">View</Link>
                    <button
                      onClick={() => openModal(event)}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium"
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

      <Modal 
        isOpen={isModalOpen} 
        onClose={closeModal}
        title={editingEvent ? 'Edit Event' : 'Create Event'}
        size="lg"
      >
        <div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="event-title" className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="event-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <ReactQuill
                theme="snow"
                value={formData.description}
                onChange={description => setFormData(current => ({ ...current, description }))}
                modules={editorModules}
                formats={editorFormats}
                placeholder="Share the details, what to bring, and any helpful links…"
                className="event-editor bg-white"
                readOnly={isSaving}
              />
            </div>

            <div className="space-y-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
              <label htmlFor="event-banner" className="block text-sm font-medium text-gray-700">Event banner (optional)</label>
              {formData.bannerUrl && <img src={formData.bannerUrl} alt="Event banner preview" className="h-auto w-full rounded-md" />}
              <input id="event-banner" type="file" accept={EVENT_IMAGE_TYPES.join(',')} onChange={uploadBanner} disabled={isUploading || isSaving} aria-describedby="event-banner-help" className="block w-full min-w-0 text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-blue-700" />
              <p id="event-banner-help" className="text-xs text-gray-500">JPG, PNG, WebP, or GIF, up to 4 MB. The complete image will display at its original aspect ratio.</p>
              {isUploading && <p role="status" className="text-sm text-blue-700">Uploading banner…</p>}
              {uploadError && <p role="alert" className="text-sm text-red-700">{uploadError}</p>}
              {formData.bannerUrl && <button type="button" disabled={isUploading || isSaving} onClick={() => setFormData(current => ({ ...current, bannerUrl: '' }))} className="text-sm font-medium text-red-600 disabled:opacity-50">Remove banner</button>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="event-start-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  id="event-start-date"
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="event-end-date" className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  id="event-end-date"
                  value={formData.endDate}
                  min={formData.startDate || undefined}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isAllDay"
                checked={formData.isAllDay}
                onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isAllDay" className="ml-2 block text-sm text-gray-900">
                All day event
              </label>
            </div>

            {!formData.isAllDay && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Type
                </label>
                <select
                  value={formData.eventType}
                  onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="general">General</option>
                  <option value="session">Session</option>
                  <option value="registration">Registration</option>
                  <option value="deadline">Deadline</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session (Optional)
                </label>
                <select
                  value={formData.sessionId}
                  onChange={(e) => setFormData({ ...formData, sessionId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No session</option>
                  <SessionOptions sessions={sessions} />
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 px-1 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-900">
                  Public event
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={closeModal}
                disabled={isSaving || isUploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || isUploading}>
                {isSaving ? 'Saving…' : isUploading ? 'Uploading banner…' : editingEvent ? 'Update Event' : 'Create Event'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  )
}
