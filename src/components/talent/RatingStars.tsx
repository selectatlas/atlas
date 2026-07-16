import { Star } from 'lucide-react'

interface RatingStarsProps {
  rating: number
  className?: string
}

/** Five-star row, filled to the nearest whole star. */
export function RatingStars({ rating, className = '' }: RatingStarsProps) {
  const filled = Math.round(rating)
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map(value => (
        <Star
          key={value}
          className={`size-3.5 ${value <= filled ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  )
}
