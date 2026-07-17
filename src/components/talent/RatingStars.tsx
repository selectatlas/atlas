import { Star } from 'lucide-react'

interface RatingStarsProps {
  rating: number
  className?: string
  /** When provided, renders tappable stars instead of a read-only row. */
  onRatingChange?: (rating: number) => void
}

/** Five-star row, filled to the nearest whole star. Interactive when onRatingChange is set. */
export function RatingStars({ rating, className = '', onRatingChange }: RatingStarsProps) {
  const filled = Math.round(rating)

  if (onRatingChange) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 ${className}`}
        role="radiogroup"
        aria-label="Select a rating"
      >
        {[1, 2, 3, 4, 5].map(value => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={value === filled}
            aria-label={`${value} star${value > 1 ? 's' : ''}`}
            onClick={() => onRatingChange(value)}
            className="rounded-md p-1 transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              className={`size-6 ${value <= filled ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </span>
    )
  }

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
