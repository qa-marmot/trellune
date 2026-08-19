export interface AuthoredReadingFeedback {
	readonly keyPoints: readonly string[];
	readonly evidenceClue: string;
	readonly commonMisunderstanding: string;
}

const feedback = {
	6: [
		'Mika asks the teacher to say it again.',
		'cannot hear / please say that again',
		'She is not asking for a new book.',
	],
	12: [
		'The books are on the desk; the bag is under the chair.',
		'on the desk / under the chair',
		'Do not place the bag by the window.',
	],
	18: [
		'The vegetable curry is suitable because it has no meat.',
		'does not eat meat / curry has no meat',
		'The chicken soup is not suitable.',
	],
	24: [
		'Turn left at the bank; the library is next to the park.',
		'turn left / next to the park',
		'Across from the café describes the library, not the bank.',
	],
	30: [
		'The black jacket fits Aya and costs less.',
		'her size / costs less',
		'Warmth describes the blue jacket, which is too large.',
	],
	36: [
		'Leo bought food and cooked pasta before calling his sister.',
		'First / Then / After dinner',
		'Watching the film happened after the call.',
	],
	42: [
		'Rain stopped the tennis plan; Nora went to a museum with a friend instead.',
		'but it rained / instead',
		'The museum was the changed plan, not the original plan.',
	],
	48: [
		'The community room is quieter and has a large table, but it closes at eight.',
		'quieter / large table / although',
		'A complete answer needs both an advantage and a disadvantage.',
	],
	54: [
		'Emi should give the north entrance location, the cyclist’s condition, and the help needed.',
		'north entrance / awake / cannot stand',
		'Do not omit the exact location when asking for help.',
	],
	60: [
		'The river walk suits Omar because it is outdoors, free/easy to reach, and good for sunset photos.',
		'only two hours / photos outside',
		'The museum being quiet does not match his outdoor-photo goal.',
	],
	66: [
		'Both enjoy live music; their study/work music and venue preferences differ.',
		'They both / but',
		'Do not report only the differences.',
	],
	72: [
		'Yuki agrees noise is a problem and suggests lighting plus a quiet-hours sign before earlier closure.',
		'agrees / However / suggests',
		'She does not reject concern about noise.',
	],
	78: [
		'Sora uses visible shared context and an easy, non-personal follow-up question.',
		'team cap / close game / whether',
		'Suitability comes from context and low personal risk, not only friendliness.',
	],
	84: [
		'“Drop by” was misunderstood; Hana asked, heard a paraphrase, and confirmed the time.',
		'asks for clarification / means / confirms',
		'Repeating the same phrase alone would not repair the meaning.',
	],
	90: [
		'Rina now sustains familiar talk with follow-ups and paraphrase; word-finding still takes time.',
		'but now / She still',
		'Completion does not mean all difficulty disappeared.',
	],
	96: [
		'A small working version made the idea concrete, enabling the team to divide work and finish.',
		'Once everyone could see it working',
		'The team did not succeed because they discussed more details.',
	],
	102: [
		'They smile because the photo recalls neighbourly help and recovery, not only the rain.',
		'reminds them of the help',
		'The wet ground alone does not explain the positive emotion.',
	],
	108: [
		'The organiser kept both formats because users needed different benefits: convenience and direct support.',
		'convenience and direct support',
		'The passage does not say one format was best for everyone.',
	],
	114: [
		'Portability, ten-hour battery, lower cost, and sufficient document/video capability fit Mina.',
		'carry every day / ten hours / does not play games',
		'Gaming power is irrelevant to her stated needs.',
	],
	120: [
		'The council balances evening access for older/late workers against broad daytime cycling and traffic benefits.',
		'evening buses / bicycle lanes / urgent now',
		'Support for both options does not remove the budget trade-off.',
	],
	126: [
		'It must confirm by Friday so people can register and capacity can be managed if rain forces the smaller gym.',
		'gym cannot hold every visitor / confirm / register',
		'Weather alone is not the full reason for the deadline.',
	],
	132: [
		'Two home-working days are confirmed; the move and new monitors remain possible.',
		'has confirmed / may / might',
		'Do not present the October move as certain.',
	],
	138: [
		'A colleague’s offer of a nearby room enabled Luis to use his cloud backup and continue.',
		'offered / moved / cloud copy',
		'Discovering the power cut identified the problem but did not solve it.',
	],
	144: [
		'Residents asked about schedule and engine noise; the company changed instructions and tested a later route.',
		'asked whether / asked what / said that',
		'The later route was being tested, not already proven successful.',
	],
	150: [
		'Wrong train/low battery created the problem; Sara sought directions and called; she arrived late with a prevention plan.',
		'wrong train / worker / called / would check',
		'A retelling should keep the problem, response, and result—not every detail.',
	],
	156: [
		'A trial provides evidence on benefits and risks before a permanent meeting-free policy.',
		'one-month trial / compare',
		'The passage does not claim the change will certainly help.',
	],
	162: [
		'Booking, deposit, and safety safeguards changed Haruto’s view; careful management remained necessary.',
		'safeguards answered / still believed',
		'He did not abandon his concern completely.',
	],
	168: [
		'Naomi gets the table temporarily with headphones/clear end time; Alex gets notice, alternatives, and breakfast preparation.',
		'They agree / while',
		'A fair account must show how both needs are addressed.',
	],
	174: [
		'The example explained intended meaning in concrete user steps, allowing Dan to confirm it.',
		'did not repeat / intended / example / paraphrased',
		'Repeating “quite simple” would preserve the ambiguity.',
	],
	180: [
		'Longer organised explanations, follow-ups, summary, and repair show progress; speed accuracy and unfamiliar wording remain needs.',
		'can / sometimes / next goal',
		'Stage completion is not evidence that accuracy and listening limits disappeared.',
	],
	186: [
		'The repeated error occurred while Nao changed screens; changing timing and checking understanding reduced later help.',
		'noticed / while changing screens / fewer',
		'Clear slides alone did not prevent the problem.',
	],
	192: [
		'Maya stresses late external feedback; Theo adds the team’s controllable delay in asking priorities.',
		'agreed / but also',
		'Theo does not deny the external delay.',
	],
	198: [
		'Thursday attendance rose most; all-day table use and display feedback also mattered; staffing cost remains unknown.',
		'rose most / every open day / measuring',
		'The strongest attendance result does not settle cost-effectiveness.',
	],
	204: [
		'Emi replaced “delayed” with simpler meaning and showed the updated time.',
		'train will go, but later / showed',
		'Repeating the announcement was not enough.',
	],
	210: [
		'The organiser admits weak promotion while preserving evidence of engagement and support for another attempt.',
		'lower than hoped / but / Next time',
		'The note neither calls the event a full success nor a failure.',
	],
	216: [
		'A two-day morning plan can be revised using new weather, staffing, and missed-request evidence.',
		'for two days / followed by a review',
		'It is not a permanent choice for the entire week.',
	],
	222: [
		'Support patterns and usability testing showed unclear wording—not server speed—caused hesitation.',
		'returning / could not understand / test confirmed',
		'The visible symptom “slow” was not the underlying cause.',
	],
	228: [
		'The teacher accepts speed/translation benefits but requires text and paper access safeguards.',
		'only if / also / on request',
		'A conditional position is not complete opposition.',
	],
	234: [
		'Managers and employees select survey evidence tied to different responsibilities.',
		'Neither / each selected',
		'Different emphasis does not mean either group ignored the evidence.',
	],
	240: [
		'Lena changed from all-free to a mixed fee policy while retaining equal access as her value.',
		'revised / central value stayed',
		'Her core concern about exclusion did not change.',
	],
	246: [
		'Category, location, and function made the unknown word guessable.',
		'small metal part / cupboard / lets',
		'Appearance alone was not the full strategy.',
	],
	252: [
		'Priya preserved permission for a limited test and the restriction against full release.',
		'limited test / but not',
		'Reporting only approval or only criticism loses half the message.',
	],
	258: [
		'Disposable use fell, but long-term affordability is unknown because staff time costs are unresolved.',
		'fell sharply / does not yet show',
		'An environmental effect does not prove financial sustainability.',
	],
	264: [
		'Narrowing defined “accurate,” added evidence, and admitted a limitation, making the claim testable.',
		'removed irrelevant / example / still',
		'A narrower claim can be more credible, not weaker.',
	],
	270: [
		'Extended organisation, summary, clarification, solution comparison, and paraphrase show progress; speed and implied stance remain limits.',
		'can / not always / harder',
		'The evidence supports readiness, not B1+ certification.',
	],
	275: [
		'Festival trial demand supports cultural use; timing, duration, operating cost, and neighbour impact limit generalisation.',
		'filled most / but / arts festival',
		'High festival attendance does not settle ordinary demand or long-term affordability.',
	],
	280: [
		'New visitors may need sequence and questions while experienced or break-taking visitors value control; each format loses something.',
		'first-time / experienced / although',
		'Higher satisfaction alone does not prove one exhibition format supports every visitor.',
	],
	285: [
		'The issue is how transparency connects to fair review, explanation, and justified exceptions—not transparency versus secrecy.',
		'not simply / it is about',
		'The counterpoints identify implementation needs rather than proving secrecy is better.',
	],
	290: [
		'Visitor totals omit mobility, delivery, distributional costs, and weather/event effects.',
		'limited mobility / deliveries / Even',
		'A higher total can hide exclusion of a smaller group.',
	],
	295: [
		'Response-time pressure encouraged short replies that failed to resolve cases, causing reopenings.',
		'short standard replies / reopening',
		'A faster first response was not the same as a solved problem.',
	],
	300: [
		'Shared values were hidden by different predictions about traffic, rent, and shops.',
		'same goal / predicts / uncertain effects',
		'Not every disagreement is a conflict of fundamental values.',
	],
	305: [
		'Two shared notebooks versus a dated photocopy shows sync changes together while backup preserves an earlier state; real systems are more complex.',
		'not the same / photocopy does not change',
		'Synchronization alone is not recovery from copied deletion.',
	],
	310: [
		'Self-selection, available time, existing exercise, and seasonal weather weaken the causal claim.',
		'may have been more likely / may also',
		'Association does not prove the walking group caused lower stress.',
	],
	315: [
		'One failure may need a quick fix; repeated failures justify deeper process/ownership analysis.',
		'If once / If weekly / Repetition',
		'The deepest explanation is not automatically best for every decision.',
	],
	320: [
		'Ravi accepts maintenance cost, questions majority-usage evidence, and proposes user contact, replacement testing, and transition.',
		'agrees / but / Instead',
		'He does not demand that the old feature remain forever.',
	],
	325: [
		'Coverage, workload, and role constraints tell where the policy needs redesign, not that every shorter week fails.',
		'do not prove / conditions',
		'A strong counterargument is not a complete rejection.',
	],
	330: [
		'All groups want safety and proportionate review; they disagree whether cameras are necessary and what evidence justifies them.',
		'common ground / remaining disagreement',
		'The meeting did not reach full agreement.',
	],
	335: [
		'The reviewer values the artistic experience but conditionally doubts crowd handling at full events.',
		'warm sound / less clear / though',
		'The venue is not simply good or bad; the recommendation depends on event size.',
	],
	340: [
		'Repair priority, remaining funds, and delayed commitment imply deferral and lower priority—not cancellation.',
		'essential / remaining / before committing',
		'Do not report the training proposal as rejected.',
	],
	345: [
		'A simple yes hides weaker outcomes with less onboarding and unknown scalability.',
		'fuller answer / while / does not yet know',
		'Target participation and completion do not prove scalable success.',
	],
	350: [
		'A mixed system could combine predictability and access; weekend behaviour and real walk-in protection remain untested.',
		'mixed / not weekends / only balanced if',
		'Calling a policy mixed does not prove equal access.',
	],
	355: [
		'The breakfast fee was technically included but not prominent enough for informed choice.',
		'technically present / not prominent',
		'The complaint is not that no fee information existed or that illegality was proven.',
	],
	360: [
		'The decision depends on role, experience, task, accessibility, home conditions, and purpose—not a universal location rule.',
		'not complete opposites / consider / question is',
		'Individual focus alone does not settle team learning and fairness.',
	],
	365: [
		'Completion and averages can hide uneven performance; full estimates require direct evidence across reading, writing, listening, and speaking.',
		'does not by itself / across / weaker skills',
		'A pass or strong average is not proof every CEFR mode is demonstrated.',
	],
} as const satisfies Record<number, readonly [string, string, string]>;

export const AUTHORED_READING_FEEDBACK: ReadonlyMap<number, AuthoredReadingFeedback> = new Map(
	Object.entries(feedback).map(([day, [keyPoint, evidenceClue, commonMisunderstanding]]) => [
		Number(day),
		Object.freeze({
			keyPoints: Object.freeze([keyPoint]),
			evidenceClue,
			commonMisunderstanding,
		}),
	]),
);
