// Strata word lists. Written for this game: common everyday English, family-friendly, no proper nouns, no slurs,
// no offensive or technical words. ANSWERS are the words a daily can pick. GUESS_ONLY are valid guesses that are never
// the answer, so the guess list is wider than the answer list. ALLOWED is ANSWERS followed by GUESS_ONLY.
// tests/games/strata-words.test.mjs checks length, letters, duplicates and that every answer is allowed.
// Changing ANSWERS reshuffles the daily schedule for every day after the epoch, so edit it deliberately.

const ANSWER_TEXT = `
about above actor adapt admit adopt adult after again agent agree ahead alarm album alert alike alive allow
alone along aloud amber amend angel anger angle angry ankle apart apple apply arena argue arise armor aroma
arrow aside attic audio avoid awake award aware awful bacon badge badly baker bagel basic basin basis batch
beach beard beast began begin being belly below bench berry birth black blade blame blank blast blaze bleed
blend bless blind block blood bloom board boast bonus boost booth bound brain brake brand brave bread break
breed brick bride brief bring brisk broad broke brook brush buddy build built bugle bunch burst buyer cabin
cable cargo carry carve catch cause chain chair chalk chaos charm chart chase cheap cheek cheer chess chest
chick chief child chill chime choir choke chord chunk cider claim class clean clear clerk click cliff climb
cling clock clove close cloth cloud clown coach coast color comet comic coral couch cough could count court
cover crack craft crane crash crate crawl crazy cream creek crime crisp cross crowd crown crude crumb crush
curly curve cycle daily daisy dairy dance dated dealt death debut decay delay dense depth diary dirty dodge
dough doubt dozen draft drain drama drank drawn dream dress dried drift drill drink drive drown dwell eager
eagle early earth eaten eight elbow elder elect elite empty enemy enjoy enter entry equal error essay evade
event every exact exist extra fable faint fairy faith false fancy fatal fault feast fence ferry fever fiber
field fifth fifty fight final first fixed flame flare flash flask fleet flesh flick float flood floor flour
fluid flush flute focus force forge forth forty forum found frame frank fraud fresh front frost fruit fudge
fully funny fuzzy gauge gleam glaze ghost giant given glass globe gloom glory glove going grace grade grain
grand grant grape graph grasp grass grave gravy great green greet grief grill grind groan gross group grove
grown guard guess guest guide guilt habit haiku happy harsh haste hasty hatch haunt hazel heart heavy hedge
hence herbs hiker hobby hoard holds honey honor horse hotel house human humor hurry ideal igloo image imply
index inner input irony issue ivory jelly jewel joint joker jolly judge juice jumpy kitty knife knock known
label labor large laser later laugh layer learn lease least leave legal lemon level lever light lilac limit
linen liver local lodge logic loose lobby lover lower loyal lucky lunar lunch lying magic major maker mango
manor maple march marsh match mayor meant medal media melon mercy merit merry metal meter midst might minor
minus mince mixed mocha model money month moral motor mound mount mouse mouth movie music naive navel
nerve never newly night noble noise north notch noted novel nudge nurse oasis occur ocean offer often olive
onion opera orbit order other ought outer owner ozone paint panda panel panic paper party pasta patch pause
peace peach pearl pedal penny peony pesto phase phone photo piano piece pilot pinch pitch pizza place plain
plane plant plate plaza plead point polar pound power press price pride prime print prior prize probe proof
proud prove pulse punch pupil purse quack queen quest quick quiet quilt quirk quite radar radio rainy
raise rally ranch range rapid ratio reach ready realm rebel refer reign relax relay reply rhyme rider ridge
rifle right rigid rinse risky rival river roast robot rocky rough round route royal ruler rural salsa sauna
sadly saint salad salon sauce scale scare scarf scary scene scent scout scrap screw sense serve seven shade
shake shall shame shape share sharp sheep sheet shelf shell shift shine shirt shock shoot shore short shout
sight silky silly since sixth sixty skill skirt slate sleep slice slide slope small smart smell smile smoke
snack snail snake sneak solar solid solve sorry sound south space spare spark speak speed spell spend spent
spice spike spill spine spoon sport spray squad stack staff stage stain stair stake stamp stand stare start
state steam steel steep steer stern stick stiff still stock stone stool stoop store storm story stove straw
stray strip stuck study stuff style sugar suite sunny super swamp swear sweet swift swing swirl sword syrup
table taste teach teeth tempo thank theme thick thing think third thorn those three throw thumb tidal tiger
tight timer tired title toast today token tooth topic torch total touch tough tower toxic trace track trade
trail train trait trash treat trend trial tribe trick troop trout truck truly trunk trust truth tulip tutor
twice twist uncle under union unite unity until upper upset urban usage usual valid value valve vapor vault
verse video vigor vinyl virus visit vital vivid vocal voice wagon waist waltz waste watch water weary weave
wedge weigh weird whale wheat wheel where which while white whole whose width witch woman world worry worse
worst worth would wound wrist write wrong yacht yeast yield yodel young youth zebra
`;

const GUESS_TEXT = `
abbey abide abler abode abort acorn acres acted adder addle adore adorn affix afire afoot agile aging agony
aimed aired aisle alder alibi align alloy aloof altar amaze ample amuse anvil apron aptly arbor arced ardor
armed arson ashen askew aspen attar atone audit auger avail avert axial axiom azure babes backs baggy baits
balmy banal banjo banks barge barns baron basil baths batty bayou beady beige belch belts bends bevel biker
bingo birch bison bland blare bleak blimp blink blips bliss blitz bloke blond blunt blurb blurt blush borax
bored borne bossy botch bough boxer brace braid brass brawl brawn bream brews briar bribe briny broil broom
brows brunt brute bucks budge buggy bulge bulky bumpy bunny burly burns burro bushy butch butte buxom cacao
cadet cairn camel canal candy caper carat carol cedar cello chafe chant chaps chasm cheat check chewy chirp
chive choky chore chump chute cigar cinch civic civil clack clamp clank clash clasp cleat cleft cloak clone
clump cobra cocoa colon combo comma conch condo cones coven cower coyly crabs crave crews crimp croak crony
crook croup cubic cumin cupid curio curry curse cutie cynic darts dazed debit decal decoy decry deity delta
denim deter detox devil diner dingo dirge disco ditch ditto ditty diver dizzy dogma dolly dopey dowdy downy
dowry drape drawl dread dregs drone drool drove drubs dryer ducks dully dusky dusty dwarf dying eased easel
eaves ebony edged edict eerie egret eject elegy elfin elope elude endow enact endue epoch equip erase erect
erode erupt ether evoke exalt excel exert exile expel extol eying facet fakes falls farce fatty fauna favor
feign fella felon femur fetch fiend fiery filet filly films filth finch fiord fitly fizzy fjord flair flake
flaky flank flaps fling flint flirt flock flora flown flows fluff flung flunk foamy focal foggy foray forks
forte foyer frail frays freak friar frill frisk frock frond frosh froth frown froze fugue fumes funds fungi
funky furry fused fussy gaffe gaily gales gamer gauze gecko geese genie genre gents genus ghoul giddy girth
gizmo glade glare glide glint gloat glyph gnash gnome godly gooey goofy gorge gorse gourd graft grail gramp
grate graze greed grebe gripe grist grits growl grubs guava guile guise gulch gulls gummy gusto gusty hairy
halls halve handy hangs hardy harem harpy haven havoc heath heave hefty heist helix hikes hills hilly hinge
hippo hitch hoist hound huffy hulls humid humus hunks hunky hurls husky hutch hydra hyena hyper icily idiom
idols inane incur indie inert infer ingot inlet ionic irate irked islet itchy jaunt jaded jazzy jeers jiffy
jilts jimmy jingo jolts jowls juicy jumbo kayak kebab keels khaki kiosk knack knead kneel knelt knits knobs
knoll koala kudos lager lairs lanky lapel lapse larch larva lasso latch lathe leafy leaks leaky ledge leech
leery lefty lemur levee liars libel licks lifts liken limbo limps lingo lipid liter livid llama loamy loath
lofty logos loins loopy loots lorry lousy lowly lucid lumpy lunge lupus lurch lurid lusty lyric macaw macho
mafia magma maize mambo manic manna mason mauve maxim mealy meaty medic memos messy metro mezzo micro midge
mimic minim minks mints mirth miser misty modal moldy moose moped mopey moray morph mossy motel motif motto
mourn mulch mural murky muted mylar myrrh nacho nadir nasal nasty natal nears needy nervy nexus niche niece
nifty nippy nitro nobly nodal noisy nomad norms nosey nutty nylon oaken oaths obese oboes oddly offal oiled
okapi olden older omega onset opals opine optic orcas organ otter ounce outdo ovary ovule overt ovoid oxbow
paces padre pagan pager pails pains paled palsy parka parry parse pasty patio patty payee peaks pecan peeks
perch perky pesky petal petty phlox phony pivot pixie plaid plied plier plush plume plump plunk poach poker
polka polyp pooch poppy porch posse pouch prank prawn preen pried prigs primp prism privy prong proxy prude
prune psalm pudgy puffy pulpy pupae puppy purge putty pygmy quail qualm quark quays query quota raced radii
raker rasps rates ratty raven razor reads reams rebus recap recur refit regal reins relic remit renew repay
repel resin retch retro revel rhino ricer riled riots ripen risen rites roach roams roans robed robin rocks
rodeo rogue roils roomy roots rosin rover rowdy rubes ruddy ruins rumba rumor runts rusty sabre saute savvy
sawed scald scalp scamp scant scarp scoff scoop scope scrub scrum scuba seals seams seedy seize sepia serif
shack shale shank shard shaft shawl sheen shied shiny shire shoal shrub shrug shunt sidle siege sieve sighs
sinew singe sinus siren skate skier skimp skink skulk skunk slack slain slang slant slaps slash slave sleek
sleet slept slews sling slink slips slosh sloth slump slunk slurp slush smack smear smelt smirk smite smock
smoky snaky snare snarl sneer snide sniff snipe snoop snore snort snout soapy sober soggy sooty sorer souse
spade spank spasm spawn speck spied spiky spilt spiny spire spite splat splay spoil spoke spore spout sprig
squab squat squid stale stalk stank stark stave stays steed stein stews stilt stint stoat stoke stony stout
strap strew stung stunt suave sulky surly sushi swarm swash swath sweat swell swipe swoon swoop swore sworn
swung tabby tacit tacky taffy talon tango tangy tardy taunt taupe tawny teary tease teddy tempt tenet tenor
tense tepid terse testy theft thief thigh thine thong thyme tibia tipsy toddy tonic topaz torso totem toxin
tract trawl tread tress triad trice trill trite troll trope troth trove truss tryst tubby tufts tuber tulle
tumid tunic turbo tusks tweak tweed twerp twine typed typos tyres ulcer umbra unfit unify unlit unset untie
upend usher vaunt vegan veils velum venom venue verge vexed vials vicar vigil villa vines viper viral visor
vista vodka vogue voile vomit vouch vowel waded waken walks warty wasps waver waxen weald weedy weeps whack
wharf whelp whiff whims whirl whisk whist wider widen widow winch windy wince wiper wisps witty wizen woken
wombs woody wooer wordy worms wormy wraps wreak wreck wrest wring wrung yanks yappy yarns yawns yelps yokel
yummy zests zippy zonal
`;

const MORE_GUESS_TEXT = `
adage adobe aegis afoul agate aimer alias alien alley allot aloes amass amble amigo amiss amply amuck angst
annex annul antic aorta apace argot arias array ascot asker atlas atoll augur aunts avant awash awoke bathe
baton beefy begun belle bento berth bible blear bleat bloat blobs blown blues bluff bogus boils bolts booms
boots bowed bowel bower bowls bract brash brats brine brink brood broth brown bully bunks burnt buzzy cabal
cabby cache cagey canny canoe canon capon caput cater caved champ chard chary chats chide chili chine chock
chomp chops chose chuck churn circa clang clink clomp clout clubs clued clung coals coden colds comfy cords
corny corps coupe covet cramp crank crass craze creak credo creed creep crepe crept crest crick cried crier
crone croon cruel crump crust crypt cuddy cushy cusps cutes daddy daffy darns daunt debts decks deign delft
demon depot derby deuce diets digit dimly dinky diode docks dodgy doily doing dolts domed donor donut dorms
downs drake drier drips droll droop drops dross drums duchy duets dwelt eared earns eater eclat edify embed
ember emcee enema ensue envoy ethic evens evict faded famed fated fawns fazed feats feeds feels feint felts
femme feral fetal fetid fetus fewer fibre fiefs filch filmy finds fined finer fishy fiver fixer flail flats
flaws fleas fleck flier flips floes flogs flout flues fluke flume foams foist folds folio folks fonts foods
fools forgo fosse fouls freed fried frier frigs frogs frump fumed furor fuses futon gains gamut gaped gases
gasps gassy gaunt gavel gawky gazed gears geeks genes geode gibes gifts gilds gills gimme ginny girls glads
glama glean glitz gloss gnarl gnats goads goals gobby goner gongs goody goofs goose gored gouge gouty grays
grime grimy groom grope grout gruel gruff grump grunt guano guild gulps gurus gutsy hacks harks harms hasps
hater hawks hazed heady heals heaps heard hears heels hello helms helps heron hertz hewed hives hocus holes
holly homer honed hoods hooks hoops hoped horde hosts hovel howls hubby huffs hulks humps hunch husks hymns
icing idiot idled ileum imbue impel inbox inept infra inset inter intro iodic items jabot jades jeans jerky
joked joust jumps junco junks juror keeps kefir kelps kinds kings kinks kiwis knave knell knots laced lacks
laden ladle laity lakes lambs lamps lance lanes larks lasts latex latte leach leads leant leapt leash leeks
lefts leggy lends licit liege lilts limbs limes lined liner links lions lithe lived loads loafs loans lobed
lobes locks locus lofts lolly loner longs looks looms loops loser lotus loudy louts lumen lumps lungs lured
lurks lutes macro madly maids mails maims mains makes malts mangy mania manly mares marks masts mated mates
matte mazes meals means mecca meets melee melts mends menus merge mesas meshy mewed miens miler milky mills
mined minty mired mites mitts mixer moans moats modem mogul moist molar molds moles molts momma monks mooed
moods moody moons moors morns moths mould moved mover moves mowed muddy muffs mules mulls mummy munch muses
mushy musky musts musty mutes mutts muzzy myths nabob nacre nails naked named naval necks needs neigh nerdy
nests newer newts nicer nines ninth nooks noons noose nosed notes nouns novae nulls numbs nymph oaten obeys
obits octet odium odors ogres oiler oinks okays omens opted orals oriel ovals ovens owing owned oxide pacer
pacts paddy paged pages pairs paler pales palms pandy pants papal parks paste paths patsy paved paves pawns
peels peers pelts penal pence peril perks perms pests picks picky picot piers pigmy piled piles pills pines
pinks pinky pints pious pipes pique pithy plait plank plans plats plays pleas pleat plods plots plows pluck
plugs plumb plums plung poets poise poked poles polls ponds pools pores ports posed poser posts pours pouts
prick prier prine prods props prose prowl puffs pulls pumas punks punts purer purls pylon pyres quaff quake
quart quash quell queue quids quiff quill quins quips quits quote rabid racer racks rafts raged raids rails
rains raked rakes ramps randy ranks rants rarer rayon razed reaps rearm recon reeds reefs reeks reels reeve
renal rends rigor rimed riper riser risks ritzy riven rivet roads roars robes roger roles romps roofs rooms
roost roped ropes roses rotor rouge roust roved rowed ruder rugby ruled rules rummy rumps rungs runny rusts
rutty sable sacks safer sales salts salty salvo sandy saner sappy sassy satin saucy saved saver saves savor
scabs scans scars scats scone scoot score scorn scowl sedan seeds seeks seems sells semis setup sever sewed
shady shaky shalt shams shark shave sheaf shear sheer shill ships shirk shoes shone shook shops shorn shots
shove showy shred shrew shuck shuns shush shyly sided sides sifts signs silks silts sines sinks sites sixes
sized sizes skids skies skiff skins skint skips skits slabs slams slats slaws slick slies slime slimy slits
slobs slots slows slugs slums slung slyly smash smith smote snags snaps snick snips snobs snows snubs snugs
soaks soaps soars socks sofas softy soils soled soles solos sonar songs soots sooth sorts souls soups sours
sowed spake spans spars spats spear specs spelt spicy spies spins spits split spool spoor spots sprat spree
sprue spunk spurn spurs spurt squib stabs stags staid stall stars stash stead steak steal stems steps stets
stile sting stink stoic stole stomp stood stops stork strep strum strut stubs studs stump stunk suede suits
sulfa sulks sully sumac sunup surer surge swabs swami swank swans swaps sward swats sways sweep swept swigs
swill swims swine swish taboo tails taint taken taker tales talks tally tamed tames tamps tangs tanks taped
tapes tares tarot tarps tarry tarts tasks tasty taxes taxis teams tears teems telex tends tenth tepee terms
texts thaws their thins threw throb thuds thugs thump tiara ticks tiers tiles tilts timed times timid tinge
tints tires titan toads toffs togas toils tolls tombs tonal toned tongs tools toots toppy totes tours towed
towel towns trams traps trees trews tried trier trims trine tripe trips trode trots trued trues trump tubes
tucks tummy tuned tunes turfs turns tuxes twain twang twigs twins twirl types tyros ultra uncut undid unfed
units unmet urged urges urine users using usurp uvula vague vails valor vamps vanes vapid vases veins veldt
venal vends vents verbs vests viand vibes vices views vying viler viola visas vixen voids volts voted voter
vowed wafer wager wages waifs waits waive waked wakes walls wands wanes wants wards wares warms warns warps
warts waved waves waxed weeds weeks wells welts wetly whelk whine whips whoop wicks wield wilds wills wilts
wimps winds wines wings winks wiped wired wires wiser withe wives women woods wooed wools words works wowed
wrath wrens wrote yards yearn years yells yolks yours zesty zings zones amity bogey borer boule carob cavil
cilia clave cozen cruet curvy dolor droid aloft bluer canto dunes exult feted fudgy idyll kelpy lavas mafic
marls moire moult ocher ogles pared pilaf pinto plebs posit prate rhumb ruche scrim seine shoji sitar skald
skuas sloop spiel tacos thane tilde toady tonga unarm unbox undue uraei vetch wrack zincs
`;

const split = (text: string) => text.trim().split(/\s+/);

/** The daily answers. A fixed order: the daily schedule is a permutation of this list. */
export const ANSWERS: readonly string[] = split(ANSWER_TEXT);

/** Valid guesses that are never the answer. */
export const GUESS_ONLY: readonly string[] = [...split(GUESS_TEXT), ...split(MORE_GUESS_TEXT)];

/** Every word a guess may use: the answers, then the guess-only words. */
export const ALLOWED: readonly string[] = [...ANSWERS, ...GUESS_ONLY];
