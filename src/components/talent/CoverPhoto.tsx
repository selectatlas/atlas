import Image from 'next/image'

interface CoverPhotoProps {
  coverUrl: string | null
  children: React.ReactNode
}

export function CoverPhoto({ coverUrl, children }: CoverPhotoProps) {
  return (
    <div className="relative w-full">
      {/* Cover image */}
      <div className="relative w-full aspect-[3/1] bg-muted rounded-b-2xl overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt="Cover"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 672px"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted to-secondary/30" />
        )}
        {/* Bottom gradient fade for readability */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Overlapping content (profile photo, name, etc.) */}
      <div className="relative -mt-16 sm:-mt-24 px-4">
        {children}
      </div>
    </div>
  )
}
