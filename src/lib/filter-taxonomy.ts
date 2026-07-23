import type { Category } from '@/types'

export type FilterKind = 'single' | 'multi' | 'boolean' | 'range' | 'text'
export type FilterStorage = 'profile' | 'talent_profile' | 'public_attributes' | 'sensitive_preferences' | 'skills'
export type FilterOperator = 'equals' | 'contains' | 'overlaps' | 'range'

export interface FilterOption {
  value: string
  label: string
}

export interface TalentFilterDefinition {
  key: string
  label: string
  section: string
  categories: readonly Category[] | 'all'
  kind: FilterKind
  storage: FilterStorage
  operator: FilterOperator
  options?: readonly FilterOption[]
  allowCustom?: boolean
  topOptions?: number
  pill?: boolean
  unit?: 'cm' | 'gbp' | 'years' | 'days'
  min?: number
  max?: number
  restricted?: boolean
  dependsOn?: { key: string; value: string | boolean }
}

const options = (values: readonly string[]): FilterOption[] => values.map(value => ({
  value: value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
  label: value,
}))

export const SEARCH_CATEGORIES: readonly Category[] = [
  'actor',
  'dancer',
  'photographer_videographer',
  'content_creator',
]

const ACTOR: readonly Category[] = ['actor']
const DANCER: readonly Category[] = ['dancer']
const PHOTO_VIDEO: readonly Category[] = ['photographer_videographer']
const PHYSICAL: readonly Category[] = ['actor', 'dancer']

export const TALENT_FILTERS = [
  { key: 'category', label: 'Category', section: 'Category', categories: 'all', kind: 'single', storage: 'skills', operator: 'equals', pill: true, options: options(['Actor or model', 'Dancer', 'Photographer or videographer', 'Content creator']).map((option, index) => ({ ...option, value: SEARCH_CATEGORIES[index] })) },
  { key: 'location', label: 'Location', section: 'Location', categories: 'all', kind: 'text', storage: 'profile', operator: 'contains', pill: true },
  { key: 'available_now', label: 'Available now', section: 'Availability', categories: 'all', kind: 'boolean', storage: 'talent_profile', operator: 'equals', pill: true },
  { key: 'age', label: 'Age', section: 'Demographics', categories: 'all', kind: 'range', storage: 'talent_profile', operator: 'range', unit: 'years', min: 16, max: 100 },
  { key: 'gender', label: 'Gender', section: 'Demographics', categories: 'all', kind: 'multi', storage: 'talent_profile', operator: 'overlaps', options: options(['Male', 'Female', 'Non-binary']) },
  { key: 'languages', label: 'Languages', section: 'Demographics', categories: 'all', kind: 'multi', storage: 'talent_profile', operator: 'overlaps', allowCustom: true, topOptions: 6, options: options(['English', 'French', 'Spanish', 'German', 'Hindi', 'Arabic', 'Portuguese', 'Italian', 'Mandarin', 'Cantonese', 'Russian', 'Sign Language', 'Polish', 'Punjabi', 'Urdu', 'Bengali', 'Gujrati', 'Tamil', 'Welsh', 'Irish', 'Turkish', 'Greek', 'Dutch', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Japanese', 'Korean', 'Thai', 'Vietnamese', 'Tagalog', 'Indonesian', 'Malay', 'Farsi', 'Hebrew', 'Kurdish', 'Somalian', 'Swahili', 'Yoruba', 'Igbo', 'Zulu', 'Xhosa', 'Amharic', 'Albanian', 'Bulgarian', 'Croatian', 'Czech', 'Estonian', 'Hungarian', 'Latvian', 'Lithuanian', 'Romanian', 'Serbo-Croatian', 'Slovak', 'Slovenian', 'Ukrainian', 'Catalan', 'Creole', 'Patois', 'Jamaican Patois', 'Armenian', 'Georgian', 'Mongolian', 'Nepalese', 'Sanskrit', 'Latin', 'Yiddish', 'Icelandic', 'Maltese', 'Lingala', 'Twi', 'Ewe', 'Wolof', 'Shona', 'Malayalam', 'Marathi', 'Sinhalese', 'Burmese', 'Lao', 'Khmer', 'Hawaiian', 'Quechua']) },
  { key: 'nationalities', label: 'Nationality', section: 'Demographics', categories: 'all', kind: 'multi', storage: 'talent_profile', operator: 'overlaps', allowCustom: true, topOptions: 6 },
  { key: 'backgrounds', label: 'Background', section: 'Demographics', categories: 'all', kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 6 },
  { key: 'rate', label: 'Day rate', section: 'Price', categories: 'all', kind: 'range', storage: 'talent_profile', operator: 'range', unit: 'gbp', min: 0, max: 20000, pill: true },
  { key: 'overseas_hire', label: 'Available for overseas hire', section: 'Practical', categories: 'all', kind: 'boolean', storage: 'public_attributes', operator: 'equals' },
  { key: 'own_transport', label: 'Own transport', section: 'Practical', categories: 'all', kind: 'multi', storage: 'public_attributes', operator: 'overlaps', options: options(['Car', 'Motorbike', 'No transport']) },
  { key: 'passport', label: 'Passport', section: 'Practical', categories: 'all', kind: 'multi', storage: 'public_attributes', operator: 'overlaps', options: options(['UK', 'EU', 'Other valid passport']) },

  { key: 'height', label: 'Height', section: 'Physical attributes', categories: PHYSICAL, kind: 'range', storage: 'talent_profile', operator: 'range', unit: 'cm', min: 100, max: 230, pill: true },
  { key: 'skin_tone', label: 'Skin tone', section: 'Physical attributes', categories: PHYSICAL, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', options: options(['Pale white', 'White', 'Olive', 'Tan', 'Light brown', 'Moderate brown', 'Dark brown', 'Deep dark brown', 'Deep black']) },
  { key: 'hair_colour', label: 'Hair colour', section: 'Physical attributes', categories: PHYSICAL, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, options: options(['Black', 'Dark brown', 'Brown', 'Light brown', 'Blonde', 'Red', 'Grey', 'White', 'Other']) },
  { key: 'eye_colour', label: 'Eye colour', section: 'Physical attributes', categories: PHYSICAL, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, options: options(['Brown', 'Hazel', 'Blue', 'Green', 'Grey', 'Amber', 'Other']) },
  { key: 'hair_type', label: 'Hair type', section: 'Physical attributes', categories: PHYSICAL, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', topOptions: 6, options: options(['1A Straight and fine', '1B Less straight', '1C Bone straight', '2A Soft waves', '2B Wavy', '2C Deep waves', '3A Soft curls', '3B Curly', '3C Ultra curly', '4A Coiled', '4B Zig-zag', '4C Tightly coiled', '5 Shaved or bald']) },
  { key: 'hair_colour_change', label: 'Open to hair colour change', section: 'Physical attributes', categories: PHYSICAL, kind: 'boolean', storage: 'public_attributes', operator: 'equals' },
  { key: 'hair_style_change', label: 'Open to haircut or style change', section: 'Physical attributes', categories: PHYSICAL, kind: 'boolean', storage: 'public_attributes', operator: 'equals' },
  // Client feedback 20 Jul 2026: additional structured physical characteristics.
  { key: 'facial_hair', label: 'Facial hair', section: 'Physical attributes', categories: PHYSICAL, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', options: options(['Clean shaven', 'Stubble', 'Moustache', 'Goatee', 'Short beard', 'Full beard', 'Open to shaving']) },
  { key: 'hair_length', label: 'Hair length', section: 'Physical attributes', categories: PHYSICAL, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', options: options(['Bald or shaved', 'Very short', 'Short', 'Shoulder length', 'Long', 'Very long']) },
  { key: 'body_type', label: 'Body type', section: 'Physical attributes', categories: PHYSICAL, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', options: options(['Slim', 'Athletic', 'Muscular', 'Average', 'Curvy', 'Plus size']) },
  { key: 'distinguishing_features', label: 'Distinguishing features', section: 'Physical attributes', categories: PHYSICAL, kind: 'text', storage: 'public_attributes', operator: 'contains' },
  { key: 'piercings', label: 'Piercings', section: 'Physical attributes', categories: PHYSICAL, kind: 'boolean', storage: 'public_attributes', operator: 'equals' },
  { key: 'tattoos', label: 'Tattoos', section: 'Physical attributes', categories: PHYSICAL, kind: 'boolean', storage: 'public_attributes', operator: 'equals' },
  { key: 'handedness', label: 'Handedness', section: 'Physical attributes', categories: PHYSICAL, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', options: options(['Right handed', 'Left handed', 'Ambidextrous']) },

  { key: 'acting_medium', label: 'Primary medium', section: 'Acting', categories: ACTOR, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', pill: true, options: options(['Screen acting', 'Stage acting', 'Voice acting', 'Musical theatre', 'Improvisational acting']) },
  { key: 'acting_technique', label: 'Acting technique', section: 'Acting', categories: ACTOR, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', options: options(['Stanislavski system', 'Method acting', 'Meisner technique', 'Practical aesthetics', 'Classical acting']) },
  { key: 'actor_type', label: 'Actor type', section: 'Acting', categories: ACTOR, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', options: options(['Personality actor', 'Character actor', 'Chameleon actor']) },
  { key: 'acting_qualifications', label: 'Qualifications', section: 'Acting', categories: ACTOR, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 6, options: options(['BA Hons Acting', 'BA Hons Acting for screen', 'BA Hons Musical theatre', 'BA Hons Acting-musician', 'CertHE or Foundation', 'MA Acting', 'MA Acting for screen', 'MFA', 'RADA', 'LAMDA', 'RWCMD', 'BFA', 'BA']) },
  { key: 'accents', label: 'Accents', section: 'Acting', categories: ACTOR, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true },
  { key: 'double_for', label: 'Double for', section: 'Experience', categories: [...ACTOR, ...DANCER], kind: 'text', storage: 'public_attributes', operator: 'contains' },
  { key: 'spact', label: 'SPACT', section: 'SPACT and stunts', categories: ACTOR, kind: 'boolean', storage: 'public_attributes', operator: 'equals', pill: true },
  { key: 'spact_types', label: 'SPACT type', section: 'SPACT and stunts', categories: ACTOR, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', dependsOn: { key: 'spact', value: true }, topOptions: 6, options: options(['Boxer', 'Martial artist', 'Stage combat', 'Aerial and circus', 'Contortionist', 'Dancer', 'Free runner or parkour athlete', 'Acrobat', 'Gymnast', 'BMX rider', 'Skateboarder', 'Horse rider', 'Swimmer, diver or sailor', 'Track and field', 'Firefighter', 'Military', 'Police', 'Archery', 'Roller-skater or rollerblader', 'Figure skater', 'Firearms', 'Swords and bladed weapons', 'Precision driver', 'Precision rider']) },
  { key: 'stunt_register', label: 'Stunt register', section: 'SPACT and stunts', categories: ACTOR, kind: 'boolean', storage: 'public_attributes', operator: 'equals' },
  { key: 'stunt_register_number', label: 'Stunt register number', section: 'SPACT and stunts', categories: ACTOR, kind: 'text', storage: 'public_attributes', operator: 'contains', dependsOn: { key: 'stunt_register', value: true } },
  { key: 'stunt_disciplines', label: 'Stunt disciplines', section: 'SPACT and stunts', categories: ACTOR, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 6, options: options(['Air ram', 'Bikes', 'Cars and driving', 'Boats', 'Climbing', 'Dance', 'Falling', 'Fire full burn', 'Gymnastics', 'Horse riding', 'Martial arts', 'Ropes and rigging', 'Parkour and free running', 'Performing', 'Safety', 'Sports', 'Water', 'Weapons', 'Wires']) },
  { key: 'kissing_scene', label: 'Kissing scenes', section: 'Scene comfort', categories: ACTOR, kind: 'boolean', storage: 'sensitive_preferences', operator: 'equals', restricted: true },
  { key: 'smoking_scene', label: 'Smoking scenes', section: 'Scene comfort', categories: ACTOR, kind: 'boolean', storage: 'sensitive_preferences', operator: 'equals', restricted: true },
  { key: 'nudity', label: 'Nudity', section: 'Scene comfort', categories: ACTOR, kind: 'boolean', storage: 'sensitive_preferences', operator: 'equals', restricted: true },
  { key: 'implied_nudity', label: 'Implied nudity', section: 'Scene comfort', categories: ACTOR, kind: 'boolean', storage: 'sensitive_preferences', operator: 'equals', restricted: true },
  { key: 'partial_clothing', label: 'Partial clothing', section: 'Scene comfort', categories: ACTOR, kind: 'boolean', storage: 'sensitive_preferences', operator: 'equals', restricted: true },

  { key: 'dance_skill_level', label: 'Skill level', section: 'Dance', categories: DANCER, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', pill: true, options: options(['Beginner', 'Intermediate', 'Advanced or professional']) },
  { key: 'dance_styles', label: 'Dance style', section: 'Dance', categories: DANCER, kind: 'multi', storage: 'skills', operator: 'overlaps', pill: true, allowCustom: true, topOptions: 6, options: options(['African contemporary', 'Afro-house', 'Bharata Natyam', 'Kathak', 'Kalarippayattu', 'Capoeira', 'Contemporary', 'Jazz', 'Hip hop', 'Salsa', 'Bachata', 'Heels', 'Tap', 'Dancehall', 'Afrobeats', 'Ballet', 'Modern', 'Lyrical', 'Irish', 'Stomping', 'Disco', 'Improvisation', 'Street', 'Break dance', 'Fire dance', 'Pole dance', 'Exotic dance', 'Belly dance', 'Twerk', 'Waltz', 'Aerial dance', 'Tango', 'Bollywood', 'Flamenco', 'Asian', 'Brazilian funk', 'Country', 'Musical theatre', 'Ballroom', 'Bhangra', 'Burlesque', 'Cabaret', 'Can-can', 'Cha cha cha', 'Charleston', 'Jive', 'Jitterbug', 'Kizomba', 'Lambada', 'Latin American', 'Limbo', 'Lindy hop', 'Line dance', 'Morris dance', 'Moonwalker', 'Northern soul', 'Polka', 'Quickstep', 'Robotics', 'Rhumba', 'Samba', 'Scottish', 'Soca', 'Square dance', 'Swing', 'Zumba', 'Body popper', 'Foxtrot', 'Freestyle', 'Gogo dancer', 'Calypso', 'Ceroc']) },
  { key: 'experienced_choreographer', label: 'Experienced choreographer', section: 'Dance', categories: DANCER, kind: 'boolean', storage: 'public_attributes', operator: 'equals' },
  { key: 'dance_qualifications', label: 'Qualifications', section: 'Dance', categories: DANCER, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, options: options(['Dance BA Hons', 'Level 4 DDE', 'Level 5 Diploma in professional dance', 'Level 6 DDP', 'Level 6 or 7 diploma', 'RAD teaching certification', 'IDTA associate or diploma', 'PGCE with QTS', 'ISTD']) },
  { key: 'dance_experience', label: 'Experience', section: 'Dance', categories: DANCER, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', options: options(['TV', 'Tour', 'Stage', 'Music videos', 'Film', 'Choreography', 'Live performance', 'Teaching', 'Musical theatre']) },

  { key: 'photography_camera_format', label: 'Photography camera format', section: 'Equipment', categories: PHOTO_VIDEO, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', options: options(['Full frame', 'Medium format', 'Micro Four Thirds']) },
  { key: 'photography_equipment', label: 'Photography equipment', section: 'Equipment', categories: PHOTO_VIDEO, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, options: options(['Canon', 'Nikon', 'Sony', 'Leica', 'Fujifilm', 'Panasonic', 'Kodak', 'Hasselblad', 'Olympus or OM System', 'Pentax', 'Phase One']) },
  { key: 'videography_equipment', label: 'Videography equipment', section: 'Equipment', categories: PHOTO_VIDEO, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, options: options(['ARRI Alexa', 'DJI', 'Canon', 'Nikon', 'Panasonic', 'Panavision', 'Sony', 'Leica', 'RED', 'Blackmagic']) },
  { key: 'netflix_approved_camera', label: 'Netflix-approved camera', section: 'Equipment', categories: PHOTO_VIDEO, kind: 'boolean', storage: 'public_attributes', operator: 'equals' },
  { key: 'photography_types', label: 'Photography type', section: 'Photography', categories: PHOTO_VIDEO, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', pill: true, allowCustom: true, topOptions: 6, options: options(['Commercial', 'Automotive', 'Wedding', 'Birthday', 'BTS', 'Gender reveal', 'Events', 'Fashion', 'Headshots', '360', 'Interior design', 'Food', 'Products', 'Beauty products', 'Swimwear', 'Sports', 'Architecture', 'Wildlife', 'Portrait', 'Vintage', 'Film', 'Newborn', 'Photojournalism', 'Golden hour', 'Pet', 'Travel', 'Real estate', 'Adventure', 'Black and white', 'Corporate', 'Candid', 'Cityscape', 'Double exposure', 'Fine art', 'Advertising and lifestyle', 'Aerial', 'Scientific', 'Stock', 'Pinhole', 'Self portrait', 'Concert', 'Family', 'Child', 'Glamour', 'Landscape', 'Bird', 'Macro', 'Sunset', 'Ocean', 'Underwater', 'Drone', 'Astrophotography', 'Panorama', 'Documentary', 'Street', 'Urban exploration', 'Editorial', 'War', 'Action', 'Still life', 'Abstract', 'Minimalist', 'Composite', 'Time-lapse', 'Long exposure', 'Blacklight', 'Studio', 'Hair', 'Hand', 'Feet', 'Nudity photography', 'Implied nudity photography', 'Cinematic']) },
  { key: 'videography_types', label: 'Videography type', section: 'Videography', categories: PHOTO_VIDEO, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', pill: true, allowCustom: true, topOptions: 6, options: options(['Action', 'BTS', 'Cinematography', 'Commercial', 'Automotive', 'Wedding', 'Events', 'Fashion', 'Interior design', 'Food', 'Products', 'Beauty products', 'Swimwear', 'Sports', 'Birthdays', 'Architecture', 'Wildlife', 'Travel', 'Real estate', 'Adventure', 'Black and white', 'Advertising and lifestyle', 'Aerial', 'Cinematic', 'Vlog']) },
  { key: 'delivery_time', label: 'Delivery time', section: 'Delivery', categories: PHOTO_VIDEO, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', unit: 'days', pill: true, options: options(['7 days', '14 days', '21 days']) },

  // --- Blueprint taxonomies (client PDF pp.27-32, 20 Jul 2026) ---
  { key: 'sports', label: 'Sports', section: 'Sports', categories: PHYSICAL, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 8, options: options(['Football', 'Football goalkeeper', 'Football ball skills', 'Basketball', 'Cricket', 'Rugby', 'Hockey', 'Ice hockey', 'Netball', 'Volleyball', 'Baseball', 'American football', 'Hurling', 'Badminton', 'Tennis', 'Table tennis', 'Squash', 'Golf', 'Lacrosse', 'Padel', 'Pickleball', 'Croquet', 'Boules', 'Bowles', 'Athletics', 'Gymnast', 'Body builder', 'Weight lifter', 'Runner', 'Marathon runner', 'Sprinter', 'Triathlete', 'Trampolinist', 'Pilates', 'Yoga', 'Aerobics', 'BMX tricks', 'Mountain biking', 'Racing cyclist', 'Ice skater', 'Parkour', 'Rollerblader', 'Roller skater', 'Skateboarder', 'Snowboarder', 'Skier', 'Boxer', 'Kickboxer', 'Cage fighter', 'Martial arts', 'Karate', 'Judo', 'Ju-jitsu', 'Muay Thai', 'Tae Kwon Do', 'Kung Fu', 'Capoeira', 'Kendo', 'Tai-chi', 'Wing Chun', 'Wrestler', 'Canoeist', 'Diver high-board', 'Scuba diver', 'Free diver', 'Rower', 'Strong swimmer', 'Synchronised swimmer', 'Sailor', 'Surfer', 'Wakeboarder', 'Water skier', 'Windsurfer', 'Water polo', 'Archery', 'Clay pigeon shootist', 'Climber', 'Falconery', 'Fencer', 'Fishing', 'Free runner', 'Horse rider', 'Hiking', 'Jouster', 'Kite boarder', 'Motorcross rider', 'Mountaineer', 'Polo', 'Pot holing', 'Billiards', 'Bowling', 'Chess', 'Darts', 'Poker', 'Pool', 'Snooker', 'Table football']) },
  { key: 'performance_skills', label: 'Performance skills', section: 'Performance', categories: ACTOR, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 8, options: options(['Auctioneer', 'Baton twirler', 'Cheerleader', 'Comedian', 'Improv comedy', 'Compere', 'Conductor', 'Magician', 'Magician\'s assistant', 'Master of ceremonies', 'Radio presenter', 'TV presenter', 'Stand-in', 'Toast master', 'Voice over artist', 'Motion capture', 'Physical theatre', 'Reenactor', 'Role play', 'Skin work', 'Stage combat', 'Sword fighting', 'Fire arms', 'Trained stunts', 'Puppeteer', 'Ventriloquist']) },
  { key: 'modelling_types', label: 'Modelling', section: 'Performance', categories: ACTOR, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 6, options: options(['Catalogue model', 'Catwalk model', 'Foot model', 'Glamour model', 'Hair model', 'Hand model', 'Leg model', 'Life model', 'Photographic model', 'Teeth model', 'Underwear model']) },
  { key: 'circus_skills', label: 'Circus skills', section: 'Performance', categories: PHYSICAL, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 6, options: options(['Acrobat', 'Adagio', 'Aerialist', 'Clown', 'Contortionist', 'Devil sticks', 'Fire breather', 'Fire eater', 'Fire swinger', 'Fire walker', 'Juggler', 'Contact juggler', 'Ladder walker', 'Mime artist', 'Plate spinner', 'Poi swinger', 'Stilt walker', 'Tight wire', 'Trapeze', 'Unicyclist', 'Wire work', 'Angle grinder']) },
  { key: 'film_crew_roles', label: 'Film crew experience', section: 'Experience', categories: 'all', kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 6, options: options(['AD', 'Boom operator', 'Camera operator', 'Catering', 'Costume', 'Cinematographer', 'Director', 'DOP', 'Grip', 'Props', 'Lighting', 'Editor', 'Floor manager', 'Make-up artist', 'Runner', 'Set design', 'Special effects', 'Sound']) },
  { key: 'trade_skills', label: 'Real trade skills', section: 'Experience', categories: 'all', kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 6, options: options(['Barista', 'Baker', 'Barstaff', 'Cocktail barstaff', 'Flair barstaff', 'Bouncer SIA', 'Close protection', 'Chef', 'Croupier', 'Mixing DJ', 'Drag artist', 'Waiter or waitress', 'Silver service', 'Beautician', 'Blacksmith', 'Butcher', 'Carpenter', 'Chauffeur', 'Limo driver', 'Florist', 'Gardener', 'Hairdresser', 'Landscape gardener', 'Massage therapist', 'Photographer', 'Aeroplane pilot', 'Helicopter pilot', 'Potter', 'Real clergy', 'Real dentist', 'Real doctor', 'Real fire fighter', 'Real nurse', 'Real paramedic', 'Real police officer', 'Stone mason', 'Tailor', 'Seamstress', 'Tree surgeon', 'Vet', 'Veterinary nurse', 'Window cleaner', 'Funeral director']) },
  { key: 'musical_instruments', label: 'Musical instruments', section: 'Music', categories: 'all', kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 8, options: options(['Professional musician', 'Sight read music', 'Trumpet', 'Trombone', 'French horn', 'Tuba', 'Cornet', 'Bugle', 'Accordion', 'Bagpipes', 'Bassoon', 'Clarinet', 'Didgeridoo', 'Flute', 'Harmonica', 'Saxophone', 'Tin whistle', 'Piccolo', 'Recorder', 'Oboe', 'Keyboard', 'Organ', 'Piano', 'Concert pianist', 'Synthesiser', 'Banjo', 'Cello', 'Double bass', 'Acoustic guitar', 'Bass guitar', 'Classical guitar', 'Electric guitar', 'Harp', 'Mandolin', 'Sitar', 'Viola', 'Violin', 'Ukelele', 'Drums', 'Bongo', 'Congas', 'Steel drums', 'Djembe', 'Dhol', 'Tambourine', 'Glockenspiel', 'Beatboxer', 'MC', 'Rapper']) },
  { key: 'singing_styles', label: 'Singing', section: 'Music', categories: PHYSICAL, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 6, options: options(['Alto', 'Backing singer', 'Baritone', 'Bass singer', 'Blues', 'Cabaret', 'Choir', 'Classical', 'Country', 'Folk', 'Gospel', 'Jazz', 'Mezzo soprano', 'Musical theatre singer', 'Opera', 'Pop', 'R\'n\'B', 'Reggae', 'Rock', 'Soprano', 'Soul', 'Swing', 'Tenor']) },
  { key: 'military_experience', label: 'Military and services experience', section: 'Experience', categories: ACTOR, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 6, options: options(['On set military training', 'HM Forces Army', 'HM Forces Navy', 'HM Forces RAF', 'Territorial Army', 'Royal Marine', 'Foreign forces', 'Cadets', 'Police service', 'Fire brigade', 'Ambulance service', 'Coast guard', 'Mountain rescue', 'St John Ambulance', 'British Red Cross']) },
  { key: 'driving_licences', label: 'Driving licences', section: 'Practical', categories: 'all', kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, options: options(['Full car', 'Advanced car', 'Motorcycle above 125cc', 'HGV', 'PCO', 'Minibus']) },

  // Measurements (client PDF p.48-49): stored as free text so talent can use
  // the units productions expect (feet/inches, UK shoe sizes).
  { key: 'measurement_head', label: 'Head (inches)', section: 'Measurements', categories: PHYSICAL, kind: 'text', storage: 'public_attributes', operator: 'contains' },
  { key: 'measurement_neck', label: 'Neck (inches)', section: 'Measurements', categories: PHYSICAL, kind: 'text', storage: 'public_attributes', operator: 'contains' },
  { key: 'measurement_chest', label: 'Chest (inches)', section: 'Measurements', categories: PHYSICAL, kind: 'text', storage: 'public_attributes', operator: 'contains' },
  { key: 'measurement_natural_waist', label: 'Natural waist (inches)', section: 'Measurements', categories: PHYSICAL, kind: 'text', storage: 'public_attributes', operator: 'contains' },
  { key: 'measurement_trouser_waist', label: 'Trouser waist (inches)', section: 'Measurements', categories: PHYSICAL, kind: 'text', storage: 'public_attributes', operator: 'contains' },
  { key: 'measurement_inside_leg', label: 'Inside leg (inches)', section: 'Measurements', categories: PHYSICAL, kind: 'text', storage: 'public_attributes', operator: 'contains' },
  { key: 'measurement_shoe_size', label: 'Shoe size (UK)', section: 'Measurements', categories: PHYSICAL, kind: 'text', storage: 'public_attributes', operator: 'contains' },

  // Ethnic appearance for casting (client PDF p.48). Like `backgrounds`,
  // may contain racial/ethnic-origin data: flagged for privacy review.
  { key: 'ethnic_appearance', label: 'Ethnic appearance (for casting)', section: 'Demographics', categories: PHYSICAL, kind: 'multi', storage: 'public_attributes', operator: 'overlaps', allowCustom: true, topOptions: 6, options: options(['Black African', 'Black Caribbean', 'East Asian', 'South Asian', 'South East Asian', 'Middle Eastern or North African', 'South and Latin American', 'White European', 'Mediterranean', 'Mixed heritage', 'Indigenous']) },
  { key: 'heritage_country', label: 'Heritage country', section: 'Demographics', categories: PHYSICAL, kind: 'text', storage: 'public_attributes', operator: 'contains' },
  { key: 'heritage_country_secondary', label: 'Second heritage country', section: 'Demographics', categories: PHYSICAL, kind: 'text', storage: 'public_attributes', operator: 'contains' },
] as const satisfies readonly TalentFilterDefinition[]

export type FilterKey = typeof TALENT_FILTERS[number]['key']

export const FILTER_BY_KEY = new Map<string, TalentFilterDefinition>(
  TALENT_FILTERS.map(filter => [filter.key, filter]),
)

export const FILTER_SECTIONS = [...new Set(TALENT_FILTERS.map(filter => filter.section))]

export function filtersForCategory(category: Category | 'all'): readonly TalentFilterDefinition[] {
  return TALENT_FILTERS.filter(filter => {
    if (category === 'all') return filter.categories === 'all'
    if (filter.categories === 'all') return true
    return filter.categories.includes(category)
  })
}

// Union across every discipline the talent works in. Talent are routinely
// more than one thing (a dancer who also acts), and picking a single category
// hides whole sections - SPACT and stunts for actors, measurements for
// dancers - that the person genuinely needs to fill in.
//
// With no declared discipline yet, offer everything rather than nothing:
// filtersForCategory('all') returns only the universal filters, which would
// hide physical attributes entirely from a talent who has not added skills.
export function filtersForCategories(
  categories: readonly Category[],
): readonly TalentFilterDefinition[] {
  if (categories.length === 0) return TALENT_FILTERS
  return TALENT_FILTERS.filter(
    filter => filter.categories === 'all' || filter.categories.some(c => categories.includes(c)),
  )
}
