// Shared landing-page content. The FAQ is rendered in LandingPage and also
// emitted as FAQPage JSON-LD from the server route (src/app/page.tsx), so it
// lives here to keep the two in sync.

export interface LandingFaqItem {
  question: string
  answer: string
}

export const landingFaq: LandingFaqItem[] = [
  {
    question: 'How does Atlas find matches?',
    answer:
      'You describe who you need in plain language. Atlas reads the brief, picks out the details that matter - skills, languages, location, availability - and ranks talent against them with real similarity scores. Strong matches come with the reasons they surfaced, so you can see why each person made the list.',
  },
  {
    question: 'What kind of talent is on Atlas?',
    answer:
      'Atlas is built for the creative industry: dancers, actors, content creators, and photographers and videographers. Profiles carry the specifics hirers actually search for, like trained skills, languages, city, and availability.',
  },
  {
    question: 'Do I have to use filters?',
    answer:
      'No. Start with a sentence, the way you would describe the brief to a colleague, and Atlas turns it into a structured search for you. Familiar filters are still there when you want to narrow a longlist by hand.',
  },
  {
    question: 'How do talent get discovered?',
    answer:
      'Talent create a profile once - skills, credits, availability, and rates - and Atlas surfaces it whenever a brief genuinely fits. There is no bidding on jobs and no keyword games; the profile does the work.',
  },
  {
    question: 'Is my activity private?',
    answer:
      'Yes. Your searches, shortlists, and messages are visible only to you and the people you contact. Access rules are enforced in the database itself, not just in the app.',
  },
]

export interface ShowcaseTalent {
  name: string
  category: string
  role: string
  city: string
  availability: string
  skills: string[]
  image: string
}

// A hand-picked slice of the seeded demo roster (src/lib/seed/data.ts).
// Names, cities, skills, and availability mirror the seed profiles so the
// landing page agrees with what a demo search actually returns.
export const showcaseTalent: ShowcaseTalent[] = [
  {
    name: 'Priya Singh',
    category: 'Dancer',
    role: 'Bollywood & Kathak dancer',
    city: 'London',
    availability: 'Available Dec & Jan',
    skills: ['Bollywood', 'Kathak', 'Hindi speaker'],
    image: '/hero/01.jpg',
  },
  {
    name: 'Sofia Chen',
    category: 'Dancer',
    role: 'Ballet & contemporary dancer',
    city: 'London',
    availability: 'From January',
    skills: ['Ballet', 'Contemporary', 'Jazz'],
    image: '/hero/03.jpg',
  },
  {
    name: 'James Morrison',
    category: 'Actor',
    role: 'Screen actor · stage combat',
    city: 'London',
    availability: 'Available now',
    skills: ['Film acting', 'Stage combat', 'Boxing'],
    image: '/hero/07.jpg',
  },
  {
    name: 'Daniel Park',
    category: 'Actor',
    role: 'Screen actor · martial arts',
    city: 'London',
    availability: 'From January',
    skills: ['Film acting', 'Martial arts', 'Motion capture'],
    image: '/hero/09.jpg',
  },
  {
    name: 'Sophie Clarke',
    category: 'Creator',
    role: 'Food content creator',
    city: 'London',
    availability: 'Available December',
    skills: ['Food content', 'Short-form video', 'Brand partnerships'],
    image: '/hero/10.jpg',
  },
  {
    name: 'Nadia Brown',
    category: 'Creator',
    role: 'Lifestyle content creator',
    city: 'London',
    availability: 'Available December',
    skills: ['Lifestyle content', 'Educational content', 'Short-form video'],
    image: '/hero/08.jpg',
  },
  {
    name: 'Theo Brooks',
    category: 'Photo & video',
    role: 'Fashion & editorial photographer',
    city: 'London',
    availability: 'Available now',
    skills: ['Fashion photography', 'Editorial', 'Portraits'],
    image: '/hero/05.jpg',
  },
  {
    name: 'Mara Okafor',
    category: 'Photo & video',
    role: 'Cinematographer',
    city: 'Manchester',
    availability: 'From next month',
    skills: ['Cinematography', 'Commercial video', 'Music videos'],
    image: '/hero/11.jpg',
  },
]
