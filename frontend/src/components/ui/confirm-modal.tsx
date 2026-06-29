'use client'

import { useEffect } from 'react'
import { X, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isDanger = variant === 'danger'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative mx-4 w-full max-w-lg rounded-lg border-2 border-brand-green bg-gray-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-brand-green/20 p-3">
            <HelpCircle className="h-12 w-12 text-brand-green" />
          </div>
        </div>
        {title && (
          <h2 className="mb-3 text-center text-xl font-bold uppercase tracking-wide text-white">
            {title}
          </h2>
        )}
        <p className="mb-6 min-w-0 whitespace-pre-wrap break-words text-left text-sm text-gray-300 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          <Button onClick={onClose} variant="brandGhost" className="flex-1">
            {cancelLabel}
          </Button>
          <Button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            variant={isDanger ? 'destructive' : 'default'}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
