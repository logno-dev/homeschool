'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Event {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  eventType: string;
  color: string;
}

export default function NextEvent() {
  const [nextEvent, setNextEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchNextEvent = async () => {
      try {
        const response = await fetch('/api/events');
        if (response.ok) {
          const events: Event[] = await response.json();
          
          const now = new Date();
          const upcomingEvents = events
            .filter(event => new Date(event.startDate) >= now)
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
          
          setNextEvent(upcomingEvents[0] || null);
        }
      } catch (error) {
        console.error('Error fetching next event:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNextEvent();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-3 bg-gray-200 rounded mb-4"></div>
        <div className="h-8 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!nextEvent) {
    return (
      <div>
        <p className="text-gray-600 mb-4">No upcoming events scheduled</p>
        <button
          onClick={() => router.push('/calendar')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium w-full"
        >
          View Calendar
        </button>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: nextEvent.color }}
          ></div>
          <h4 className="font-medium text-gray-900">{nextEvent.title}</h4>
        </div>
        
        <div className="text-sm text-gray-600 mb-1">
          {formatDate(nextEvent.startDate)}
          {nextEvent.startTime && ` at ${formatTime(nextEvent.startTime)}`}
        </div>
        
        {nextEvent.description && (
          <p className="text-sm text-gray-500 line-clamp-2">{nextEvent.description}</p>
        )}
      </div>
      
      <button
        onClick={() => router.push('/calendar')}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium w-full"
      >
        View Full Calendar
      </button>
    </div>
  );
}