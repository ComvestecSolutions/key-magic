import { useId } from 'react'
import { cn } from '@/lib/utils'

interface AppIconProps {
  size?: number
  className?: string
  animated?: boolean
}

export function AppIcon({ size = 40, className = '', animated = false }: AppIconProps) {
  const uniqueId = useId();
  const glowId = `iconGlow-${uniqueId}`;
  const glassBorderId = `iconGlassBorder-${uniqueId}`;
  const kGradId = `iconKGrad-${uniqueId}`;
  const boltGlowId = `iconBoltGlow-${uniqueId}`;
  return (
    <div className={cn('app-icon-wrapper', { 'app-icon--animated': animated }, className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={glowId} cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#06080d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={glassBorderId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id={kGradId} x1="14" y1="14" x2="36" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <filter id={boltGlowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="16" fill="#06080d" />
        <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${glowId})`} />
        <rect x="3" y="3" width="58" height="58" rx="15" fill="#0c0e14" fillOpacity="0.7" />
        <rect x="3" y="3" width="58" height="28" rx="15" fill="#ffffff" fillOpacity="0.04" />
        <rect x="3" y="3" width="58" height="58" rx="15" fill="none" stroke={`url(#${glassBorderId})`} strokeWidth="1" />
        <path d="M17 16V48" stroke={`url(#${kGradId})`} strokeWidth="4.5" strokeLinecap="round" />
        <path d="M17 32L33 17" stroke={`url(#${kGradId})`} strokeWidth="4.5" strokeLinecap="round" />
        <path d="M17 32L33 47" stroke={`url(#${kGradId})`} strokeWidth="4.5" strokeLinecap="round" />
        <path d="M43 11L37 26H44L38 41" stroke="#06b6d4" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${boltGlowId})`} />
        <circle cx="51" cy="51" r="6" fill="#06080d" />
        <circle cx="51" cy="51" r="4.5" fill="#10b981" />
        <circle cx="51" cy="51" r="4.5" fill="none" stroke="#10b981" strokeOpacity="0.3" strokeWidth="2" />
      </svg>
    </div>
  )
}
