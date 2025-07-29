'use client'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
  className?: string
}

export default function LoadingSpinner({ 
  size = 'md', 
  text, 
  fullScreen = false,
  className = ''
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  const spinner = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`}></div>
      {text && (
        <p className={`mt-3 text-gray-600 ${textSizeClasses[size]} text-center px-4`}>
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 mx-4 max-w-sm w-full">
          {spinner}
        </div>
      </div>
    )
  }

  return spinner
}

// Mobile-optimized skeleton components
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white rounded-lg border p-4 ${className}`}>
      <div className="flex items-center space-x-3 mb-3">
        <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        <div className="h-3 bg-gray-200 rounded w-4/6"></div>
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, className = '' }: { rows?: number, className?: string }) {
  return (
    <div className={`animate-pulse ${className}`}>
      {/* Desktop table skeleton */}
      <div className="hidden md:block">
        <div className="bg-gray-50 rounded-t-lg p-4 border-b">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-b-lg">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="p-4 border-b border-gray-100 last:border-b-0">
              <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile card skeleton */}
      <div className="md:hidden space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonButton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse h-10 bg-gray-200 rounded-md ${className}`}></div>
  )
}

export function SkeletonText({ 
  lines = 3, 
  className = '' 
}: { 
  lines?: number, 
  className?: string 
}) {
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i} 
          className={`h-4 bg-gray-200 rounded ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        ></div>
      ))}
    </div>
  )
}