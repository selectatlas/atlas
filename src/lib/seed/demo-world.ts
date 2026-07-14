import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApplicationStatus, Category, JobStatus, JobWorkType, OutreachStatus } from '@/types'
import { mirrorImageToStorage, seededCoverUrl, seededPortfolioImageUrl } from './images'

// ----------------------------------------------------------------
// Demo world: one polished hirer (Northstar Studios) plus jobs,
// applications, shortlists, outreach, message threads, credits,
// portfolio pieces, and engagement stats. All dates are relative to
// the moment the seed runs so the demo never looks stale.
//
// Everything here is scoped to the demo hirer (or to @atlas-demo.com
// talent), and seedDemoWorld() deletes + recreates that scope on every
// run, so the seed is idempotent and always freshly dated.
// ----------------------------------------------------------------

export const DEMO_PASSWORD = 'AtlasDemo2025!'

export const DEMO_HIRER = {
  full_name: 'Northstar Studios',
  email: 'northstar.studios@atlas-demo.com',
  city: 'London',
  country: 'UK',
  bio: 'Independent production company making music videos, branded content, and short film across London. We cast dancers, actors, and creators for fast-turnaround shoots with major label and brand clients.',
}

const now = () => Date.now()
const daysAgoIso = (days: number) => new Date(now() - days * 86_400_000).toISOString()
const hoursAgoIso = (hours: number) => new Date(now() - hours * 3_600_000).toISOString()
const dateInDays = (days: number) => new Date(now() + days * 86_400_000).toISOString().slice(0, 10)
const monthsAgoDate = (months: number) => {
  const d = new Date(now())
  d.setMonth(d.getMonth() - months, 1)
  return d.toISOString().slice(0, 10)
}

// ----------------------------------------------------------------
// Jobs — keyed so applications can reference them before IDs exist
// ----------------------------------------------------------------

interface DemoJob {
  key: string
  title: string
  description: string
  category: Category
  skills_required: string[]
  location: string
  budget: string
  status: JobStatus
  work_type: JobWorkType
  createdDaysAgo: number
  startInDays?: number
  endInDays?: number
  deadlineInDays?: number
  duration?: string
  usage_rights?: string
  travel_required?: boolean
}

export const DEMO_JOBS: DemoJob[] = [
  {
    key: 'bollywood_mv',
    title: 'Bollywood Dance Ensemble — "Dil Se" Music Video',
    description:
      'Casting eight Bollywood dancers for a major-label music video shooting across two days in East London. We need expressive performers with strong Bollywood technique; Kathak or Bhangra vocabulary a big plus. Hindi speakers preferred as the director will run rehearsal notes bilingually. Full choreography provided, one paid rehearsal day.',
    category: 'dancer',
    skills_required: ['Bollywood', 'Kathak', 'Bhangra'],
    location: 'London, UK',
    budget: '£300 per day',
    status: 'open',
    work_type: 'in_person',
    createdDaysAgo: 12,
    startInDays: 21,
    endInDays: 23,
    deadlineInDays: 10,
    duration: '2 shoot days + 1 rehearsal day',
    usage_rights: 'Worldwide, all media, 2 years',
    travel_required: false,
  },
  {
    key: 'boxing_actor',
    title: 'Lead Actor with Boxing Experience — Short Film "Southpaw Nights"',
    description:
      'Seeking a male lead, playing age 28-40, with genuine boxing ability for a gritty short film set in an East London gym. Fight choreography will be built around the actor, so credible ring movement matters more than screen credits. Five shoot days in January, BECTU rates.',
    category: 'actor',
    skills_required: ['Film acting', 'Boxing', 'Stage combat'],
    location: 'London, UK',
    budget: '£500 per day',
    status: 'open',
    work_type: 'in_person',
    createdDaysAgo: 8,
    startInDays: 35,
    endInDays: 40,
    deadlineInDays: 14,
    duration: '5 shoot days',
    usage_rights: 'Festival circuit + online, in perpetuity',
    travel_required: false,
  },
  {
    key: 'fnb_campaign',
    title: 'Food & Beverage Content Creator — Winter Cocktail Campaign',
    description:
      'Premium drinks brand needs a London-based food and beverage creator to produce a six-piece short-form video series around winter serves. Deliverables: 6 vertical videos plus stills, shot across two bar locations. Strong engagement with a 25-40 audience essential; whisky or cocktail content history preferred.',
    category: 'content_creator',
    skills_required: ['Food & beverage content', 'Short-form video', 'Cocktail & drinks content'],
    location: 'London, UK',
    budget: '£600 per day',
    status: 'open',
    work_type: 'hybrid',
    createdDaysAgo: 5,
    startInDays: 14,
    endInDays: 16,
    deadlineInDays: 7,
    duration: '2 shoot days + edit',
    usage_rights: 'Paid social, 12 months',
    travel_required: false,
  },
  {
    key: 'brand_launch_photo',
    title: 'Event Photographer — Flagship Store Launch',
    description:
      'Covered: press night and launch party for a fashion flagship on Regent Street. We needed a photographer comfortable with mixed lighting, celebrity arrivals, and fast same-night edits for press distribution. Position now filled.',
    category: 'photographer_videographer',
    skills_required: ['Event photography', 'Editorial photography'],
    location: 'London, UK',
    budget: '£550 per day',
    status: 'closed',
    work_type: 'in_person',
    createdDaysAgo: 25,
    startInDays: -12,
    endInDays: -12,
    duration: '1 evening',
    usage_rights: 'Press + brand social, in perpetuity',
    travel_required: false,
  },
  {
    key: 'fashion_week',
    title: 'Contemporary Dancers — Fashion Week Presentation',
    description:
      'Booked four contemporary dancers for a moving-installation presentation during London Fashion Week. Choreography by our in-house movement director; fittings and two rehearsal days included. This booking is complete — thanks to everyone who applied.',
    category: 'dancer',
    skills_required: ['Contemporary', 'Physical theatre'],
    location: 'London, UK',
    budget: '£350 per day',
    status: 'closed',
    work_type: 'in_person',
    createdDaysAgo: 28,
    startInDays: -15,
    endInDays: -14,
    duration: '2 rehearsal days + 1 show day',
    usage_rights: 'Show coverage + brand social',
    travel_required: false,
  },
]

// ----------------------------------------------------------------
// Applications — 22 across every pipeline status
// ----------------------------------------------------------------

interface DemoApplication {
  jobKey: string
  talentEmail: string
  status: ApplicationStatus
  daysAgo: number
  note?: string
}

export const DEMO_APPLICATIONS: DemoApplication[] = [
  // Campaign job pipeline (demo step 6)
  { jobKey: 'bollywood_mv', talentEmail: 'priya.singh@atlas-demo.com', status: 'sent', daysAgo: 2, note: 'I have headlined Diwali festivals across the UK and I am fully available for the shoot and rehearsal dates. Fluent Hindi speaker.' },
  { jobKey: 'bollywood_mv', talentEmail: 'ananya.sharma@atlas-demo.com', status: 'shortlisted', daysAgo: 9, note: 'I choreographed for two Bollywood productions shot in the UK and can support the director with bilingual rehearsal notes.' },
  { jobKey: 'bollywood_mv', talentEmail: 'deepika.nair@atlas-demo.com', status: 'viewed', daysAgo: 8 },
  { jobKey: 'bollywood_mv', talentEmail: 'kavya.patel@atlas-demo.com', status: 'responded', daysAgo: 7 },
  { jobKey: 'bollywood_mv', talentEmail: 'riya.mehta@atlas-demo.com', status: 'shortlisted', daysAgo: 6, note: 'Three Bollywood-inspired music video credits released in the UK and India. Happy to share unlisted links.' },
  { jobKey: 'bollywood_mv', talentEmail: 'aisha.khan@atlas-demo.com', status: 'responded', daysAgo: 4 },
  { jobKey: 'bollywood_mv', talentEmail: 'pooja.verma@atlas-demo.com', status: 'viewed', daysAgo: 5 },
  { jobKey: 'bollywood_mv', talentEmail: 'zara.ahmed@atlas-demo.com', status: 'sent', daysAgo: 3 },
  { jobKey: 'bollywood_mv', talentEmail: 'nisha.rao@atlas-demo.com', status: 'sent', daysAgo: 2 },

  // Boxing actor short film
  { jobKey: 'boxing_actor', talentEmail: 'james.morrison@atlas-demo.com', status: 'shortlisted', daysAgo: 6, note: 'AEA stage combat certified, eight years at Fitzroy Lodge ABC. Fight choreography can be built around real ring movement.' },
  { jobKey: 'boxing_actor', talentEmail: 'marcus.cole@atlas-demo.com', status: 'responded', daysAgo: 5, note: 'Former professional boxer, screen trained at Identity School of Acting.' },
  { jobKey: 'boxing_actor', talentEmail: 'tom.bradley@atlas-demo.com', status: 'viewed', daysAgo: 4 },
  { jobKey: 'boxing_actor', talentEmail: 'ryan.fletcher@atlas-demo.com', status: 'sent', daysAgo: 1 },

  // F&B campaign
  { jobKey: 'fnb_campaign', talentEmail: 'sophie.clarke@atlas-demo.com', status: 'viewed', daysAgo: 3, note: '180k across Instagram and TikTok, extensive premium drinks partnership history including cocktail serials.' },
  { jobKey: 'fnb_campaign', talentEmail: 'charlotte.kim@atlas-demo.com', status: 'sent', daysAgo: 2 },
  { jobKey: 'fnb_campaign', talentEmail: 'emma.rodriguez@atlas-demo.com', status: 'sent', daysAgo: 1 },
  { jobKey: 'fnb_campaign', talentEmail: 'jessica.hart@atlas-demo.com', status: 'viewed', daysAgo: 2 },

  // Filled photographer job (closed)
  { jobKey: 'brand_launch_photo', talentEmail: 'lucas.ferreira.events@atlas-demo.com', status: 'hired', daysAgo: 20 },
  { jobKey: 'brand_launch_photo', talentEmail: 'theo.brooks.photo@atlas-demo.com', status: 'responded', daysAgo: 22 },

  // Fashion week job (closed) — gives Priya a hired credit in her history
  { jobKey: 'fashion_week', talentEmail: 'priya.singh@atlas-demo.com', status: 'hired', daysAgo: 24 },
  { jobKey: 'fashion_week', talentEmail: 'maya.johnson@atlas-demo.com', status: 'hired', daysAgo: 23 },
  { jobKey: 'fashion_week', talentEmail: 'sofia.chen@atlas-demo.com', status: 'responded', daysAgo: 25 },
]

// ----------------------------------------------------------------
// Shortlists — Priya is deliberately absent so she can be
// shortlisted live during the demo.
// ----------------------------------------------------------------

export const DEMO_SHORTLISTS: Array<{ talentEmail: string; daysAgo: number }> = [
  { talentEmail: 'ananya.sharma@atlas-demo.com', daysAgo: 9 },
  { talentEmail: 'deepika.nair@atlas-demo.com', daysAgo: 8 },
  { talentEmail: 'riya.mehta@atlas-demo.com', daysAgo: 6 },
  { talentEmail: 'james.morrison@atlas-demo.com', daysAgo: 6 },
  { talentEmail: 'marcus.cole@atlas-demo.com', daysAgo: 5 },
  { talentEmail: 'sophie.clarke@atlas-demo.com', daysAgo: 3 },
]

// ----------------------------------------------------------------
// Outreach — Priya is deliberately absent (sent live in the demo).
// ----------------------------------------------------------------

export const DEMO_OUTREACH: Array<{ talentEmail: string; status: OutreachStatus; daysAgo: number; message: string }> = [
  {
    talentEmail: 'ananya.sharma@atlas-demo.com',
    status: 'responded',
    daysAgo: 9,
    message: 'Hi Ananya, your choreography work on the UK Bollywood productions caught our eye. We are casting an ensemble for a major-label music video shooting in East London and would love to talk about a featured role.',
  },
  {
    talentEmail: 'deepika.nair@atlas-demo.com',
    status: 'viewed',
    daysAgo: 8,
    message: 'Hi Deepika, we loved your Bharatanatyam and Bollywood fusion background. We have a two-day music video shoot next month and think your classical technique would elevate the featured sections.',
  },
  {
    talentEmail: 'james.morrison@atlas-demo.com',
    status: 'responded',
    daysAgo: 6,
    message: 'Hi James, your combination of screen credits and real boxing training is exactly what our short film needs. Would you be open to a chemistry read with our director next week?',
  },
  {
    talentEmail: 'kavya.patel@atlas-demo.com',
    status: 'sent',
    daysAgo: 2,
    message: 'Hi Kavya, your Garba and Bollywood energy is a great fit for the group numbers in our December shoot. Are you still fully available that month?',
  },
  {
    talentEmail: 'sophie.clarke@atlas-demo.com',
    status: 'viewed',
    daysAgo: 3,
    message: 'Hi Sophie, we are producing a winter cocktail campaign for a premium drinks brand and your restaurant and drinks content is exactly the tone the client wants. Could we send over the brief?',
  },
]

// ----------------------------------------------------------------
// Message threads — three believable conversations
// ----------------------------------------------------------------

interface DemoThread {
  talentEmail: string
  messages: Array<{ from: 'hirer' | 'talent'; hoursAgo: number; content: string }>
}

export const DEMO_THREADS: DemoThread[] = [
  {
    talentEmail: 'ananya.sharma@atlas-demo.com',
    messages: [
      { from: 'hirer', hoursAgo: 9 * 24, content: 'Hi Ananya, thanks for responding to our outreach. The shoot is two days in East London with one paid rehearsal day. Does your December availability still hold?' },
      { from: 'talent', hoursAgo: 9 * 24 - 3, content: 'Hi! Yes, December works — I am fully booked in January but free until the 28th. Could you share the choreography style references?' },
      { from: 'hirer', hoursAgo: 8 * 24, content: 'Great. Think classic Bollywood with contemporary staging — the director keeps referencing the "Dil Se" era. Rehearsal would be at Pineapple Studios.' },
      { from: 'talent', hoursAgo: 8 * 24 - 5, content: 'Love that reference. I can also help run bilingual rehearsal notes if useful — I have done that on two UK productions.' },
      { from: 'hirer', hoursAgo: 3 * 24, content: 'That would be genuinely valuable. We are finalising the ensemble this week — can you hold the 18th-20th for now?' },
      { from: 'talent', hoursAgo: 3 * 24 - 2, content: 'Held! Looking forward to it.' },
    ],
  },
  {
    talentEmail: 'james.morrison@atlas-demo.com',
    messages: [
      { from: 'hirer', hoursAgo: 6 * 24, content: 'Hi James, following up on the chemistry read for "Southpaw Nights". Our director can do Tuesday or Thursday afternoon at our Hackney office.' },
      { from: 'talent', hoursAgo: 6 * 24 - 4, content: 'Thursday works well. Should I prepare anything beyond the sides you sent?' },
      { from: 'hirer', hoursAgo: 5 * 24, content: 'Just the sides — but bring gym kit if you can. The director wants to see basic pad work to plan the fight choreography around you.' },
      { from: 'talent', hoursAgo: 2 * 24, content: 'Perfect, I will bring wraps and gloves. See you Thursday.' },
    ],
  },
  {
    talentEmail: 'sophie.clarke@atlas-demo.com',
    messages: [
      { from: 'hirer', hoursAgo: 3 * 24, content: 'Hi Sophie, brief attached for the winter cocktail campaign — six vertical videos plus stills across two bar locations. Rate is £600 per shoot day plus a usage fee.' },
      { from: 'talent', hoursAgo: 2 * 24, content: 'This looks great. My December is filling up fast though — could we lock dates this week? Also, is the usage paid social only or organic too?' },
      { from: 'hirer', hoursAgo: 26, content: 'Paid social for 12 months, organic unlimited. Sending over a proposed schedule now — first shoot day would be in two weeks.' },
    ],
  },
]

// ----------------------------------------------------------------
// Featured talent enrichment: headline, cover, credits, portfolio
// ----------------------------------------------------------------

interface DemoCredit {
  title: string
  production: string
  company: string | null
  startMonthsAgo: number
  endMonthsAgo: number | null
  description: string
  category: Category
}

interface DemoPortfolioItem {
  type: 'video' | 'image' | 'link'
  url: string
  title: string
  description: string
  imageSeed?: string // mirrored into Supabase storage when type is image
}

export interface FeaturedTalent {
  email: string
  headline: string
  coverSeed: string
  credits: DemoCredit[]
  portfolio: DemoPortfolioItem[]
}

export const DEMO_FEATURED_TALENT: FeaturedTalent[] = [
  {
    email: 'priya.singh@atlas-demo.com',
    headline: 'Bollywood & Kathak dancer — 12 years on stage and screen',
    coverSeed: 'atlas-priya-cover',
    credits: [
      {
        title: 'Headline Performer',
        production: 'Diwali on the Square',
        company: 'Mayor of London Events',
        startMonthsAgo: 8,
        endMonthsAgo: 8,
        description: 'Headlined the main stage at Trafalgar Square with a 12-dancer Bollywood ensemble in front of 35,000 people.',
        category: 'dancer',
      },
      {
        title: 'Featured Dancer',
        production: 'Bollywood UK Arena Tour',
        company: 'SAMA Productions',
        startMonthsAgo: 18,
        endMonthsAgo: 14,
        description: 'Featured dancer across a 14-date UK arena tour supporting headline Bollywood playback artists.',
        category: 'dancer',
      },
      {
        title: 'Lead Dancer',
        production: '"Rang" Music Video',
        company: 'Saregama UK',
        startMonthsAgo: 11,
        endMonthsAgo: 11,
        description: 'Lead dancer in an official label music video, choreographed in classical Kathak fused with commercial Bollywood.',
        category: 'dancer',
      },
      {
        title: 'Choreography Assistant',
        production: 'West End Bollywood Workshop Series',
        company: 'Pineapple Dance Studios',
        startMonthsAgo: 24,
        endMonthsAgo: 12,
        description: 'Assisted weekly professional-level Bollywood workshops attended by working West End performers.',
        category: 'dancer',
      },
    ],
    portfolio: [
      { type: 'video', url: 'https://www.youtube.com/watch?v=atlasdemo-priya-reel', title: 'Performance Showreel 2025', description: 'Three minutes of stage and screen highlights, including Trafalgar Square and arena tour footage.' },
      { type: 'video', url: 'https://vimeo.com/atlasdemo/priya-kathak', title: 'Kathak Solo — Studio Session', description: 'Classical Kathak solo shot at Sadler\'s Wells studio.' },
      { type: 'image', url: '', imageSeed: 'atlas-priya-stage', title: 'Diwali on the Square — Main Stage', description: 'Headline performance, Trafalgar Square.' },
      { type: 'image', url: '', imageSeed: 'atlas-priya-editorial', title: 'Editorial Shoot — Asiana Magazine', description: 'Cover feature on British-Asian dance artists.' },
    ],
  },
  {
    email: 'ananya.sharma@atlas-demo.com',
    headline: 'Bollywood fusion choreographer — film & commercial',
    coverSeed: 'atlas-ananya-cover',
    credits: [
      {
        title: 'Choreographer',
        production: 'Feature Film (UK Bollywood Production)',
        company: 'Dharma UK',
        startMonthsAgo: 10,
        endMonthsAgo: 9,
        description: 'Choreographed two ensemble numbers for a Bollywood feature shot at Pinewood and on location in London.',
        category: 'dancer',
      },
      {
        title: 'Dance Captain',
        production: 'Premier League Half-Time Show',
        company: 'Sky Sports Events',
        startMonthsAgo: 6,
        endMonthsAgo: 6,
        description: 'Dance captain for a televised Bollywood-themed half-time performance.',
        category: 'dancer',
      },
      {
        title: 'Featured Dancer',
        production: '"Shaam" Music Video',
        company: 'T-Series UK',
        startMonthsAgo: 15,
        endMonthsAgo: 15,
        description: 'Featured role in an official music video with 40M+ views.',
        category: 'dancer',
      },
    ],
    portfolio: [
      { type: 'video', url: 'https://www.youtube.com/watch?v=atlasdemo-ananya-choreo', title: 'Choreography Reel', description: 'Ensemble numbers choreographed for film and television.' },
      { type: 'image', url: '', imageSeed: 'atlas-ananya-rehearsal', title: 'Rehearsal — Pinewood Studios', description: 'Directing a 16-dancer ensemble on set.' },
    ],
  },
  {
    email: 'deepika.nair@atlas-demo.com',
    headline: 'Bharatanatyam & Bollywood fusion artist',
    coverSeed: 'atlas-deepika-cover',
    credits: [
      {
        title: 'Solo Artist',
        production: 'British Council Cultural Exchange',
        company: 'British Council',
        startMonthsAgo: 7,
        endMonthsAgo: 7,
        description: 'Represented the UK at a cultural exchange showcase in Chennai and Mumbai.',
        category: 'dancer',
      },
      {
        title: 'Featured Dancer',
        production: 'Alchemy Festival',
        company: 'Southbank Centre',
        startMonthsAgo: 13,
        endMonthsAgo: 13,
        description: 'Featured classical-fusion performance at the Southbank Centre\'s South Asian arts festival.',
        category: 'dancer',
      },
    ],
    portfolio: [
      { type: 'video', url: 'https://vimeo.com/atlasdemo/deepika-fusion', title: 'Fusion Showreel', description: 'Bharatanatyam and Bollywood fusion highlights.' },
      { type: 'image', url: '', imageSeed: 'atlas-deepika-southbank', title: 'Alchemy Festival — Southbank Centre', description: 'Live performance still.' },
    ],
  },
  {
    email: 'james.morrison@atlas-demo.com',
    headline: 'Screen actor & certified stage combat instructor',
    coverSeed: 'atlas-james-cover',
    credits: [
      {
        title: 'Supporting Role — "Callum"',
        production: 'BBC Drama Series',
        company: 'BBC Studios',
        startMonthsAgo: 9,
        endMonthsAgo: 7,
        description: 'Recurring supporting role across four episodes, including two extended fight sequences performed without a double.',
        category: 'actor',
      },
      {
        title: 'Lead — "The Corner Man"',
        production: 'Short Film (BIFA long-listed)',
        company: 'Rogue Park Films',
        startMonthsAgo: 16,
        endMonthsAgo: 16,
        description: 'Lead role as an ageing boxing trainer; long-listed for a British Independent Film Award.',
        category: 'actor',
      },
      {
        title: 'Fight Performer',
        production: 'ITV Crime Drama',
        company: 'ITV Studios',
        startMonthsAgo: 22,
        endMonthsAgo: 21,
        description: 'Choreographed and performed a warehouse fight sequence opposite the series lead.',
        category: 'actor',
      },
    ],
    portfolio: [
      { type: 'video', url: 'https://vimeo.com/atlasdemo/james-showreel', title: 'Acting Showreel 2025', description: 'Drama and action highlights from BBC and ITV productions.' },
      { type: 'video', url: 'https://www.youtube.com/watch?v=atlasdemo-james-fight', title: 'Fight Choreography Reel', description: 'Stage combat and boxing sequences, all performed without a double.' },
    ],
  },
  {
    email: 'marcus.cole@atlas-demo.com',
    headline: 'Actor & former professional boxer',
    coverSeed: 'atlas-marcus-cover',
    credits: [
      {
        title: 'Guest Lead — "Danny Okafor"',
        production: 'Netflix UK Original',
        company: 'Netflix',
        startMonthsAgo: 5,
        endMonthsAgo: 4,
        description: 'Guest lead in a boxing-centred episode; all ring sequences performed for real.',
        category: 'actor',
      },
      {
        title: 'Supporting Role',
        production: '"Twelve Rounds" (Feature)',
        company: 'Number 9 Films',
        startMonthsAgo: 14,
        endMonthsAgo: 12,
        description: 'Supporting role as a rival fighter in an independent boxing feature.',
        category: 'actor',
      },
    ],
    portfolio: [
      { type: 'video', url: 'https://www.youtube.com/watch?v=atlasdemo-marcus-reel', title: 'Showreel', description: 'Screen acting highlights including Netflix guest lead.' },
    ],
  },
  {
    email: 'sophie.clarke@atlas-demo.com',
    headline: 'Food & drink creator — 180k across Instagram & TikTok',
    coverSeed: 'atlas-sophie-cover',
    credits: [
      {
        title: 'Campaign Creator',
        production: 'World Whisky Day Series',
        company: 'Diageo',
        startMonthsAgo: 4,
        endMonthsAgo: 4,
        description: 'Six-part cocktail serial for a premium whisky brand; 2.1M combined views.',
        category: 'content_creator',
      },
      {
        title: 'Resident Creator',
        production: 'Borough Market Stories',
        company: 'Borough Market',
        startMonthsAgo: 12,
        endMonthsAgo: 6,
        description: 'Monthly trader-spotlight series across six months.',
        category: 'content_creator',
      },
      {
        title: 'Launch Creator',
        production: 'Rooftop Bar Opening',
        company: 'D&D London',
        startMonthsAgo: 8,
        endMonthsAgo: 8,
        description: 'Launch content for a Shoreditch rooftop opening; top-performing organic post of the venue\'s year.',
        category: 'content_creator',
      },
    ],
    portfolio: [
      { type: 'video', url: 'https://www.tiktok.com/@atlasdemo.sophie/video/demo-cocktails', title: 'Winter Serves Series — Episode 1', description: '480k views. Premium whisky cocktail build.' },
      { type: 'image', url: '', imageSeed: 'atlas-sophie-food', title: 'Restaurant Discovery — Stills Set', description: 'Selected stills from restaurant partnership shoots.' },
      { type: 'link', url: 'https://www.instagram.com/atlasdemo.sophie', title: 'Instagram — @sophieeats.ldn', description: '112k followers, 8.4% engagement.' },
    ],
  },
]

// ----------------------------------------------------------------
// Engagement — profile views and likes over the last 30 days
// ----------------------------------------------------------------

export const DEMO_ENGAGEMENT: Array<{ email: string; views: number; likes: number }> = [
  { email: 'priya.singh@atlas-demo.com', views: 48, likes: 12 },
  { email: 'ananya.sharma@atlas-demo.com', views: 36, likes: 9 },
  { email: 'deepika.nair@atlas-demo.com', views: 27, likes: 7 },
  { email: 'riya.mehta@atlas-demo.com', views: 22, likes: 6 },
  { email: 'kavya.patel@atlas-demo.com', views: 19, likes: 5 },
  { email: 'aisha.khan@atlas-demo.com', views: 17, likes: 4 },
  { email: 'james.morrison@atlas-demo.com', views: 31, likes: 8 },
  { email: 'marcus.cole@atlas-demo.com', views: 24, likes: 6 },
  { email: 'sophie.clarke@atlas-demo.com', views: 40, likes: 11 },
  { email: 'charlotte.kim@atlas-demo.com', views: 21, likes: 5 },
]

// ----------------------------------------------------------------
// Seeder
// ----------------------------------------------------------------

type ProfileIdByEmail = Map<string, string>

function requireId(ids: ProfileIdByEmail, email: string): string {
  const id = ids.get(email)
  if (!id) throw new Error(`Demo world references unknown profile: ${email}`)
  return id
}

async function clearDemoWorld(supabase: SupabaseClient, hirerId: string, talentIds: string[]) {
  // Jobs cascade applications + job_embeddings; threads cascade
  // participants + messages. Order matters only for the thread lookup.
  const { data: participantRows } = await supabase
    .from('thread_participants')
    .select('thread_id')
    .eq('profile_id', hirerId)
  const threadIds = (participantRows ?? []).map(row => row.thread_id)
  if (threadIds.length > 0) {
    await supabase.from('message_threads').delete().in('id', threadIds)
  }

  await supabase.from('jobs').delete().eq('hirer_id', hirerId)
  await supabase.from('outreach').delete().eq('hirer_id', hirerId)
  await supabase.from('shortlists').delete().eq('hirer_id', hirerId)

  if (talentIds.length > 0) {
    await supabase.from('credits').delete().in('profile_id', talentIds)
    await supabase.from('portfolio_items').delete().in('profile_id', talentIds)
    await supabase.from('profile_views').delete().in('talent_id', talentIds)
    await supabase.from('profile_likes').delete().in('talent_id', talentIds)
  }
}

export async function seedDemoWorld(supabase: SupabaseClient, ids: ProfileIdByEmail): Promise<void> {
  const hirerId = requireId(ids, DEMO_HIRER.email)
  const enrichedTalentIds = [
    ...new Set([
      ...DEMO_FEATURED_TALENT.map(t => requireId(ids, t.email)),
      ...DEMO_ENGAGEMENT.map(t => requireId(ids, t.email)),
    ]),
  ]

  console.log('\nSeeding demo world (Northstar Studios)...')
  await clearDemoWorld(supabase, hirerId, enrichedTalentIds)

  // Jobs
  const jobIdByKey = new Map<string, string>()
  for (const job of DEMO_JOBS) {
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        hirer_id: hirerId,
        title: job.title,
        description: job.description,
        category: job.category,
        skills_required: job.skills_required,
        location: job.location,
        budget: job.budget,
        status: job.status,
        work_type: job.work_type,
        start_date: job.startInDays != null ? dateInDays(job.startInDays) : null,
        end_date: job.endInDays != null ? dateInDays(job.endInDays) : null,
        application_deadline: job.deadlineInDays != null ? dateInDays(job.deadlineInDays) : null,
        duration: job.duration ?? null,
        usage_rights: job.usage_rights ?? null,
        travel_required: job.travel_required ?? false,
        created_at: daysAgoIso(job.createdDaysAgo),
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`Failed to insert job "${job.title}": ${error?.message}`)
    jobIdByKey.set(job.key, data.id)
  }
  console.log(`  Jobs: ${DEMO_JOBS.length}`)

  // Applications
  const applicationRows = DEMO_APPLICATIONS.map(app => ({
    job_id: jobIdByKey.get(app.jobKey)!,
    talent_id: requireId(ids, app.talentEmail),
    status: app.status,
    note: app.note ?? null,
    created_at: daysAgoIso(app.daysAgo),
  }))
  const { error: applicationsError } = await supabase.from('applications').insert(applicationRows)
  if (applicationsError) throw new Error(`Failed to insert applications: ${applicationsError.message}`)
  console.log(`  Applications: ${applicationRows.length}`)

  // Shortlists
  const { error: shortlistsError } = await supabase.from('shortlists').insert(
    DEMO_SHORTLISTS.map(entry => ({
      hirer_id: hirerId,
      talent_id: requireId(ids, entry.talentEmail),
      created_at: daysAgoIso(entry.daysAgo),
    }))
  )
  if (shortlistsError) throw new Error(`Failed to insert shortlists: ${shortlistsError.message}`)
  console.log(`  Shortlists: ${DEMO_SHORTLISTS.length}`)

  // Outreach
  const { error: outreachError } = await supabase.from('outreach').insert(
    DEMO_OUTREACH.map(entry => ({
      hirer_id: hirerId,
      talent_id: requireId(ids, entry.talentEmail),
      message: entry.message,
      status: entry.status,
      created_at: daysAgoIso(entry.daysAgo),
    }))
  )
  if (outreachError) throw new Error(`Failed to insert outreach: ${outreachError.message}`)
  console.log(`  Outreach: ${DEMO_OUTREACH.length}`)

  // Message threads
  for (const thread of DEMO_THREADS) {
    const talentId = requireId(ids, thread.talentEmail)
    const firstMessage = thread.messages[0]
    const lastMessage = thread.messages[thread.messages.length - 1]

    const { data: threadRow, error: threadError } = await supabase
      .from('message_threads')
      .insert({ created_at: hoursAgoIso(firstMessage.hoursAgo) })
      .select('id')
      .single()
    if (threadError || !threadRow) throw new Error(`Failed to insert thread: ${threadError?.message}`)

    // The hirer has read everything up to (but not including) a final
    // talent message, so recent replies feel "new" during the demo.
    const hirerLastRead = lastMessage.from === 'talent' ? lastMessage.hoursAgo + 1 : lastMessage.hoursAgo - 1
    const { error: participantsError } = await supabase.from('thread_participants').insert([
      { thread_id: threadRow.id, profile_id: hirerId, last_read_at: hoursAgoIso(hirerLastRead) },
      { thread_id: threadRow.id, profile_id: talentId, last_read_at: hoursAgoIso(lastMessage.hoursAgo - 1) },
    ])
    if (participantsError) throw new Error(`Failed to insert thread participants: ${participantsError.message}`)

    const { error: messagesError } = await supabase.from('messages').insert(
      thread.messages.map(message => ({
        thread_id: threadRow.id,
        sender_id: message.from === 'hirer' ? hirerId : talentId,
        content: message.content,
        created_at: hoursAgoIso(message.hoursAgo),
      }))
    )
    if (messagesError) throw new Error(`Failed to insert messages: ${messagesError.message}`)
  }
  console.log(`  Message threads: ${DEMO_THREADS.length}`)

  // Credits, portfolio, headline, and cover imagery for featured talent
  let creditCount = 0
  let portfolioCount = 0
  for (const talent of DEMO_FEATURED_TALENT) {
    const profileId = requireId(ids, talent.email)

    const coverUrl = await mirrorImageToStorage(supabase, {
      bucket: 'covers',
      path: `${profileId}/cover.jpg`,
      sourceUrl: seededCoverUrl(talent.coverSeed),
    })
    const { error: headlineError } = await supabase
      .from('profiles')
      .update({ headline: talent.headline, cover_url: coverUrl ?? seededCoverUrl(talent.coverSeed) })
      .eq('id', profileId)
    if (headlineError) throw new Error(`Failed to update headline for ${talent.email}: ${headlineError.message}`)

    const { error: creditsError } = await supabase.from('credits').insert(
      talent.credits.map((credit, index) => ({
        profile_id: profileId,
        title: credit.title,
        production: credit.production,
        company: credit.company,
        start_date: monthsAgoDate(credit.startMonthsAgo),
        end_date: credit.endMonthsAgo != null ? monthsAgoDate(credit.endMonthsAgo) : null,
        description: credit.description,
        category: credit.category,
        sort_order: index,
      }))
    )
    if (creditsError) throw new Error(`Failed to insert credits for ${talent.email}: ${creditsError.message}`)
    creditCount += talent.credits.length

    const portfolioRows = []
    for (const [index, item] of talent.portfolio.entries()) {
      let url = item.url
      let thumbnailUrl: string | null = null
      if (item.type === 'image' && item.imageSeed) {
        const sourceUrl = seededPortfolioImageUrl(item.imageSeed)
        const mirrored = await mirrorImageToStorage(supabase, {
          bucket: 'covers',
          path: `${profileId}/portfolio-${item.imageSeed}.jpg`,
          sourceUrl,
        })
        url = mirrored ?? sourceUrl
        thumbnailUrl = url
      }
      portfolioRows.push({
        profile_id: profileId,
        type: item.type,
        url,
        title: item.title,
        description: item.description,
        thumbnail_url: thumbnailUrl,
        sort_order: index,
      })
    }
    const { error: portfolioError } = await supabase.from('portfolio_items').insert(portfolioRows)
    if (portfolioError) throw new Error(`Failed to insert portfolio for ${talent.email}: ${portfolioError.message}`)
    portfolioCount += talent.portfolio.length
  }
  console.log(`  Credits: ${creditCount}, portfolio items: ${portfolioCount}`)

  // Engagement: views and likes spread across the last 30 days.
  // Likers are drawn from other demo profiles so unique(user_id, talent_id) holds.
  const allProfileIds = [...ids.values()]
  let viewCount = 0
  let likeCount = 0
  for (const entry of DEMO_ENGAGEMENT) {
    const talentId = requireId(ids, entry.email)

    const viewRows = Array.from({ length: entry.views }, (_, i) => ({
      viewer_id: i % 3 === 0 ? hirerId : null,
      talent_id: talentId,
      created_at: hoursAgoIso(((i * 29 * 24) / entry.views) + ((i * 7) % 24)),
    }))
    const { error: viewsError } = await supabase.from('profile_views').insert(viewRows)
    if (viewsError) throw new Error(`Failed to insert views for ${entry.email}: ${viewsError.message}`)
    viewCount += viewRows.length

    const likers = allProfileIds.filter(id => id !== talentId).slice(0, entry.likes)
    const likeRows = likers.map((likerId, i) => ({
      user_id: likerId,
      talent_id: talentId,
      created_at: daysAgoIso((i * 28) / Math.max(entry.likes, 1) + 1),
    }))
    const { error: likesError } = await supabase.from('profile_likes').insert(likeRows)
    if (likesError) throw new Error(`Failed to insert likes for ${entry.email}: ${likesError.message}`)
    likeCount += likeRows.length
  }
  console.log(`  Profile views: ${viewCount}, likes: ${likeCount}`)
}
