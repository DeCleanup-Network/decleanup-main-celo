'use client'

import { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type AlertModalVariant = 'success' | 'error' | 'warning' | 'info'

interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message: string
  variant?: AlertModalVariant
}

const variantStyles: Record<AlertModalVariant, { icon: typeof CheckCircle; borderClass: string; iconBgClass: string; iconColorClass: string }> = {
  success: {
    icon: CheckCircle,
    borderClass: 'border-brand-green',
    iconBgClass: 'bg-brand-green/20',
    iconColorClass: 'text-brand-green',
  },
  error: {
    icon: AlertCircle,
    borderClass: 'border-red-500',
    iconBgClass: 'bg-red-500/20',
    iconColorClass: 'text-red-400',
  },
  warning: {
    icon: AlertCircle,
    borderClass: 'border-yellow-500',
    iconBgClass: 'bg-yellow-500/20',
    iconColorClass: 'text-yellow-400',
  },
  info: {
    icon: Info,
    borderClass: 'border-brand-green',
    iconBgClass: 'bg-brand-green/20',
    iconColorClass: 'text-brand-green',
  },
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info',
}: AlertModalProps) {
  const style = variantStyles[variant]
  const Icon = style.icon

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`relative mx-4 w-full max-w-md rounded-lg border-2 ${style.borderClass} bg-gray-900 p-6 shadow-2xl`}>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mb-4 flex justify-center">
          <div className={`rounded-full ${style.iconBgClass} p-3`}>
            <Icon className={`h-12 w-12 ${style.iconColorClass}`} />
          </div>
        </div>
        {title && (
          <h2 className="mb-3 text-center text-xl font-bold uppercase tracking-wide text-white">
            {title}
          </h2>
        )}
        <p className="mb-6 whitespace-pre-wrap text-center text-sm text-gray-300 leading-relaxed">
          {message}
        </p>
        <Button
          onClick={onClose}
          className="w-full border-2 border-gray-700 bg-gray-800 text-white hover:bg-gray-700"
        >
          OK
        </Button>
      </div>
    </div>
  )
}
