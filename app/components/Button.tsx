import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  fullWidth?: boolean;
}

export default function Button({ 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  children, 
  fullWidth = false,
  ...props 
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 focus:ring-green-500',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 focus:ring-blue-500'
  };
  
  // Mobile-optimized sizing with larger touch targets
  const sizeClasses = {
    sm: 'px-3 py-2 sm:py-1.5 text-sm min-h-[44px] sm:min-h-[36px]',
    md: 'px-4 py-3 sm:py-2 text-base sm:text-sm min-h-[48px] sm:min-h-[40px]',
    lg: 'px-6 py-4 sm:py-3 text-lg sm:text-base min-h-[52px] sm:min-h-[44px]'
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  
  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`;
  
  return (
    <button className={combinedClasses} {...props}>
      {children}
    </button>
  );
}