import Image from 'next/image'

type BrandLogoVariant = 'horizontal' | 'vertical' | 'icon'

interface BrandLogoProps {
  variant?: BrandLogoVariant
  width?: number
  className?: string
  alt?: string
  priority?: boolean
}

const logos = {
  horizontal: {
    src: '/brand/dvclc-horizontal.webp',
    width: 768,
    height: 165,
  },
  vertical: {
    src: '/brand/dvclc-vertical.webp',
    width: 320,
    height: 411,
  },
  icon: {
    src: '/brand/dvclc-mark-192.webp',
    width: 192,
    height: 192,
  },
} as const

export default function BrandLogo({
  variant = 'horizontal',
  width,
  className,
  alt,
  priority,
}: BrandLogoProps) {
  const logo = logos[variant]
  const renderWidth = width ?? (variant === 'horizontal' ? 164 : variant === 'vertical' ? 88 : 48)
  const renderHeight = Math.round((renderWidth * logo.height) / logo.width)

  return (
    <Image
      src={logo.src}
      alt={alt ?? 'DVCLC'}
      width={renderWidth}
      height={renderHeight}
      sizes="(max-width: 768px) 140px, 170px"
      className={className}
      priority={priority}
      quality={82}
    />
  )
}
