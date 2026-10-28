// Default program, nutrition framework and run history.
// Everything here is copied into the app's stored data on first launch and is
// editable from Settings > Edit program. Changing this file later does not
// overwrite what is already on the phone.

export const SEED_VERSION = 3;

// ---- helpers for building interval segments -------------------------------
// Segment: { l: label, s: seconds (0 = open-ended, tap Next when done), k: kind }
// Repeat block: { x: rounds, items: [segments], dropLast: true to skip the final recovery }
const seg = (l, min, k) => ({ l, s: Math.round(min * 60), k });
const open = (l, k) => ({ l, s: 0, k });
const warmWalk = (min = 5) => seg('Brisk walk warm-up', min, 'warm');
const coolWalk = (min = 3) => seg('Walk cool-down', min, 'cool');
const runWalk = (x, run, walk, dropLast = false) => ({
  x, dropLast,
  items: [seg('Run easy', run, 'run'), seg('Walk', walk, 'walk')],
});

// ---- settings ---------------------------------------------------------------
export const settings = {
  name: 'Josh',
  heightCm: 175,
  startDate: '2026-11-02',
  endDate: '2027-01-03',
  goalDate: '2026-12-24',
  startWeight: 88,
  goalWeight: 82,
  hrCapLow: 145,
  hrCapHigh: 150,
  easyPace: '7:30 - 8:15/km',
  tempoPace: '6:20 - 6:40/km',
  longTermGoal: 'Run a half marathon without stopping at an average pace under 6:00/km',
  targets: { kcal: 2000, proteinLow: 170, proteinHigh: 180, waterL: 3, fibreG: 30, stepsLow: 8000, stepsHigh: 10000 },
  trainingDays: [1, 2, 3, 5, 0], // Mon, Tue, Wed, Fri, Sun (0 = Sunday)
  dumbbellPairs: [10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40],
  dumbbellSingles: [1, 2, 3],
  theme: 'auto',
  // Guided strength sessions (seconds). Rounds are fitted to sessionMinutes.
  timing: { sessionMinutes: 45, work: 45, sideWork: 35, switchSec: 5, transition: 15, roundRest: 75, warmup: 240, cooldown: 180 },
  timerSound: true,
  timerVoice: true,
  timerVoiceName: '', // blank = pick the most natural voice automatically
  timerVolume: 0.5,
  timerVibrate: true,
};

// ---- equipment --------------------------------------------------------------
export const equipment = [
  'Concept2 RowErg',
  'Concept2 BikeErg',
  'Hex dumbbell pairs: 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40 kg',
  'Single light dumbbells: 1, 2, 3 kg',
  'Adjustable bench (flat and incline)',
  'Power rack with pull-up bar',
  'Olympic barbell and bumper plates (5, 10, 20 kg)',
  'Resistance bands (light and medium)',
  'Foam roller and mat',
  'Lifting straps',
];

// ---- exercises ----------------------------------------------------------------
// unit: reps | each (reps each side) | sec | secEach | m
// load: true if you log a weight for it
export const exercises = [
  // Strength A
  { id: 'gobletSquat', name: 'Goblet squat', min: 12, max: 15, unit: 'reps', load: true,
    cue: 'Elbows inside knees, chest tall, sit down between your heels.',
    swaps: ['Dumbbell box squat to bench', 'Heels-elevated goblet squat'] },
  { id: 'dbRdl', name: 'Dumbbell Romanian deadlift', min: 10, max: 12, unit: 'reps', load: true,
    cue: 'Soft knees, push hips back, dumbbells skim your thighs, flat back.',
    swaps: ['Barbell Romanian deadlift (light)', 'Single-leg dumbbell RDL'] },
  { id: 'reverseLunge', name: 'Reverse lunge', min: 10, max: 10, unit: 'each', load: true,
    cue: 'Long step back, front knee over mid-foot, drive through the front heel.',
    swaps: ['Split squat', 'Step-up onto bench'] },
  { id: 'gluteBridge', name: 'Glute bridge', min: 15, max: 15, unit: 'reps', load: true,
    cue: 'Ribs down, squeeze glutes hard at the top, pause 1 sec.',
    fromWeek: 4, laterName: 'Single-leg glute bridge', laterUnit: 'each',
    swaps: ['Hip thrust off bench (dumbbell on hips)', 'Banded glute bridge'] },
  { id: 'slCalfRaise', name: 'Single-leg calf raise', min: 15, max: 15, unit: 'each', load: true,
    cue: 'Full range off a step, 2 sec up, 2 sec down. Calf care - never rush these.',
    swaps: ['Double-leg calf raise with dumbbells', 'Bent-knee calf raise (soleus)'] },
  { id: 'deadBug', name: 'Dead bug', min: 10, max: 10, unit: 'each', load: false,
    cue: 'Lower back pressed into the floor, breathe out as the arm and leg extend.',
    swaps: ['Hollow hold (20 - 30 sec)', 'Banded dead bug'] },
  { id: 'sidePlank', name: 'Side plank', min: 30, max: 30, unit: 'secEach', load: false,
    cue: 'Straight line from head to heels, push the floor away, hips high.',
    swaps: ['Side plank from knees', 'Suitcase carry'] },
  // Strength B
  { id: 'pushPress', name: 'Push-up or dumbbell bench press', min: 10, max: 15, unit: 'reps', load: true,
    cue: 'Elbows about 45 degrees from your body, full range, control the lowering.',
    swaps: ['Incline dumbbell press', 'Feet-elevated push-up'] },
  { id: 'dbRow', name: 'One-arm dumbbell row', min: 12, max: 12, unit: 'each', load: true,
    cue: 'Hand and knee on bench, pull elbow to hip, no twisting.',
    swaps: ['Chest-supported row on incline bench', 'Inverted row under rack bar'] },
  { id: 'shoulderPress', name: 'Light dumbbell shoulder press', min: 10, max: 12, unit: 'reps', load: true,
    cue: 'Seated or standing, ribs down, press up and slightly back, no arching.',
    swaps: ['Half-kneeling single-arm press', 'Landmine press (barbell in rack corner)'] },
  { id: 'facePull', name: 'Band pull-apart or face pull', min: 15, max: 20, unit: 'reps', load: false,
    cue: 'Squeeze shoulder blades together, thumbs back, slow return.',
    swaps: ['Band face pull anchored to rack', 'Prone Y-T raise (1 - 3 kg dumbbells)'] },
  { id: 'farmerCarry', name: 'Farmer carry', min: 40, max: 40, unit: 'sec', load: true,
    cue: 'Tall posture, shoulders down and back, short quick steps. 40 m or 40 sec.',
    swaps: ['Suitcase carry (one side)', 'Farmer hold (40 sec, standing)'] },
  { id: 'birdDog', name: 'Bird dog', min: 10, max: 10, unit: 'each', load: false,
    cue: 'Reach long, hips level, pause 2 sec at full extension.',
    swaps: ['Banded bird dog', 'Quadruped hip extension'] },
  { id: 'pallof', name: 'Pallof press or plank shoulder taps', min: 10, max: 10, unit: 'each', load: false,
    cue: 'Band anchored to rack at chest height, press out and resist the twist.',
    swaps: ['Plank shoulder taps', 'Half-kneeling band chop'] },
];

// ---- strength sessions ------------------------------------------------------
export const strength = {
  strengthA: {
    title: 'Strength A', subtitle: 'Lower body and core plus erg bike finisher', minutes: 40,
    warmup: '3 - 5 min: 2 min easy BikeErg, 10 bodyweight squats, 5 world\'s greatest stretch each side, 10 glute bridges.',
    exercises: ['gobletSquat', 'dbRdl', 'reverseLunge', 'gluteBridge', 'slCalfRaise', 'deadBug', 'sidePlank'],
    format: 'Circuit. Effort 6 - 7 out of 10 (2 - 4 reps left in the tank). Rest 60 - 90 sec between rounds.',
  },
  strengthB: {
    title: 'Strength B', subtitle: 'Upper body and posterior chain plus rower finisher', minutes: 40,
    warmup: '3 - 5 min: 2 min easy row, 10 band pull-aparts, 10 band dislocates, 5 inchworms.',
    exercises: ['pushPress', 'dbRow', 'shoulderPress', 'facePull', 'farmerCarry', 'birdDog', 'pallof'],
    format: 'Circuit. Effort 6 - 7 out of 10 (2 - 4 reps left in the tank). Rest 60 - 90 sec between rounds.',
  },
};

// ---- finishers --------------------------------------------------------------
const bikeFinisher = (x) => ({
  label: `BikeErg ${x} x 30 sec hard / 30 sec easy`,
  segments: [{ x, dropLast: false, items: [seg('Hard', 0.5, 'hard'), seg('Easy spin', 0.5, 'easy')] }],
});
const rowMinutes = (x) => ({
  label: `RowErg ${x} x 1 min hard / 1 min easy`,
  segments: [{ x, dropLast: false, items: [seg('Row hard', 1, 'hard'), seg('Row easy', 1, 'easy')] }],
});
const row250 = (x) => ({
  label: `RowErg ${x} x 250 m hard with 1 min rest`,
  segments: [{ x, dropLast: true, items: [open('Row 250 m hard - tap Next when done', 'hard'), seg('Rest', 1, 'rest')] }],
});

// ---- runs ---------------------------------------------------------------------
const tueRuns = [
  { title: '6 x (3 min run / 1 min walk)', kind: 'runwalk', minutes: 32,
    segments: [warmWalk(), runWalk(6, 3, 1), coolWalk()] },
  { title: '5 x (4 min run / 1 min walk)', kind: 'runwalk', minutes: 33,
    segments: [warmWalk(), runWalk(5, 4, 1), coolWalk()] },
  { title: '4 x (6 min run / 1 min walk)', kind: 'runwalk', minutes: 36,
    segments: [warmWalk(), runWalk(4, 6, 1), coolWalk()] },
  { title: '25 min continuous easy', kind: 'easy', minutes: 31,
    segments: [warmWalk(3), seg('Easy run - under HR cap', 25, 'run'), coolWalk()] },
  { title: '30 min easy plus 4 x 20 sec strides', kind: 'easy', minutes: 38,
    segments: [warmWalk(2), seg('Easy run - under HR cap', 30, 'run'),
      { x: 4, dropLast: false, items: [seg('Stride - fast and relaxed', 20 / 60, 'stride'), seg('Walk back', 40 / 60, 'walk')] },
      coolWalk(2)] },
  { title: '10 min easy, 3 x 5 min tempo with 3 min jog, 5 min easy', kind: 'tempo', minutes: 36,
    segments: [seg('Easy run warm-up', 10, 'run'),
      { x: 3, dropLast: true, items: [seg('Tempo - comfortably hard', 5, 'tempo'), seg('Jog recovery', 3, 'jog')] },
      seg('Easy run cool-down', 5, 'run')] },
  { title: '10 min easy, 4 x 5 min tempo with 2 min jog, 5 min easy', kind: 'tempo', minutes: 41,
    segments: [seg('Easy run warm-up', 10, 'run'),
      { x: 4, dropLast: true, items: [seg('Tempo - comfortably hard', 5, 'tempo'), seg('Jog recovery', 2, 'jog')] },
      seg('Easy run cool-down', 5, 'run')] },
  { title: '30 min easy - Christmas week', kind: 'easy', minutes: 34,
    segments: [warmWalk(2), seg('Easy run - under HR cap', 30, 'run'), coolWalk(2)] },
  { title: '30 min easy plus 4 x 20 sec strides', kind: 'easy', minutes: 38,
    segments: [warmWalk(2), seg('Easy run - under HR cap', 30, 'run'),
      { x: 4, dropLast: false, items: [seg('Stride - fast and relaxed', 20 / 60, 'stride'), seg('Walk back', 40 / 60, 'walk')] },
      coolWalk(2)] },
];

const sunRuns = [
  { title: '30 min of 4 min run / 1 min walk', kind: 'runwalk', minutes: 30,
    segments: [runWalk(6, 4, 1)] },
  { title: '35 min of 5 min run / 1 min walk', kind: 'runwalk', minutes: 35,
    segments: [runWalk(6, 5, 1, true)] },
  { title: '40 min of 8 min run / 1 min walk', kind: 'runwalk', minutes: 40,
    segments: [runWalk(4, 8, 1), seg('Run easy', 4, 'run')] },
  { title: '5 km continuous easy', kind: 'long', km: 5, minutes: 40,
    segments: [warmWalk(2), open('Easy run to 5 km - tap Next when done', 'run'), coolWalk(2)] },
  { title: '6.5 km easy', kind: 'long', km: 6.5, minutes: 52,
    segments: [warmWalk(2), open('Easy run to 6.5 km - tap Next when done', 'run'), coolWalk(2)] },
  { title: '8 km easy', kind: 'long', km: 8, minutes: 62,
    segments: [warmWalk(2), open('Easy run to 8 km - tap Next when done', 'run'), coolWalk(2)] },
  { title: '10 km easy - the one you owe your brother-in-law', kind: 'long', km: 10, minutes: 78,
    segments: [warmWalk(2), open('Easy run to 10 km - tap Next when done', 'run'), coolWalk(2)] },
  { title: '6 - 8 km easy, relaxed Christmas week run', kind: 'long', km: 7, minutes: 55,
    segments: [warmWalk(2), open('Easy run 6 - 8 km - tap Next when done', 'run'), coolWalk(2)] },
  { title: '8 km easy - first run of the new year', kind: 'long', km: 8, minutes: 62,
    segments: [warmWalk(2), open('Easy run to 8 km - tap Next when done', 'run'), coolWalk(2)] },
];

// ---- weeks --------------------------------------------------------------------
const phaseFor = (n) => (n <= 3 ? 'Rebuild' : n <= 6 ? 'Build' : n === 7 ? 'Push' : n === 8 ? 'Christmas' : 'New Year');
const weekNotes = {
  1: 'Week 1. Easy does it. Walking to stay under the HR cap is fine. Expect a bigger drop on the scales from water.',
  4: 'Phase 2 starts. 4 rounds if time allows, single-leg glute bridge, longer finishers.',
  7: 'Push week. Longer tempo work, and Sunday is the 10 km you owe your brother-in-law.',
  8: 'Christmas week. Reduced volume. Goal weigh-in Thursday 24 December.',
  9: 'New Year week. Relaxed volume - keep the habits going into 2027.',
};
export const weeks = Array.from({ length: 9 }, (_, i) => {
  const n = i + 1;
  const start = new Date(2026, 10, 2 + i * 7);
  const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const phase = phaseFor(n);
  const rounds = n <= 3 ? 3 : n <= 7 ? 4 : n === 8 ? 2 : 3;
  const finA = n <= 3 ? bikeFinisher(8) : n <= 6 ? bikeFinisher(10) : n === 7 ? bikeFinisher(12) : n === 8 ? bikeFinisher(8) : bikeFinisher(10);
  const finB = n <= 3 ? rowMinutes(5) : n <= 6 ? row250(6) : n === 7 ? row250(8) : n === 8 ? rowMinutes(5) : row250(6);
  return { n, start: iso, phase, rounds, notes: weekNotes[n] || '', tue: tueRuns[i], sun: sunRuns[i], finA, finB };
});

export const phases = [
  { name: 'Rebuild', weeks: '1 - 3', dates: '2 Nov - 22 Nov' },
  { name: 'Build', weeks: '4 - 6', dates: '23 Nov - 13 Dec' },
  { name: 'Push', weeks: '7', dates: '14 Dec - 20 Dec' },
  { name: 'Christmas', weeks: '8', dates: '21 Dec - 27 Dec' },
  { name: 'New Year', weeks: '9', dates: '28 Dec - 3 Jan' },
];

// One-off sessions outside the weekly template (e.g. a trial before week 1).
export const extraSessions = [
  { date: '2026-10-30', key: 'strengthB', week: 1, rounds: 2, note: 'Trial run before the program starts. Go light, learn the timer and the movements, and keep the legs fresh for Saturday.' },
];

// Day of week (0 = Sunday) to session key.
export const template = { 1: 'strengthA', 2: 'tueRun', 3: 'strengthB', 4: 'cricketTraining', 5: 'floating', 6: 'cricketGame', 0: 'sunRun' };

export const floating = {
  title: 'Floating day',
  subtitle: 'Make-up session if one was missed this week, otherwise optional easy cardio and a longer mobility flow',
  options: '20 - 25 min easy BikeErg or RowErg (conversational, HR under 140), then the 15 min mobility flow. Day before a game - keep it light.',
};

export const tueMobility = ['calfWall', 'hipFlexor', 'hip9090'];

// Exercise name -> photo set in img/ex (start and end photos, -0.jpg and -1.jpg).
// Photos from Free Exercise DB (github.com/yuhonas/free-exercise-db), public domain.
export const exerciseImages = {
  'Goblet squat': 'Goblet_Squat', 'Dumbbell box squat to bench': 'Dumbbell_Squat_To_A_Bench', 'Heels-elevated goblet squat': 'Goblet_Squat',
  'Dumbbell Romanian deadlift': 'Stiff-Legged_Dumbbell_Deadlift', 'Barbell Romanian deadlift (light)': 'Romanian_Deadlift', 'Single-leg dumbbell RDL': 'Kettlebell_One-Legged_Deadlift',
  'Reverse lunge': 'Dumbbell_Rear_Lunge', 'Split squat': 'Split_Squat_with_Dumbbells', 'Step-up onto bench': 'Dumbbell_Step_Ups',
  'Glute bridge': 'Butt_Lift_Bridge', 'Single-leg glute bridge': 'Single_Leg_Glute_Bridge', 'Hip thrust off bench (dumbbell on hips)': 'Barbell_Hip_Thrust', 'Banded glute bridge': 'Butt_Lift_Bridge',
  'Single-leg calf raise': 'Calf_Raise_On_A_Dumbbell', 'Double-leg calf raise with dumbbells': 'Standing_Dumbbell_Calf_Raise', 'Bent-knee calf raise (soleus)': 'Dumbbell_Seated_One-Leg_Calf_Raise',
  'Dead bug': 'Dead_Bug', 'Banded dead bug': 'Dead_Bug',
  'Side plank': 'Side_Bridge', 'Side plank from knees': 'Side_Bridge', 'Suitcase carry': 'Farmers_Walk',
  'Push-up or dumbbell bench press': 'Pushups', 'Dumbbell bench press': 'Dumbbell_Bench_Press', 'Incline dumbbell press': 'Incline_Dumbbell_Press', 'Feet-elevated push-up': 'Push-Ups_With_Feet_Elevated',
  'One-arm dumbbell row': 'One-Arm_Dumbbell_Row', 'Chest-supported row on incline bench': 'Dumbbell_Incline_Row', 'Inverted row under rack bar': 'Inverted_Row',
  'Light dumbbell shoulder press': 'Dumbbell_Shoulder_Press', 'Half-kneeling single-arm press': 'Dumbbell_One-Arm_Shoulder_Press',
  'Band pull-apart or face pull': 'Band_Pull_Apart', 'Band face pull anchored to rack': 'Face_Pull', 'Prone Y-T raise (1 - 3 kg dumbbells)': 'Lying_Rear_Delt_Raise',
  'Farmer carry': 'Farmers_Walk', 'Suitcase carry (one side)': 'Farmers_Walk', 'Farmer hold (40 sec, standing)': 'Farmers_Walk',
  'Pallof press or plank shoulder taps': 'Pallof_Press', 'Plank shoulder taps': 'Plank', 'Half-kneeling band chop': 'Standing_Cable_Wood_Chop',
  'Calf stretch against wall': 'Calf_Stretch_Hands_Against_Wall', 'Kneeling hip flexor stretch': 'Kneeling_Hip_Flexor', 'Hamstring stretch': 'Lying_Hamstring',
  'Cat-cow': 'Cat_Stretch', 'Doorway chest stretch': 'Dynamic_Chest_Stretch', "Child's pose": 'Childs_Pose',
};

// ---- mobility ---------------------------------------------------------------------
// sides: 2 = do each side, 1 = once
export const mobility = [
  { id: 'calfWall', name: 'Calf stretch against wall', cue: 'Straight knee first, then bent knee. Heel stays down. Calf care.', hold: 40, sides: 2 },
  { id: 'hipFlexor', name: 'Kneeling hip flexor stretch', cue: 'Tuck the pelvis under, squeeze the back glute, shift forward gently.', hold: 40, sides: 2 },
  { id: 'hip9090', name: '90/90 hip switch', cue: 'Sit tall, rotate both knees side to side slowly, pause in each 90/90.', hold: 45, sides: 1 },
  { id: 'hamstring', name: 'Hamstring stretch', cue: 'Lying with a band round the foot, leg straight, back flat on the floor.', hold: 40, sides: 2 },
  { id: 'couch', name: 'Couch stretch', cue: 'Back knee against the wall or couch, squeeze the glute, ribs down.', hold: 40, sides: 2 },
  { id: 'catCow', name: 'Cat-cow', cue: 'Move one segment at a time, slow breath in and out.', hold: 45, sides: 1 },
  { id: 'openBook', name: 'Open book thoracic rotation', cue: 'Side-lying, knees bent, follow the top hand with your eyes.', hold: 40, sides: 2 },
  { id: 'threadNeedle', name: 'Thread the needle', cue: 'On all fours, reach under and rotate, then reach up to the ceiling.', hold: 40, sides: 2 },
  { id: 'doorwayChest', name: 'Doorway chest stretch', cue: 'Elbow at shoulder height on the frame, step through gently.', hold: 40, sides: 2 },
  { id: 'dislocates', name: 'Band shoulder dislocates', cue: 'Wide grip, straight arms, slow over the head and back. 10 - 15 reps.', hold: 45, sides: 1 },
  { id: 'childsPose', name: 'Child\'s pose', cue: 'Hips to heels, reach long, breathe into your back.', hold: 60, sides: 1 },
];

// ---- nutrition ---------------------------------------------------------------------
export const nutrition = {
  summary: 'Flexible framework, not a fixed meal plan. Protein first at every meal. About 2,000 kcal, 170 - 180 g protein, 3 L water, 30 g+ fibre, 8,000 - 10,000 steps.',
  dayShape: [
    { meal: 'Morning routine', detail: 'Coffee with a dash of milk, protein shake (1 scoop in water), banana', kcal: 250, protein: 27 },
    { meal: 'Breakfast', detail: 'Pick one from the swap list', kcal: 400, protein: 35 },
    { meal: 'Lunch', detail: 'Pick one from the swap list', kcal: 500, protein: 45 },
    { meal: 'Snack', detail: 'Pick one from the swap list', kcal: 200, protein: 22 },
    { meal: 'Dinner', detail: 'Half veg, quarter protein (bigger palm), quarter carbs', kcal: 600, protein: 50 },
  ],
  portions: [
    'Palm of protein (two palms at lunch and dinner)',
    'Fist of carbs (add half a fist on run days)',
    'Two fists of veg at lunch and dinner',
    'Thumb of fats',
  ],
  breakfast: [
    { name: 'Greek yoghurt bowl', detail: '200 g low-fat Greek yoghurt, half scoop whey, 1/3 cup rolled oats, 1/2 cup frozen blueberries, sprinkle of granola', kcal: 400, protein: 40 },
    { name: 'Eggs on sourdough', detail: '1 slice sourdough, 2 whole eggs, 2 egg whites, 1/4 avocado, 30 g shaved ham', kcal: 420, protein: 36 },
    { name: 'Protein smoothie', detail: '1 scoop whey, 1/2 cup blueberries, 1 cup unsweetened almond milk, 1/3 cup oats, 1 tsp peanut butter', kcal: 360, protein: 32 },
    { name: 'Overnight oats (Sunday prep)', detail: '1/2 cup oats, 1 scoop whey, 150 g Greek yoghurt, 1/2 cup berries, splash of milk. Make 3 jars on Sunday.', kcal: 420, protein: 42 },
    { name: 'Egg muffins x 3 (Sunday prep)', detail: 'Baked eggs and egg whites with spinach, capsicum and 20 g feta, plus 1 slice wholegrain toast', kcal: 380, protein: 34 },
    { name: 'Breakfast wrap', detail: 'Low-carb wrap, 2 eggs and 2 whites scrambled, 30 g shaved ham, spinach, salsa', kcal: 360, protein: 36 },
    { name: 'Cottage cheese bowl', detail: '200 g low-fat cottage cheese, 1 cup mixed berries, 2 tbsp granola, drizzle of honey', kcal: 360, protein: 30 },
    { name: 'Weet-Bix and yoghurt', detail: '3 Weet-Bix, 250 ml skim milk, 150 g Greek yoghurt on top, berries', kcal: 390, protein: 30 },
  ],
  lunch: [
    { name: 'Beef mince rice bowl', detail: '180 g 5-star lean beef mince, 3/4 cup cooked jasmine rice, 1.5 cups mixed veg or salad, low-sugar sauce or seasoning', kcal: 500, protein: 44 },
    { name: 'Chicken or turkey rice bowl', detail: '200 g chicken or turkey breast (raw weight), 3/4 cup cooked rice, 1.5 cups veg or salad, low-sugar sauce', kcal: 470, protein: 50 },
    { name: 'Chicken burrito bowl', detail: '150 g chicken, 1/2 cup rice, 1/2 cup black beans, salsa, lettuce, 2 tbsp Greek yoghurt', kcal: 520, protein: 48 },
    { name: 'Beef and bean chilli (batch cook)', detail: '180 g lean mince cooked with kidney beans, tomato and spices, 1/2 cup rice', kcal: 530, protein: 46 },
    { name: 'Turkey meatballs and veg', detail: '180 g lean turkey mince meatballs, passata, roast veg, 1/2 cup rice or pasta', kcal: 480, protein: 45 },
    { name: 'Tuna and bean salad', detail: '185 g tin tuna in springwater, 1/2 tin four-bean mix, leaves, tomato, cucumber, 1 tsp olive oil and lemon, 1 slice sourdough', kcal: 450, protein: 45 },
    { name: 'Chicken salad wraps', detail: '2 low-carb wraps, 150 g cooked chicken, lettuce, tomato, 2 tbsp light tzatziki', kcal: 430, protein: 48 },
    { name: 'Protein box', detail: '2 boiled eggs, 100 g chicken, 1 cup roast pumpkin, 2 tbsp hummus, veg sticks', kcal: 470, protein: 45 },
  ],
  snacks: [
    { name: 'Yoghurt and berries', detail: '150 g low-fat Greek yoghurt, half scoop whey, 1/2 cup frozen blueberries (tastes like ice cream)', kcal: 200, protein: 28 },
    { name: 'Protein shake and fruit', detail: '1 scoop whey in water, apple or pear', kcal: 200, protein: 25 },
    { name: 'Cottage cheese and veg', detail: '150 g low-fat cottage cheese, cherry tomatoes, cucumber, cracked pepper', kcal: 150, protein: 18 },
    { name: 'High-protein yoghurt pot', detail: 'One 160 g high-protein yoghurt (e.g. YoPro)', kcal: 120, protein: 15 },
    { name: 'Tuna rice cakes', detail: '95 g tin tuna on 2 rice cakes with tomato', kcal: 180, protein: 20 },
    { name: 'Jerky and fruit', detail: '40 g beef jerky plus a piece of fruit', kcal: 200, protein: 20 },
    { name: 'Boiled eggs', detail: '2 boiled eggs and a piece of fruit (prep a batch on Sunday)', kcal: 230, protein: 13 },
    { name: 'Edamame', detail: '1 cup shelled edamame with salt flakes', kcal: 190, protein: 17 },
  ],
  dinner: {
    guidance: [
      'Plate split: half veg, a quarter protein (a bigger palm, about 150 - 200 g), a quarter carbs.',
      'Run days (Tuesday and Sunday): a bit more carbs, about an extra half fist.',
      'Aim for about 600 kcal and 45 - 50 g protein.',
      'Cook with minimal oil, go easy on sauces (low-sugar options like Mingle), add cottage cheese or Greek yoghurt for creaminess.',
    ],
    ideas: [
      'Chicken, steak or salmon with greens and baked sweet potato',
      'Chicken stir-fry with lots of veg and a small serve of rice',
      'San choy bow with lean pork or chicken mince',
      'Salmon tray bake with potatoes, broccolini and lemon',
      'Lean beef tacos on low-carb wraps with salad and salsa',
      'Chicken souvlaki plate with Greek salad and tzatziki',
      'Spag bol with half pasta, half zucchini noodles',
    ],
  },
  earlySessions: [
    'Easy sessions under 45 min: coffee or a banana is enough beforehand.',
    'Optional pre-session fuel: banana, 1 tsp honey, espresso.',
    'Protein shake straight after the session, then breakfast as normal.',
    'Drink 500 ml water with electrolytes when you get up.',
  ],
  cricketGame: [
    'Breakfast 2 - 3 hours before: overnight oats or eggs on sourdough plus fruit.',
    'Pack: chicken or turkey wraps, 2 bananas, oranges or watermelon, jerky, a high-protein yoghurt (in the cooler), 2 boiled eggs, rice cakes with peanut butter, 1 protein bar.',
    'Water: 2 - 3 L across the day with 1 - 2 electrolyte tabs, more if it is hot.',
    'Tea break: have the sandwiches, skip the second round of slices and biscuits.',
    'After the game: protein shake straight away, then a normal dinner. Don\'t skip it because you grazed all day.',
  ],
  cricketTraining: [
    'Post-session snack: protein shake and a banana, or a high-protein yoghurt.',
    'If dinner is late, have the shake on the way home.',
  ],
  christmas: [
    'Protein first at every event. Fill up on meat, prawns and salad before the sweets.',
    'One plate, no going back for seconds. Pick the 1 - 2 treats you actually want.',
    'Water in hand all day. Being alcohol-free is already a huge win.',
    'Move every day: a walk or easy run on Christmas morning and Boxing Day.',
    'No write-off days. The next meal is back on plan.',
    'Goal weigh-in is Thursday 24 December, first thing in the morning.',
  ],
  tips: [
    'Black coffee with a dash of milk saves hundreds of calories a day.',
    'Low-fat cottage cheese is high protein, low calorie. Add it to any meal.',
    'Most sauces are packed with sugar. Use low-sugar brands or seasoning.',
    'Hungry between meals? Big glass of water, wait 5 min. Still hungry? Have a piece of fruit.',
    'Coffee is a good appetite suppressant before 1pm.',
    'Low-carb wraps for tacos and pizza nights.',
    '7 - 8 hours sleep if possible. It drives recovery and appetite control.',
  ],
};

// ---- run history from Strava (Jan - Oct 2026) -----------------------------------------
// [stravaId, date, km, movingSec, kind, name]
const history = [
  ['17019267265', '2026-01-12', 3.95, 1802, 'easy', 'Afternoon Run'],
  ['17038062048', '2026-01-14', 3.92, 2392, 'easy', 'Morning Run'],
  ['17055438390', '2026-01-15', 6.16, 2989, 'easy', 'Afternoon Run'],
  ['17086017052', '2026-01-18', 9.03, 3602, 'long', 'Morning Run'],
  ['17177098925', '2026-01-26', 5.48, 2714, 'easy', 'Morning Run'],
  ['17213556943', '2026-01-29', 7.04, 2978, 'easy', 'Afternoon Run'],
  ['17245669494', '2026-02-01', 6.02, 2298, 'easy', 'Afternoon Run'],
  ['17256841641', '2026-02-02', 5.00, 1913, 'easy', 'Afternoon Run'],
  ['17274909347', '2026-02-04', 0.90, 415, 'easy', 'Morning Run'],
  ['17275307790', '2026-02-04', 5.01, 1803, 'tempo', 'Morning Run'],
  ['17324338748', '2026-02-08', 7.04, 2778, 'easy', 'Afternoon Run'],
  ['17347328835', '2026-02-10', 4.09, 2102, 'easy', 'Zone 2 run'],
  ['17380826560', '2026-02-13', 7.01, 2755, 'easy', 'Afternoon Run'],
  ['17412665427', '2026-02-16', 4.59, 1814, 'easy', 'Afternoon Run'],
  ['17424131129', '2026-02-17', 4.18, 1803, 'easy', 'Afternoon Run'],
  ['17447304398', '2026-02-19', 6.16, 2419, 'tempo', '4 x 1 km at 8/10 effort'],
  ['17479401722', '2026-02-22', 4.25, 1801, 'easy', 'Afternoon Run'],
  ['17514149428', '2026-02-25', 4.13, 1802, 'easy', 'Afternoon Run'],
  ['17546645861', '2026-02-28', 10.01, 3816, 'long', 'Morning Run'],
  ['17596719563', '2026-03-04', 3.47, 1480, 'easy', 'Afternoon Run'],
  ['17609144519', '2026-03-05', 7.37, 2884, 'easy', 'Afternoon Run'],
  ['17643557381', '2026-03-08', 10.05, 3615, 'long', 'Afternoon Run'],
  ['17668990098', '2026-03-10', 9.13, 3630, 'easy', 'Afternoon Run'],
  ['17691638585', '2026-03-12', 6.06, 2320, 'easy', 'Morning Run'],
  ['17749969188', '2026-03-17', 6.55, 2696, 'easy', 'Afternoon Run'],
  ['17775241382', '2026-03-19', 8.00, 3017, 'tempo', '5 x 6 min at 5:40/km'],
  ['17808686223', '2026-03-22', 16.59, 6601, 'long', 'Morning Run'],
  ['17832001974', '2026-03-24', 6.10, 2568, 'easy', 'Morning Run'],
  ['17873229538', '2026-03-27', 9.04, 3387, 'easy', 'Afternoon Run'],
  ['17967633667', '2026-04-04', 4.35, 1803, 'easy', 'Calf test run'],
  ['17981018789', '2026-04-05', 10.67, 4135, 'long', 'Morning Run'],
  ['18022845874', '2026-04-08', 4.79, 1943, 'easy', 'Afternoon Run'],
  ['18072625545', '2026-04-12', 5.86, 2309, 'easy', 'Morning Run'],
  ['18165236521', '2026-04-19', 21.40, 9470, 'race', 'Newy Half Marathon'],
  ['18432375802', '2026-05-09', 3.01, 1287, 'easy', 'Lunch Run'],
  ['18512885468', '2026-05-15', 2.55, 1149, 'easy', 'Afternoon Run'],
  ['18737849379', '2026-06-01', 4.09, 1803, 'easy', 'Afternoon Run'],
  ['19705807954', '2026-08-12', 3.36, 1501, 'easy', 'Afternoon Run'],
  ['19787382840', '2026-08-18', 3.17, 1797, 'runwalk', '6 x 3 min run / 2 min walk, HR cap 145 - 147'],
  ['19831660716', '2026-08-21', 3.32, 1817, 'runwalk', 'Lunch Run'],
  ['19873385176', '2026-08-24', 3.54, 1590, 'runwalk', '8 x 3 min run / 1 min walk, HR cap 145 - 147'],
  ['19887594996', '2026-08-25', 4.01, 2301, 'runwalk', 'Afternoon Run'],
  ['19998539212', '2026-09-02', 3.87, 1847, 'easy', 'Morning Run'],
  ['20291941735', '2026-09-23', 2.31, 1209, 'easy', 'Afternoon Run'],
  ['20454183186', '2026-10-05', 3.32, 1616, 'easy', 'Morning Run'],
];

export const historyActivities = history.map(([id, date, km, sec, kind, name]) => ({
  id: 'strava-' + id,
  date,
  type: 'run',
  title: name,
  runKind: kind,
  distanceKm: km,
  durationSec: sec,
  avgHr: null,
  felt: null,
  notes: '',
  planId: null,
  source: 'strava',
  externalId: id,
  created: date + 'T00:00:00',
}));

export function buildInitialState() {
  return {
    schema: 1,
    seedVersion: SEED_VERSION,
    settings: structuredClone(settings),
    program: structuredClone({ equipment, exercises, strength, weeks, phases, template, floating, tueMobility, mobility, exerciseImages, extraSessions }),
    nutrition: structuredClone(nutrition),
    activities: structuredClone(historyActivities),
    days: {},     // 'YYYY-MM-DD' -> { weight, mobility, n: { shake, protein, water, veg, steps }, kcal, proteinG }
    moves: {},    // planId -> new date
    skips: {},    // planId -> true
    checkins: {}, // week number -> { notes }
    meta: { created: new Date().toISOString(), lastBackup: null },
  };
}
