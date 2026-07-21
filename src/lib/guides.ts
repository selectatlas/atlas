/**
 * Static knowledge-centre content ("guides"). Purely presentational data -
 * rendered by /guides and /guides/[slug]. Keep copy in sync with real
 * platform constraints (e.g. upload limits in image-verification.ts).
 */

export type GuideDoDontItem = {
  kind: 'do' | 'dont'
  text: string
}

export type GuideSection = {
  heading?: string
  paragraphs?: string[]
  bullets?: string[]
  doDont?: GuideDoDontItem[]
}

export type Guide = {
  slug: string
  title: string
  description: string
  sections: GuideSection[]
}

export const GUIDES: Guide[] = [
  {
    slug: 'photo-guidance',
    title: 'Photo guidance',
    description: 'The rules your photos must follow so casting takes you seriously - and review never flags them.',
    sections: [
      {
        paragraphs: [
          "Uploading the right photos can be the difference between getting work and not getting work. Photos that don't follow these rules may be flagged during review.",
        ],
      },
      {
        heading: 'The rules',
        doDont: [
          { kind: 'do', text: 'All photos taken within the last 6 months and reflect how you look now (new hair, weight change = new photos)' },
          { kind: 'do', text: 'Colour only - black and white photos are not accepted by production' },
          { kind: 'do', text: 'All photos different and distinct' },
          { kind: 'do', text: 'Face forwards, clear and not blurry, well lit' },
          { kind: 'do', text: 'You must be the only person in each photo' },
          { kind: 'do', text: 'Front and centre of frame - not too far away, not too close' },
          { kind: 'do', text: 'Neutral background, natural lighting where possible' },
          { kind: 'dont', text: 'No mirror selfies - get somebody else to take the photo' },
          { kind: 'dont', text: 'No borders or branding, no filters (Snapchat/Instagram)' },
          { kind: 'dont', text: 'No bulky clothes or on-set costumes; no passport photos or photos of photos' },
          { kind: 'dont', text: 'No hats, no sunglasses, no smoking, no weapons' },
        ],
      },
      {
        heading: 'File requirements',
        bullets: [
          'JPEG, PNG or WebP format',
          'Maximum file size 5MB',
          'Portrait orientation preferred for profile photos',
        ],
      },
    ],
  },
  {
    slug: 'main-photos',
    title: 'Your four main photos',
    description: 'What each of the four labelled photo slots is for, and how to get each one right.',
    sections: [
      {
        paragraphs: [
          'Your profile has four labelled photo slots. Casting teams rely on each one for a different reason, so fill all four.',
        ],
      },
      {
        heading: 'Headshot',
        paragraphs: [
          'Head and shoulders, face on to camera. Nobody else in frame.',
        ],
      },
      {
        heading: 'Full length',
        paragraphs: [
          "Head to knees or full body, facing the camera. Smart presentation - don't look scruffy.",
        ],
      },
      {
        heading: 'Side profile',
        paragraphs: [
          'A clear side-on view of your face and head.',
        ],
      },
      {
        heading: 'Rear',
        paragraphs: [
          'A view from behind. Used by casting for continuity and doubling.',
        ],
      },
      {
        heading: 'Keep your photos current',
        paragraphs: [
          'If your hairstyle or hair colour changes, or you lose or gain weight, update your photos.',
        ],
      },
    ],
  },
  {
    slug: 'profile-tips',
    title: 'Get found more often',
    description: 'Small profile habits that make Atlas surface you in more searches.',
    sections: [
      {
        paragraphs: [
          'Atlas matches on what your profile says. The more you fill out, the more you get found.',
        ],
      },
      {
        heading: 'Quick wins',
        bullets: [
          'Fill out every profile category - the more you fill out, the more you get found',
          'Add skills with honest proficiency levels',
          'Set your availability so hirers know when you can work',
          'Keep your rates current',
          'Add portfolio work and organise it into named collections',
          'Keep your showreel link working',
        ],
      },
    ],
  },
]

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find(guide => guide.slug === slug)
}
