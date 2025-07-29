'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

interface PopoverProps {
  children: ReactNode
  content: ReactNode
  trigger?: 'hover' | 'click'
  delay?: number
  placement?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  disabled?: boolean
}

export default function Popover({ 
  children, 
  content, 
  trigger = 'hover', 
  delay = 500,
  placement = 'top',
  className = '',
  disabled = false
}: PopoverProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const calculatePosition = () => {
    if (!triggerRef.current || !popoverRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const popoverRect = popoverRef.current.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    let top = 0
    let left = 0
    let actualPlacement = placement

    // Calculate initial position based on preferred placement
    switch (placement) {
      case 'top':
        top = triggerRect.top - popoverRect.height - 8
        left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2
        break
      case 'bottom':
        top = triggerRect.bottom + 8
        left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2
        break
      case 'left':
        top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2
        left = triggerRect.left - popoverRect.width - 8
        break
      case 'right':
        top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2
        left = triggerRect.right + 8
        break
    }

    // Check if popover would go outside viewport and flip if needed
    if (placement === 'top' && top < 8) {
      // Not enough space above, flip to bottom
      actualPlacement = 'bottom'
      top = triggerRect.bottom + 8
    } else if (placement === 'bottom' && top + popoverRect.height > viewport.height - 8) {
      // Not enough space below, flip to top
      actualPlacement = 'top'
      top = triggerRect.top - popoverRect.height - 8
    } else if (placement === 'left' && left < 8) {
      // Not enough space to the left, flip to right
      actualPlacement = 'right'
      left = triggerRect.right + 8
    } else if (placement === 'right' && left + popoverRect.width > viewport.width - 8) {
      // Not enough space to the right, flip to left
      actualPlacement = 'left'
      left = triggerRect.left - popoverRect.width - 8
    }

    // Recalculate center alignment for flipped placement
    if ((actualPlacement === 'top' || actualPlacement === 'bottom') && actualPlacement !== placement) {
      left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2
    } else if ((actualPlacement === 'left' || actualPlacement === 'right') && actualPlacement !== placement) {
      top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2
    }

    // Final boundary adjustments (keep within viewport)
    if (left < 8) left = 8
    if (left + popoverRect.width > viewport.width - 8) {
      left = viewport.width - popoverRect.width - 8
    }
    if (top < 8) top = 8
    if (top + popoverRect.height > viewport.height - 8) {
      top = viewport.height - popoverRect.height - 8
    }

    setPosition({ top, left })
  }

  const showPopover = () => {
    if (disabled) return
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    setIsVisible(true)
    // Calculate position immediately
    requestAnimationFrame(() => {
      calculatePosition()
    })
  }

  const hidePopover = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        showPopover()
      }, delay)
    }
  }

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      hidePopover()
    }
  }

  const handleClick = () => {
    if (trigger === 'click') {
      if (isVisible) {
        hidePopover()
      } else {
        showPopover()
      }
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      if (isVisible) {
        calculatePosition()
      }
    }

    const handleResize = () => {
      if (isVisible) {
        calculatePosition()
      }
    }

    if (isVisible) {
      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [isVisible])

  useEffect(() => {
    if (disabled && isVisible) {
      hidePopover()
    }
  }, [disabled, isVisible])

  // Reset popover state when children change (e.g., when items are moved)
  useEffect(() => {
    if (isVisible) {
      hidePopover()
    }
  }, [children])

  // Force cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setIsVisible(false)
      setPosition({ top: 0, left: 0 })
    }
  }, [])



  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={className}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={popoverRef}
          className="fixed z-50 pointer-events-none"
          style={{
            top: position.top,
            left: position.left,
            visibility: position.top === 0 && position.left === 0 ? 'hidden' : 'visible'
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-md pointer-events-auto">
            {content}
          </div>
        </div>
      )}
    </>
  )
}