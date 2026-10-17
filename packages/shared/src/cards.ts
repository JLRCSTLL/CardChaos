import type { CardPack } from './index.js';

// Original Card Chaos writing. No licensed third-party card text.
const lines = (text: string) =>
  text
    .trim()
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
function pack(
  id: string,
  name: string,
  description: string,
  prompts: string,
  responses: string,
  mature = false,
): CardPack {
  return {
    id,
    name,
    description,
    mature,
    prompts: lines(prompts).map((text, i) => ({
      id: `${id}-p${i}`,
      text,
      pick: Math.max(1, (text.match(/____/g) || []).length),
      pack: id,
    })),
    responses: lines(responses).map((text, i) => ({ id: `${id}-r${i}`, text, pack: id })),
  };
}
export const PACKS: CardPack[] = [
  pack(
    'general',
    'Everyday nonsense',
    'Small problems. Spectacularly bad solutions.',
    `
The secret ingredient in Grandma's award-winning soup is ____.
My autobiography is called "____: A Completely Avoidable Journey."
What's the worst thing to bring to a job interview? ____
The neighborhood group chat is arguing about ____ again.
I came here for ____, but stayed for ____.
The world's least useful superpower is ____.
My emergency contact is now ____.
The museum's newest exhibit is just ____ in a glass box.
Nothing ruins a first impression faster than ____.
Scientists have finally explained why cats hate ____.
The wedding planner said absolutely no ____.
My fridge contains three things: hope, mustard, and ____.
Our family motto is "When in doubt, ____."
The new Olympic event combines ____ with ____.
The last thing I want to hear from my dentist is "____."
I traded ____ for ____ and have no regrets.
The theme park closed its newest ride: The ____ Experience.
My villain origin story began with ____.
`,
    `
A suspiciously large rubber duck
A raccoon with a five-year plan
A motivational speech from a toaster
One extremely confident pigeon
The emergency cheese drawer
A dramatic reading of a grocery receipt
Seven identical garden gnomes
A soup that judges you back
An emotional support traffic cone
My unpaid electricity bill
A PowerPoint presentation about my ex
An inflatable couch in a wind tunnel
The sound of a wet sock
A coupon for one free existential crisis
A handwritten apology to a houseplant
A pirate who gets seasick
The world's smallest standing ovation
A suspiciously warm doorknob
A hamster with diplomatic immunity
Bringing a ladder to brunch
A very competitive knitting circle
The wrong kind of birthday surprise
An aggressively beige living room
An owl wearing tiny reading glasses
The last fry in somebody else's bag
A magician who only knows Excel
An unlimited subscription to bad advice
A secret basement full of spoons
An unsolicited harmonica solo
A goose that knows my full name
Five minutes of completely avoidable eye contact
A single noodle with big ambitions
An apology cake with a typo
The backup backup umbrella
An angry letter written in glitter
A cereal mascot going through a phase
The smell of questionable confidence
A luxury hotel for lost socks
A truly unnecessary fog machine
A leaf blower at a library
Aggressive interpretive dance
The neighbor's suspiciously punctual rooster
A brief but intense feud with a vending machine
A birthday clown stuck in traffic
A tiny hat for a very big problem
A bag of air labeled artisanal chips
An emotional farewell to expired yogurt
The family group chat at 6 a.m.
A sword made of breadsticks
A fortune cookie with performance anxiety
A secret handshake that takes eleven minutes
Being outsmarted by a revolving door
A water bottle with trust issues
The ceremonial turning off of the Wi-Fi
A deeply personal review of a parking lot
An emergency meeting about napkins
A casserole with a legal disclaimer
A dramatic exit through the wrong door
A penguin on roller skates
An accidental conga line
A velvet portrait of a sandwich
Someone else's mysterious leftovers
A middle name nobody can explain
A very polite haunted house
A banana used as a serious business phone
Two ducks in a trench coat
A mildly cursed beanbag chair
A welcome mat that says "Reconsider"
A seven-course meal of cereal
My award-winning ability to overthink
An orchestra of squeaky shopping carts
A gold medal in missing the point
A soap opera about dish soap
The ice cream truck's revenge
A synchronized sneeze
A museum dedicated to mild inconvenience
The aggressive crunch of a public carrot
A vacation for my vacation
A completely unearned victory lap
A bucket labeled "miscellaneous feelings"
`,
  ),
  pack(
    'office',
    'Out of office',
    'For meetings that could have been a card game.',
    `
This meeting could have been ____.
Our company values are integrity, teamwork, and ____.
HR would like a quick word about ____.
The new employee benefit is unlimited ____.
Please find attached ____.
Our team-building exercise ended with ____.
My professional development goal is ____.
The printer only works if you offer it ____.
The CEO announced a bold pivot from ____ to ____.
What's actually in the break-room fridge? ____
My out-of-office reply simply says "____."
The intern fixed everything using ____.
The annual review praised my commitment to ____.
The dress code allows business casual and ____.
This quarter, we're replacing ____ with ____.
Someone accidentally shared ____ during the video call.
The office fire drill revealed ____.
Our next company retreat will focus on ____.
`,
    `
A spreadsheet that has seen too much
Replying all with "please remove me"
The meeting before the pre-meeting
A calendar invite titled "Quick chat"
The office microwave's criminal record
A passive-aggressive sticky note
An unpaid internship for the office plant
A standing desk nobody stands at
A corporate retreat to the supply closet
Synergy-flavored coffee
The executive bathroom password
A performance review written by a goldfish
An email with seventeen signatures
The emotional support swivel chair
A team-building trust fall into debt
A mandatory fun committee
A motivational poster facing the wall
A slide deck with 400 transitions
An elevator pitch delivered in the stairs
The quiet rage of a frozen loading bar
The sacred last clean mug
An extremely urgent font decision
An attachment named final_FINAL_v9
A lunch break scheduled for next year
The office birthday song in three time zones
A resignation letter on a napkin
A quarterly report made of vibes
The person who heats fish at noon
A promotion to chief cable untangler
A microphone that only works when you sigh
The company's emotional baggage carousel
A legally binding pinky promise
A motivational speech from the photocopier
A headset with a mysterious chewing sound
The director of unnecessary acronyms
A twelve-step process for buying a stapler
An expense claim for emergency doughnuts
A new password every seventeen minutes
Friday energy on a Tuesday morning
An away status with suspicious ambition
The intern's surprisingly powerful grandmother
A meeting room named after a failed project
A desk drawer full of tiny rebellions
An onboarding video from 1998
A corporate mascot in serious need of a break
A lunch labeled "definitely not yours"
The elevator's awkward silence championship
A swivel chair race with legal consequences
A job description written by a wizard
An office plant with more seniority than me
A budget held together by paper clips
A raise paid entirely in pizza
The unmute button's betrayal
A sticky keyboard and an unsolved mystery
An agenda with no survivors
A surprise visit from the spreadsheet police
A team photo taken during a sneeze
A consultant who only speaks in arrows
My carefully curated busy face
A whiteboard full of confident nonsense
An empty suggestion box with a lock
A breakout room nobody can escape
A wellness seminar during lunch
A networking event for introverted staplers
The ghost of deadlines past
A status update with a plot twist
A coffee machine that demands references
One brave person actually leaving at five
A desk booked six months in advance
A business case for taking a nap
A celebratory email with no pay rise
A task force to rename the task force
A coworker who narrates every click
A company hoodie instead of a pension
An action item that became self-aware
A suspiciously cheerful Monday announcement
The ancient art of looking at two monitors
A secret alliance with the IT department
Three managers and zero decisions
An emergency "circle back" button
`,
  ),
  pack(
    'filipino',
    'Barkada energy',
    'Karaoke, group chats, and one more serving.',
    `
The real reason the family reunion started late was ____.
The karaoke machine gave me 100 points for ____.
My balikbayan box contains nothing but ____.
The barangay talent show was won by ____.
You know the fiesta has started when you see ____.
Tita's latest business idea combines ____ and ____.
The jeepney sign says "Bawal ____."
We survived the brownout using ____.
The group chat named our next trip "____."
The sari-sari store now offers ____ on credit.
The secret to perfect adobo is ____.
Every Filipino party needs rice, karaoke, and ____.
I said "I'm on the way" while actually doing ____.
Our beach trip packing list is ____ and ____.
The final round of the family parlor game requires ____.
My pasalubong this year is ____.
The tricycle driver gave me life advice about ____.
The Christmas decorations went up early because of ____.
`,
    `
A karaoke microphone with main-character energy
The ice cream tub full of frozen fish
A balikbayan box with its own passport
The legendary last piece of lumpia
Rice for emotional support
Tita's detective-level relationship questions
A tabo with international ambitions
A jeepney playlist that never misses
Three generations debating the correct adobo
The plastic-covered sofa of destiny
A fan pointed at absolutely everyone
A fiesta portion for one hundred unexpected guests
A slipper with perfect aim at a cockroach
A sari-sari store loyalty program
An emergency stash of calamansi
A karaoke duet nobody agreed to
The good plates reserved for mysterious visitors
An entire suitcase of pasalubong
A beach trip planned in 400 messages
The friend who's "five minutes away" from waking up
The last seat beside the jeepney driver
A refrigerator covered in delivery menus
A family photo with seventeen retakes
A game of tumbang preso with championship commentary
The auntie who packed food before the party started
Extra rice and absolutely no regrets
A monobloc chair with a dramatic past
The videoke score that tore a family apart
A tiny electric fan working overtime
A parol visible from space
An umbrella that survived three summers
The taho vendor's perfect timing
A Christmas playlist in September
A group chat that only sends good-morning flowers
A bowl of halo-halo taller than my ambitions
A lechon photo shoot before anyone eats
A tricycle with surround sound
The cousin assigned to all tech support
A walis tambo with legendary status
A bank calendar from five years ago
A mall trip disguised as an errand
A karaoke queue longer than the guest list
The sacred emergency SkyFlakes
A buko pie with its own security detail
A rice cooker that deserves a medal
A graduation tarpaulin larger than the graduate
A family reunion name tag nobody reads
The unsolicited second serving
An electric fan repair tutorial from Tito
A beach cooler full of optimism
A pair of slippers marking a parking spot
The barangay basketball announcer's catchphrase
A mobile load transfer with dramatic stakes
A pan de sal pilgrimage at sunrise
A pot of sinigang that starts a debate
The mysterious sewing kit in the cookie tin
A karaoke song dedicated to the wrong person
A weekend itinerary approved by the entire clan
A spoon-and-fork power move
A merienda break during another merienda break
A sticker-covered water dispenser
The cousin who knows a shortcut through six barangays
A tin of corned beef treated like treasure
An all-weather laundry rescue team
A handwritten "out of order" sign with personality
A Christmas raffle prize of one sack of rice
A birthday spaghetti mountain
The electric fan's number-three setting
A rainy-day champorado mission
A reunion game with suspiciously specific rules
An unclaimed food container from last Christmas
A karaoke ballad at 8 a.m.
A pineapple shirt with big weekend plans
A jeepney fare passed through nine hands
A fiesta invitation that includes the whole street
A family recipe measured in "just enough"
A sari-sari store cat supervising inventory
A beach umbrella held down by determination
A packet of banana ketchup in every pocket
The unstoppable "one last song"
`,
  ),
  pack(
    'tech',
    'Terminally online',
    'Side quests, bad Wi-Fi, and questionable updates.',
    `
The latest software update adds ____.
My gaming setup cost more than ____.
The final boss was defeated by ____.
The Wi-Fi password is now ____.
The robot uprising was delayed by ____.
My search history is mostly ____.
The tutorial forgot to explain ____.
The next viral app is just ____ with ____.
My character's special ability is ____.
The algorithm thinks I'm interested in ____.
The AI's first demand was ____.
The livestream ended abruptly because of ____.
Our startup disrupts ____ using ____.
The bug report simply said "____."
The secret level contains ____.
The loading screen tip reads "Always bring ____."
I spent my entire inventory on ____.
The new terms and conditions require ____.
`,
    `
A router held together by hope
A boss fight against the tutorial
A keyboard louder than my thoughts
An AI trained exclusively on fridge magnets
A software update during the final round
A screenshot of a screenshot of a screenshot
The emotional damage of 1% battery
A dragon with a customer service script
A subscription to my own doorbell
A password manager that forgot its password
A speedrun of making bad decisions
A non-player character with union demands
The loading bar stuck at ninety-nine percent
A loot box full of ordinary socks
An achievement for opening the settings
A dating app for abandoned browser tabs
A virtual reality waiting room
The world's least stealthy stealth mission
A printer asking for cloud permissions
A gamer chair with lumbar betrayal
A captcha that questions my humanity
An algorithm with a grudge
A side quest that became a full-time job
A bug wearing a feature costume
Seventeen tabs playing mysterious music
A smart fridge gossiping with the toaster
A patch note that just says "good luck"
A final boss who wants to talk about feelings
A USB plug inserted wrong three times
A tutorial narrated by a confused wizard
An entire kingdom saved for five coins
A livestream of a buffering symbol
A loot goblin with a retirement plan
The sound of a laptop preparing for takeoff
A cloud backup of my bad ideas
An esports contract for Minesweeper
A digital pet with student loans
A thousand unread software notifications
A keyboard shortcut to another dimension
The Wi-Fi dead zone at the perfect spot
A video call filter that won't turn off
A software engineer fixing the family printer
A spreadsheet with a final boss
A speed boost directly into a wall
The last working charging cable
A dramatic monologue from the error message
A character creator with too many eyebrows
A browser asking if I'm still emotionally available
A chatbot stuck in small talk
A rare sword shaped like a baguette
A save file named "please work"
A coding interview conducted by a duck
An accidental purchase of 800 digital hats
A map marker in the wrong universe
A gaming mouse with too many secrets
A mandatory update to my personality
A rogue semicolon with a revenge plot
A smartwatch disappointed in my choices
A virtual meeting in a virtual broom closet
A legendary item with terrible instructions
A battery saver that saves nothing
A dungeon made entirely of pop-up ads
A ten-hour video of keyboard cleaning
A game controller sticky with history
A server powered by frantic pedaling
A strongly worded comment in ancient code
A pixel-perfect recreation of my mistakes
A firewall made of actual tiny bricks
A tech support ticket for a haunted mouse
An unskippable cutscene about tax forms
A social network for unwatered plants
A firmware update for a stapler
A gaming clan with a very strict snack policy
A QR code leading to more QR codes
A robot vacuum guarding a single crumb
A trophy for finishing the privacy policy
A phone case thicker than the phone
A glitch that makes everyone mildly disappointed
A comment section with diplomatic immunity
A progress bar powered by positive thinking
`,
  ),
  pack(
    'mature',
    'After hours',
    'Adult situations, dating disasters, and questionable decisions. 18+.',
    `
My dating profile should probably mention ____.
The morning after the party, I discovered ____.
My therapist wrote down ____ and sighed.
The bachelorette party's group chat is now named ____.
The bartender refused to mix ____ with ____.
My ex still has my ____.
The least seductive thing to whisper is "____."
Adulthood is just ____ followed by ____.
The honeymoon was briefly interrupted by ____.
I blame my questionable decisions on ____.
Our couples' costume accidentally looked like ____.
The wedding toast mentioned ____ a little too often.
My attempt at romance ended with ____.
The real walk of shame is walking home with ____.
The apartment listing calls ____ a luxury feature.
My hangover cure involves ____.
The worst possible name for a cocktail is ____.
Being thirty is realizing you actually want ____.
`,
    `
A flirty text sent to the landlord
A hangover with a five-act structure
The audacity of my ex's new haircut
A dating profile written by my accountant
A breakup playlist longer than the relationship
A wine tasting in a laundry room
A tax return that kills the mood
An aggressively unromantic coupon book
A bachelor party with a bedtime
A suspicious stain on a fancy shirt
A regrettable midnight haircut
The confidence of two overpriced cocktails
A romantic dinner lit by a smoke alarm
The walk of shame to the recycling bin
A mattress on the floor and big promises
An emergency escape from a terrible date
A champagne budget and tap-water income
A lease agreement as a love language
A crush on someone who replies "k"
An ex who wants their air fryer back
The emotional baggage allowance being exceeded
A text that should have stayed in drafts
A spicy message corrected by autocorrect
A terrible pickup line delivered sincerely
A divorce party with excellent catering
A seductive voice ruined by hiccups
A group chat full of regrettable evidence
An adult tantrum in the furniture aisle
A bar tab with more digits than expected
A date that brought a business proposal
A romantic getaway beside a construction site
A brutally honest fortune teller
A cocktail named "Unresolved Issues"
A second date conducted like a job interview
A therapist's extremely long pause
A budget spreadsheet in the honeymoon suite
A party dress with snack pockets
The ceremonial deletion of a dating app
A surprisingly judgmental bartender
A scented candle called "Bad Decisions"
A midnight snack with commitment issues
A public apology to my liver
A fancy robe and no life plan
An awkward encounter in the couples' massage room
A landlord who calls mold a lifestyle feature
A flirtation derailed by train timetables
A breakup text with bullet points
A wedding speech that needs legal review
A revenge glow-up funded by store credit
A romance novel interrupted by rent reminders
A matching tattoo of an inside joke nobody remembers
A dramatic toast to lowered expectations
A nightclub with excellent seating
A dating app notification during couples' counseling
The morning-after search for my left shoe
A questionable party favor in a sensible handbag
A budget-friendly midlife crisis
A late-night confession about stealing fries
A thirst trap accidentally sent to the family chat
A bottle of wine labeled "Monday"
A heart-to-heart with a bathroom mirror
A passionate argument about fitted sheets
A voice note with too much backstory
A date whose red flags have red flags
A cocktail umbrella doing all the emotional labor
A mortgage application as foreplay for accountants
A poorly timed wink during a safety briefing
A glamorous night of canceling plans
A bachelor pad with seventeen decorative swords
An anniversary gift purchased at a gas station
A romance conducted entirely in calendar invites
A dance floor injury from excessive confidence
A questionable decision in excellent shoes
A dating bio containing the phrase "alpha spreadsheet"
A pillow fort for emotionally exhausted adults
A friendship bracelet from a chaotic fling
A dinner reservation under my ex's name
A love letter with tracked changes
A hotel minibar bill worth crying over
A passionate desire for eight hours of sleep
`,
    true,
  ),
];
export const PACK_INFO = PACKS.map(({ prompts, responses, ...info }) => ({
  ...info,
  prompts: prompts.length,
  responses: responses.length,
}));
