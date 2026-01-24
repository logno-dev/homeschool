'use client';

import { useRouter } from 'next/navigation';
import type { CalendarEvent } from '@/lib/events';

interface NextEventProps {
  nextEvent: CalendarEvent | null;
}

export default function NextEvent({ nextEvent }: NextEventProps) {
  const router = useRouter();

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
