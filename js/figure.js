// Animated exercise figures: a jointed figure posed for each exercise and looped smoothly, drawn as SVG in the app's colours.
// A pose gives the hip position, torso angle and where the hands and feet go; elbows and knees are solved (two-bone IK).
// Angles are degrees in screen space: 0 points the way the figure faces (right), 90 points down, -90 up. The floor is y = 170.

const L = { torso: 48, neck: 7, head: 10.5, ua: 28, fa: 27, th: 40, sh: 38, ft: 13 };
const G = 170;
const R = Math.PI / 180;
const at = (p, a, l) => [p[0] + l * Math.cos(a * R), p[1] + l * Math.sin(a * R)];
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const f1 = (n) => Math.round(n * 10) / 10;

// Joint between root and target for two bones of length l1, l2, bending to side s (+1 or -1).
function ik(root, target, l1, l2, s) {
  const dx = target[0] - root[0], dy = target[1] - root[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx);
  const a1 = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  return [[root[0] + l1 * Math.cos(base + s * a1), root[1] + l1 * Math.sin(base + s * a1)], [root[0] + d * Math.cos(base), root[1] + d * Math.sin(base)]];
}

// ---- poses --------------------------------------------------------------------------------------
const P = (base, over) => ({ ...base, ...over });
const STAND = { h: [100, 88], t: -90, aN: [103, 165], aF: [97, 165], wN: [104, 94], wF: [98, 94] };
const DBS = [{ k: 'db', at: 'wN' }, { k: 'db', at: 'wF', far: true }];
const PLANK = { h: [89, 129.5], t: -21.3, aN: [16, 158], aF: [12, 159], fN: 75, fF: 75, wN: [134, 166], wF: [130, 166] };
const PUSH_DOWN = P(PLANK, { h: [92.8, 150.6], t: -5.5 });
const QUAD = { h: [80, 120], t: 0, aN: [44, 164], aF: [40, 164], fN: 180, fF: 180, wN: [128, 166], wF: [124, 166] };
const SUPINE = { h: [100, 156], t: 180, aN: [140, 165], aF: [136, 165], wN: [104, 166], wF: [100, 166] };
const LUNGE = { h: [86, 124], t: -86, aN: [118, 165], aF: [44, 158], fF: 40, wN: [90, 130], wF: [86, 130] };
const HALF_KNEEL = { h: [92, 120], t: -90, aN: [124, 165], aF: [58, 164], fF: 180, wN: [96, 126], wF: [92, 126] };
const FRONT = { h: [100, 88], t: -90, aN: [110, 165], aF: [90, 165], fN: 10, fF: 170, wN: [118, 94], wF: [82, 94] };

// Walking and running in place, as functions of the cycle (u from 0 to 1).
function gait(u, run) {
  const sw = run ? 40 : 22, lean = run ? -80 : -88;
  const legAt = (ps) => {
    const thigh = 90 - sw * Math.sin(ps);
    const flex = run ? 15 + 85 * Math.max(0, Math.cos(ps + 0.6)) ** 1.5 : 4 + 38 * Math.max(0, Math.cos(ps + 0.8)) ** 1.5;
    return { thigh, shin: thigh + flex };
  };
  const ph = u * 2 * Math.PI;
  const hip = [100, 0];
  const legs = [ph, ph + Math.PI].map((ps) => {
    const l = legAt(ps);
    const knee = at(hip, l.thigh, L.th), ankle = at(knee, l.shin, L.sh);
    return { ankle, foot: l.shin - 90 + (run ? 5 : 0) };
  });
  // Keep the lowest foot on the floor.
  const low = Math.max(...legs.map((l) => Math.max(l.ankle[1], at(l.ankle, l.foot, L.ft)[1])));
  const dy = 165 - low;
  hip[1] += dy;
  legs.forEach((l) => { l.ankle[1] += dy; });
  const sh = at(hip, lean, L.torso);
  const armAt = (ps) => {
    const up = 90 + (run ? 42 : 24) * Math.sin(ps);
    const elbow = at(sh, up, L.ua);
    return at(elbow, up - (run ? 80 : 18), L.fa);
  };
  return { h: hip, t: lean, hd: run ? -4 : 0, aN: legs[0].ankle, aF: legs[1].ankle, fN: legs[0].foot, fF: legs[1].foot, wN: armAt(ph + Math.PI), wF: armAt(ph) };
}
// Carries: walking with the arms hanging still.
function carry(u) {
  const g = gait(u, false);
  const sh = at(g.h, g.t, L.torso);
  return { ...g, wN: [sh[0] + 3, sh[1] + 54], wF: [sh[0] - 1, sh[1] + 54] };
}
// Stationary bike: pedals turn around the crank.
function bike(u) {
  const ph = u * 2 * Math.PI, c = [118, 140], r = 14;
  return { h: [92, 92], t: -58, hd: -10, aN: at(c, ph * 180 / Math.PI, r), aF: at(c, ph * 180 / Math.PI + 180, r), fN: 10, fF: 10, wN: [148, 72], wF: [144, 73] };
}
// Rower: legs, then body, then arms on the drive, reversed on the recovery.
function row(u) {
  const s = 0.5 - 0.5 * Math.cos(u * 2 * Math.PI);
  const legs = ease(clamp01(s / 0.6)), body = ease(clamp01((s - 0.3) / 0.5)), arms = ease(clamp01((s - 0.6) / 0.4));
  const h = [lerp(104, 64, legs), 146];
  const t = lerp(-58, -106, body);
  const sh = at(h, t, L.torso);
  const reach = at(sh, 30, 52);
  const w = [lerp(reach[0], sh[0] + 14, arms), lerp(reach[1], sh[1] + 24, arms)];
  return { h, t, aN: [150, 146], aF: [146, 146], fN: -55, fF: -55, wN: w, wF: [w[0] - 3, w[1]] };
}

// Each motion: k (keyframes, played there and back unless loop) or fn(u); dur seconds per cycle; view 'front' for face-on moves;
// kb*/eb* knee and elbow bend sides; props drawn around the figure.
export const MOTIONS = {
  squat: { k: [P(STAND, { aN: [106, 165], aF: [100, 165], t: -88, wN: [112, 62], wF: [110, 63] }), { h: [80, 126], t: -60, aN: [106, 165], aF: [100, 165], wN: [118, 100], wF: [116, 101] }], props: [{ k: 'db', at: 'wN' }] },
  bwsquat: { k: [P(STAND, { aN: [106, 165], aF: [100, 165], t: -88 }), { h: [80, 126], t: -60, aN: [106, 165], aF: [100, 165], wN: [152, 86], wF: [150, 88] }] },
  boxsquat: { k: [P(STAND, { aN: [106, 165], aF: [100, 165], t: -88, wN: [112, 62], wF: [110, 63] }), { h: [78, 127], t: -62, aN: [106, 165], aF: [100, 165], wN: [117, 100], wF: [115, 101] }], props: [{ k: 'box', x: 40, y: 137, w: 40, back: true }, { k: 'db', at: 'wN' }] },
  rdl: { k: [STAND, { h: [84, 92], t: -12, aN: [103, 165], aF: [97, 165], wN: [132, 136], wF: [128, 136] }], props: DBS },
  bbrdl: { k: [STAND, { h: [84, 92], t: -12, aN: [103, 165], aF: [97, 165], wN: [132, 136], wF: [128, 136] }], props: [{ k: 'plate', at: 'wN' }] },
  slrdl: { k: [STAND, { h: [84, 92], t: -12, aN: [103, 165], aF: [10, 108], fF: 90, wN: [132, 136], wF: [118, 124] }], props: [{ k: 'db', at: 'wN' }] },
  lunge: { k: [P(STAND, { wN: [103, 95], wF: [99, 95] }), LUNGE], props: DBS },
  splitsquat: { k: [{ h: [84, 96], t: -88, aN: [118, 165], aF: [44, 158], fF: 40, wN: [88, 102], wF: [84, 102] }, LUNGE], props: DBS },
  stepup: { k: [{ h: [92, 98], t: -84, aN: [130, 121], aF: [88, 165], wN: [98, 104], wF: [94, 104] }, { h: [122, 46], t: -88, aN: [130, 121], aF: [112, 104], fF: 60, wN: [126, 100], wF: [122, 100] }], props: [{ k: 'box', x: 112, y: 128, w: 54, back: true }] },
  bridge: { k: [P(SUPINE, {}), P(SUPINE, { h: [96, 128], t: 150, hd: 20 })], ebN: -1, ebF: -1 },
  slbridge: { k: [P(SUPINE, { aF: [170, 120], fF: -40 }), P(SUPINE, { h: [96, 128], t: 150, hd: 20, aF: [166, 96], fF: -40 })], ebN: -1, ebF: -1 },
  hipthrust: { k: [{ h: [92, 152], t: -150, aN: [138, 165], aF: [134, 165], wN: [94, 140], wF: [90, 140] }, { h: [100, 122], t: 180, aN: [138, 165], aF: [134, 165], wN: [100, 110], wF: [96, 110] }], props: [{ k: 'bench', x: 14, y: 132, w: 44, back: true }, { k: 'db', at: 'h', dy: -13 }] },
  calf: { k: [P(STAND, { fN: 0, fF: 0 }), P(STAND, { h: [100, 79], aN: [103, 156], aF: [97, 156], fN: 45, fF: 45, wN: [104, 85], wF: [98, 85] })], dur: 2.2 },
  slcalf: { k: [P(STAND, { aF: [84, 140], fF: 60, wN: [140, 60] }), P(STAND, { h: [100, 79], aN: [103, 156], fN: 45, aF: [84, 131], fF: 60, wN: [140, 52] })], props: [{ k: 'wall', x: 150, back: true }], dur: 2.2 },
  dbcalf: { k: [P(STAND, { fN: 0, fF: 0 }), P(STAND, { h: [100, 79], aN: [103, 156], aF: [97, 156], fN: 45, fF: 45, wN: [104, 85], wF: [98, 85] })], props: DBS, dur: 2.2 },
  seatcalf: { k: [{ h: [70, 116], t: -88, aN: [112, 165], aF: [108, 165], wN: [106, 118], wF: [102, 118] }, { h: [70, 116], t: -88, aN: [112, 156], aF: [108, 156], fN: 45, fF: 45, wN: [106, 110], wF: [102, 110] }], props: [{ k: 'bench', x: 38, y: 126, w: 56, back: true }, { k: 'db', at: 'kN', dy: -9 }], dur: 2.2 },
  deadbug: { k: [P(SUPINE, { wN: [56, 100], wF: [52, 100], aN: [138, 118], aF: [134, 118] }), P(SUPINE, { wN: [0, 160], wF: [52, 100], aN: [138, 118], aF: [176, 150] })], dur: 3.2 },
  hollow: { k: [P(SUPINE, { h: [100, 154], t: 190, c: -5, wN: [-2, 140], wF: [-4, 142], aN: [176, 140], aF: [174, 142], fN: -10, fF: -10 }), P(SUPINE, { h: [100, 154], t: 194, c: -7, wN: [-2, 133], wF: [-4, 135], aN: [176, 133], aF: [174, 135], fN: -10, fF: -10 })], dur: 3.6, hold: 0.3 },
  sideplank: { view: 'front', k: [{ h: [72, 150], t: -24, aN: [0, 166], aF: [-6, 152], fN: 0, fF: 0, wN: [150, 165], wF: [118, 64] }, { h: [76, 130], t: -12, aN: [6, 166], aF: [5, 152], fN: 0, fF: 0, wN: [150, 165], wF: [126, 50] }], ebN: 1, ebF: 1, dur: 3.4, hold: 0.3 },
  taps: { k: [PLANK, P(PLANK, { wN: [124, 124] })], dur: 1.8 },
  birddog: { k: [QUAD, P(QUAD, { wN: [182, 108], aF: [4, 112], hd: -10 })], dur: 3 },
  hipext: { k: [QUAD, P(QUAD, { aF: [4, 112] })], dur: 2.6 },
  pallof: { k: [{ h: [100, 92], t: -90, aN: [114, 165], aF: [86, 165], wN: [114, 72], wF: [112, 73] }, { h: [100, 92], t: -90, aN: [114, 165], aF: [86, 165], wN: [153, 70], wF: [151, 71] }], props: [{ k: 'post', x: 206, back: true }, { k: 'band', a: 'wN', b: [204, 70] }] },
  chop: { k: [P(HALF_KNEEL, { wN: [62, 34], wF: [64, 36] }), P(HALF_KNEEL, { wN: [146, 118], wF: [144, 120] })], props: [{ k: 'post', x: 8, back: true }, { k: 'band', a: 'wN', b: [10, 18] }] },
  pushup: { k: [PLANK, PUSH_DOWN], dur: 2.4 },
  declinepush: { k: [{ h: [82, 113], t: -5.9, aN: [4, 121], aF: [0, 122], fN: 70, fF: 70, wN: [130, 166], wF: [126, 166] }, { h: [80.8, 136.5], t: 11.4, aN: [4, 121], aF: [0, 122], fN: 70, fF: 70, wN: [130, 166], wF: [126, 166] }], props: [{ k: 'bench', x: -16, y: 128, w: 40, back: true }], dur: 2.4 },
  bench: { k: [{ h: [112, 116], t: 180, aN: [150, 165], aF: [146, 165], wN: [66, 62], wF: [62, 62] }, { h: [112, 116], t: 180, aN: [150, 165], aF: [146, 165], wN: [72, 100], wF: [68, 100] }], props: [{ k: 'bench', x: 34, y: 127, w: 98, back: true }, ...DBS] },
  incline: { k: [{ h: [100, 116], t: -135, aN: [140, 165], aF: [136, 165], wN: [70, 28], wF: [66, 28] }, { h: [100, 116], t: -135, aN: [140, 165], aF: [136, 165], wN: [78, 70], wF: [74, 70] }], props: [{ k: 'incline', back: true }, ...DBS] },
  row: { k: [{ h: [66, 100], t: -6, aN: [92, 165], aF: [30, 116], fF: 180, wN: [114, 148], wF: [118, 118] }, { h: [66, 100], t: -6, aN: [92, 165], aF: [30, 116], fF: 180, wN: [94, 112], wF: [118, 118] }], props: [{ k: 'bench', x: 20, y: 123, w: 112, back: true }, { k: 'db', at: 'wN' }] },
  csrow: { k: [{ h: [80, 112], t: -32, aN: [52, 165], aF: [48, 165], wN: [124, 142], wF: [120, 142] }, { h: [80, 112], t: -32, aN: [52, 165], aF: [48, 165], wN: [100, 108], wF: [96, 108] }], props: [{ k: 'incpad', back: true }, ...DBS] },
  invrow: { k: [{ h: [98, 151.3], t: -6.3, aN: [20, 160], aF: [16, 160], fN: -70, fF: -70, wN: [150, 94], wF: [146, 94] }, { h: [90.6, 126.6], t: -25.3, aN: [20, 160], aF: [16, 160], fN: -70, fF: -70, wN: [150, 94], wF: [146, 94] }], props: [{ k: 'rack', x: 150, y: 92, back: true }] },
  press: { view: 'front', k: [P(FRONT, { wN: [124, 30], wF: [76, 30] }), P(FRONT, { wN: [118, -12], wF: [82, -12] })], props: DBS },
  hkpress: { k: [P(HALF_KNEEL, { wN: [104, 62], wF: [96, 116] }), P(HALF_KNEEL, { wN: [98, 18], wF: [96, 116] })], props: [{ k: 'db', at: 'wN' }] },
  landmine: { k: [{ h: [94, 90], t: -82, aN: [112, 165], aF: [74, 165], wN: [116, 66], wF: [114, 68] }, { h: [96, 90], t: -78, aN: [112, 165], aF: [74, 165], wN: [152, 34], wF: [150, 36] }], props: [{ k: 'landmine', from: [-14, 168] }] },
  pullapart: { view: 'front', k: [P(FRONT, { wN: [106, 50], wF: [94, 50] }), P(FRONT, { wN: [168, 44], wF: [32, 44] })], props: [{ k: 'band', a: 'wN', b: 'wF' }] },
  facepull: { k: [P(STAND, { wN: [152, 44], wF: [150, 45] }), P(STAND, { wN: [112, 26], wF: [110, 27] })], ebN: -1, ebF: -1, props: [{ k: 'post', x: 208, back: true }, { k: 'band', a: 'wN', b: [206, 38] }] },
  ytraise: { k: [{ h: [88, 160], t: 0, aN: [10, 164], aF: [6, 165], fN: 180, fF: 180, wN: [190, 166], wF: [186, 166] }, { h: [88, 160], t: -3, hd: -12, aN: [10, 164], aF: [6, 165], fN: 180, fF: 180, wN: [188, 140], wF: [184, 141] }], props: DBS },
  farmer: { fn: carry, dur: 1.4, props: DBS },
  suitcase: { fn: carry, dur: 1.4, props: [{ k: 'db', at: 'wN' }] },
  farmerhold: { k: [STAND, P(STAND, { h: [100, 87], t: -91 })], props: DBS, dur: 3, hold: 0.3 },
  // Mobility
  calfstretch: { k: [{ h: [92, 100], t: -76, aN: [40, 165], aF: [124, 165], wN: [160, 48], wF: [158, 50] }, { h: [98, 104], t: -70, aN: [40, 165], aF: [124, 165], wN: [160, 50], wF: [158, 52] }], props: [{ k: 'wall', x: 164, back: true }], dur: 4, hold: 0.3 },
  hipflexor: { k: [P(HALF_KNEEL, { wN: [94, 114], wF: [90, 114] }), P(HALF_KNEEL, { h: [102, 124], t: -94, aF: [58, 164], wN: [104, 118], wF: [100, 118] })], dur: 4, hold: 0.3 },
  ninety: { view: 'front', k: [{ h: [100, 146], t: -90, aN: [140, 165], aF: [62, 165], kN: [158, 150], kF: [112, 132], fN: 10, fF: 10, wN: [138, 162], wF: [62, 162] }, { h: [100, 146], t: -90, aN: [140, 165], aF: [62, 165], kN: [88, 132], kF: [42, 150], fN: 170, fF: 170, wN: [138, 162], wF: [62, 162] }], dur: 3.4 },
  hamstring: { k: [P(SUPINE, { aN: [146, 92], fN: -60, aF: [176, 164], fF: -80, wN: [92, 118], wF: [88, 118] }), P(SUPINE, { aN: [124, 80], fN: -75, aF: [176, 164], fF: -80, wN: [86, 112], wF: [82, 112] })], props: [{ k: 'band', a: 'wN', b: 'toeN' }], dur: 4, hold: 0.3 },
  couch: { k: [{ h: [80, 124], t: -82, aN: [126, 165], aF: [30, 120], fF: 270, wN: [116, 122], wF: [112, 122] }, { h: [86, 124], t: -96, aN: [126, 165], aF: [30, 120], fF: 270, wN: [118, 120], wF: [114, 120] }], props: [{ k: 'bench', x: -20, y: 128, w: 44, back: true }], dur: 4, hold: 0.3 },
  catcow: { k: [P(QUAD, { c: -14, hd: 30 }), P(QUAD, { c: 12, hd: -28 })], dur: 3.6, hold: 0.25 },
  thread: { k: [P(QUAD, { wN: [132, 64], hd: -40 }), P(QUAD, { t: 10, wN: [78, 160], hd: 40 })], dur: 3.6, hold: 0.25 },
  doorway: { k: [{ h: [100, 88], t: -90, aN: [124, 165], aF: [88, 165], wN: [80, 14], wF: [112, 94] }, { h: [108, 88], t: -80, aN: [124, 165], aF: [88, 165], wN: [80, 14], wF: [120, 94] }], ebN: -1, props: [{ k: 'door', x: 70, back: true }], dur: 4, hold: 0.3 },
  child: { k: [{ h: [70, 146], t: 6, c: -10, hd: 10, aN: [72, 164], aF: [68, 164], fN: 180, fF: 180, wN: [170, 164], wF: [166, 165] }, { h: [68, 144], t: 2, c: -12, hd: 12, aN: [72, 164], aF: [68, 164], fN: 180, fF: 180, wN: [172, 164], wF: [168, 165] }], dur: 4, hold: 0.3 },
  openbook: { k: [{ h: [70, 150], t: 0, hd: 0, aN: [104, 164], aF: [100, 166], fN: 180, fF: 180, wN: [172, 152], wF: [170, 156] }, { h: [70, 150], t: 0, hd: -30, aN: [104, 164], aF: [100, 166], fN: 180, fF: 180, wN: [120, 96], wF: [170, 156] }, { h: [70, 150], t: 0, hd: -60, aN: [104, 164], aF: [100, 166], fN: 180, fF: 180, wN: [66, 150], wF: [170, 156] }], kbN: -1, dur: 4.4 },
  dislocates: { view: 'front', k: [P(FRONT, { wN: [150, 100], wF: [50, 100] }), P(FRONT, { wN: [156, 4], wF: [44, 4] })], props: [{ k: 'band', a: 'wN', b: 'wF' }], dur: 3 },
  wgs: { k: [{ h: [86, 124], t: -30, aN: [128, 165], aF: [30, 160], fF: 40, wN: [124, 150], wF: [124, 166] }, { h: [86, 124], t: -42, hd: -50, aN: [128, 165], aF: [30, 160], fF: 40, wN: [132, 40], wF: [124, 166] }], dur: 3.6, hold: 0.25 },
  legswing: { k: [P(STAND, { aN: [152, 128], fN: -20, wN: [146, 60] }), P(STAND, { aN: [46, 140], fN: 40, wN: [146, 60] })], props: [{ k: 'wall', x: 152, back: true }], dur: 1.6, hold: 0.05 },
  inchworm: { k: [{ h: [40, 88], t: -90, aN: [43, 165], aF: [39, 165], wN: [44, 94], wF: [40, 94] }, { h: [36, 92], t: 75, hd: 10, aN: [43, 165], aF: [39, 165], wN: [62, 166], wF: [58, 166] }, { h: [111.8, 129.5], t: -21.6, aN: [40, 158], aF: [36, 159], fN: 75, fF: 75, wN: [156, 166], wF: [152, 166] }], dur: 5 },
  // Cardio and runs
  run: { fn: (u) => gait(u, true), dur: 0.8 },
  walk: { fn: (u) => gait(u, false), dur: 1.3 },
  bike: { fn: bike, dur: 1.1, props: [{ k: 'bike', back: true }, { k: 'crank' }] },
  rower: { fn: row, dur: 2.8, props: [{ k: 'rower', back: true }, { k: 'chain' }] },
};

// Exercise name -> motion.
export const FIG = {
  'Goblet squat': 'squat', 'Dumbbell box squat to bench': 'boxsquat', 'Heels-elevated goblet squat': 'squat',
  'Dumbbell Romanian deadlift': 'rdl', 'Barbell Romanian deadlift (light)': 'bbrdl', 'Single-leg dumbbell RDL': 'slrdl',
  'Reverse lunge': 'lunge', 'Split squat': 'splitsquat', 'Step-up onto bench': 'stepup',
  'Glute bridge': 'bridge', 'Single-leg glute bridge': 'slbridge', 'Hip thrust off bench (dumbbell on hips)': 'hipthrust', 'Banded glute bridge': 'bridge',
  'Single-leg calf raise': 'slcalf', 'Double-leg calf raise with dumbbells': 'dbcalf', 'Bent-knee calf raise (soleus)': 'seatcalf',
  'Dead bug': 'deadbug', 'Banded dead bug': 'deadbug', 'Hollow hold (20 - 30 sec)': 'hollow',
  'Side plank': 'sideplank', 'Side plank from knees': 'sideplank', 'Suitcase carry': 'suitcase', 'Suitcase carry (one side)': 'suitcase',
  'Push-up or dumbbell bench press': 'pushup', 'Dumbbell bench press': 'bench', 'Incline dumbbell press': 'incline', 'Feet-elevated push-up': 'declinepush',
  'One-arm dumbbell row': 'row', 'Chest-supported row on incline bench': 'csrow', 'Inverted row under rack bar': 'invrow',
  'Light dumbbell shoulder press': 'press', 'Half-kneeling single-arm press': 'hkpress', 'Landmine press (barbell in rack corner)': 'landmine',
  'Band pull-apart or face pull': 'pullapart', 'Band face pull anchored to rack': 'facepull', 'Prone Y-T raise (1 - 3 kg dumbbells)': 'ytraise',
  'Farmer carry': 'farmer', 'Farmer hold (40 sec, standing)': 'farmerhold',
  'Bird dog': 'birddog', 'Banded bird dog': 'birddog', 'Quadruped hip extension': 'hipext',
  'Pallof press or plank shoulder taps': 'pallof', 'Plank shoulder taps': 'taps', 'Half-kneeling band chop': 'chop',
  'Calf stretch against wall': 'calfstretch', 'Kneeling hip flexor stretch': 'hipflexor', '90/90 hip switch': 'ninety', 'Hamstring stretch': 'hamstring',
  'Couch stretch': 'couch', 'Cat-cow': 'catcow', 'Thread the needle': 'thread', 'Doorway chest stretch': 'doorway', "Child's pose": 'child',
  'Open book thoracic rotation': 'openbook', 'Open book': 'openbook', 'Band shoulder dislocates': 'dislocates', 'Band dislocates': 'dislocates',
  'Easy BikeErg': 'bike', 'Bodyweight squats': 'bwsquat', "World's greatest stretch": 'wgs', 'Glute bridges': 'bridge', 'Calf raises': 'calf',
  'Leg swings': 'legswing', 'Easy row': 'rower', 'Band pull-aparts': 'pullapart', 'Inchworms': 'inchworm', 'Easy push-ups': 'pushup',
  _run: 'run', _walk: 'walk', _bike: 'bike', _row: 'rower',
};

// ---- solving and drawing ---------------------------------------------------------------------------------
function mix(a, b, u) {
  const o = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] ?? b[k], y = b[k] ?? a[k];
    o[k] = Array.isArray(x) ? [lerp(x[0], y[0], u), lerp(x[1], y[1], u)] : typeof x === 'number' ? lerp(x, y, u) : x;
  }
  return o;
}
function poseAt(m, u) {
  if (m.fn) return m.fn(u);
  const k = m.k;
  if (k.length === 1) return k[0];
  const seq = m.loop ? [...k, k[0]] : [...k, ...k.slice(0, -1).reverse()];
  const n = seq.length - 1;
  const x = u * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
  const hold = m.hold ?? 0.18;
  return mix(seq[i], seq[i + 1], ease(clamp01((f - hold) / (1 - hold))));
}

function solve(p, m) {
  const front = m.view === 'front';
  const t = p.t ?? -90, hip = p.h;
  const sh = at(hip, t, L.torso);
  const perp = t + 90;
  const so = front ? 15 : 0, ho = front ? 9 : 0;
  const neck = at(sh, t, L.neck);
  const ft = front ? 7 : L.ft;
  const leg = (hp, a, k, fa, s) => {
    const [kn, an] = k ? [k, a] : ik(hp, a, L.th, L.sh, s);
    return { hp, k: kn, a: an, toe: at(an, fa, ft), heel: at(an, fa, front ? 0 : -3) };
  };
  const arm = (s0, w, e, s) => {
    const [el, wr] = e ? [e, w] : ik(s0, w, L.ua, L.fa, s);
    return { s: s0, e: el, w: wr };
  };
  const aF = p.aF || [p.aN[0] - 5, p.aN[1]], wF = p.wF || [p.wN[0] - 4, p.wN[1]];
  const S = {
    front, t, hip, sh, neck, head: at(neck, t + (p.hd || 0), L.head), c: p.c || 0,
    shN: at(sh, perp, so), shF: at(sh, perp, -so), hpN: at(hip, perp, ho), hpF: at(hip, perp, -ho),
  };
  S.legN = leg(S.hpN, p.aN, p.kN, p.fN ?? (front ? 10 : 0), m.kbN ?? -1);
  S.legF = leg(S.hpF, aF, p.kF, p.fF ?? (front ? 170 : 0), m.kbF ?? (front ? 1 : -1));
  S.armN = arm(S.shN, p.wN, p.eN, m.ebN ?? 1);
  S.armF = arm(S.shF, wF, p.eF, m.ebF ?? (front ? -1 : 1));
  return S;
}

function pt(S, q) {
  if (Array.isArray(q)) return q;
  return { wN: S.armN.w, wF: S.armF.w, eN: S.armN.e, aN: S.legN.a, aF: S.legF.a, kN: S.legN.k, kF: S.legF.k, toeN: S.legN.toe, h: S.hip, sh: S.sh }[q];
}

const C = { far: '#1d6a76', kit: '#475569', kitDark: '#334155', plate: '#cbd5e1', plateIn: '#64748b', band: '#a78bfa', wall: '#1b2740' };
const line = (a, b, w, c) => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${c}" stroke-width="${w}"/>`;
const dot = (p, r, c) => `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${r}" fill="${c}"/>`;
const rect = (x, y, w, h, c, rx = 3) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${rx}" fill="${c}"/>`;

// Props: draw(S, q) returns markup, box(S, q) the points it covers (for framing).
const PROPS = {
  db: { draw: (S, q) => { const p = pt(S, q.at); const c = [p[0] + (q.dx || 0), p[1] + (q.dy || 0)]; return dot(c, 7.5, q.far ? '#94a3b8' : C.plate) + dot(c, 3, C.plateIn); }, box: (S, q) => { const p = pt(S, q.at); return [[p[0] - 8, p[1] - 8 + (q.dy || 0)], [p[0] + 8, p[1] + 8 + (q.dy || 0)]]; } },
  plate: { draw: (S, q) => { const p = pt(S, q.at); return dot(p, 15, '#94a3b8') + dot(p, 10, C.plate) + dot(p, 3.5, C.plateIn); }, box: (S, q) => { const p = pt(S, q.at); return [[p[0] - 15, p[1] - 15], [p[0] + 15, p[1] + 15]]; } },
  bench: { draw: (S, q) => rect(q.x, q.y, q.w, 8, C.kit, 4) + line([q.x + 8, q.y + 8], [q.x + 8, G], 4, C.kitDark) + line([q.x + q.w - 8, q.y + 8], [q.x + q.w - 8, G], 4, C.kitDark), box: (S, q) => [[q.x, q.y], [q.x + q.w, G]] },
  box: { draw: (S, q) => rect(q.x, q.y, q.w, G - q.y, C.kitDark, 5) + rect(q.x, q.y, q.w, 6, C.kit, 3), box: (S, q) => [[q.x, q.y], [q.x + q.w, G]] },
  wall: { draw: (S, q) => rect(q.x, 0, 14, G, C.wall, 2), box: (S, q) => [[q.x, 20], [q.x + 14, G]] },
  door: { draw: (S, q) => rect(q.x, 0, 9, G, C.kit, 2), box: (S, q) => [[q.x, 0], [q.x + 9, G]] },
  post: { draw: (S, q) => rect(q.x - 4, 0, 8, G, C.kitDark, 2), box: (S, q) => [[q.x - 4, 20], [q.x + 4, G]] },
  band: { draw: (S, q) => line(pt(S, q.a), pt(S, q.b), 3, C.band), box: (S, q) => [pt(S, q.a), pt(S, q.b)] },
  rack: { draw: (S, q) => rect(q.x + 10, 10, 8, G - 10, C.kitDark, 2) + line([q.x + 14, q.y], [q.x - 6, q.y], 5, '#94a3b8') + dot([q.x, q.y], 4, C.plate), box: (S, q) => [[q.x - 6, q.y - 20], [q.x + 18, G]] },
  incline: { draw: () => rect(84, 120, 40, 8, C.kit, 4) + line([92, 128], [92, G], 4, C.kitDark) + line([118, 128], [118, G], 4, C.kitDark) + line([92, 122], [54, 84], 9, C.kit), box: () => [[50, 80], [124, G]] },
  incpad: { draw: () => line([86, 132], [132, 92], 10, C.kit) + line([100, 128], [100, G], 4, C.kitDark) + line([112, 112], [112, G], 4, C.kitDark), box: () => [[84, 88], [134, G]] },
  landmine: { draw: (S, q) => { const w = S.armN.w; const a = Math.atan2(w[1] - q.from[1], w[0] - q.from[0]) * 180 / Math.PI; return line(q.from, at(w, a, 8), 5, '#94a3b8'); }, box: (S, q) => [q.from, S.armN.w] },
  bike: { draw: () => line([60, 168], [176, 168], 6, C.kitDark) + line([90, 100], [118, 140], 6, C.kit) + line([118, 140], [158, 140], 6, C.kit) + line([150, 140], [146, 70], 6, C.kit) + line([140, 70], [154, 70], 6, '#94a3b8') + dot([158, 140], 18, C.kitDark) + rect(80, 94, 22, 7, '#94a3b8', 3.5) + line([88, 168], [104, 120], 5, C.kitDark) + line([150, 168], [156, 150], 5, C.kitDark), box: () => [[60, 64], [178, G]] },
  crank: { draw: (S) => line(S.legN.a, S.legF.a, 3, '#94a3b8') + dot([118, 140], 4, C.plate), box: () => [] },
  rower: { draw: () => rect(30, 156, 160, 7, C.kitDark, 3.5) + dot([182, 140], 20, C.kitDark) + line([146, 152], [156, 136], 6, C.kit), box: () => [[30, 118], [204, G]] },
  chain: { draw: (S) => line(S.armN.w, [176, 138], 2, '#94a3b8') + rect(S.hip[0] - 12, 151, 24, 6, '#94a3b8', 3), box: () => [] },
};

// A tapered limb segment: radius r1 at a, r2 at b, round ends.
function capsule(a, b, r1, r2, c) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 0.001;
  const nx = -dy / d, ny = dx / d;
  const p = (q, r, s) => `${f1(q[0] + nx * r * s)},${f1(q[1] + ny * r * s)}`;
  return `<path d="M${p(a, r1, 1)} L${p(b, r2, 1)} A${r2} ${r2} 0 0 0 ${p(b, r2, -1)} L${p(a, r1, -1)} A${r1} ${r1} 0 0 0 ${p(a, r1, 1)} Z" fill="${c}"/>`;
}

function drawFigure(S, m, gid) {
  const N = `url(#${gid})`, F = S.front ? N : C.far;
  const legSvg = (l, c) => capsule(l.hp, l.k, 7.6, 5.4, c) + capsule(l.k, l.a, 5.4, 3.6, c) + capsule(l.heel, l.toe, 3.6, 2.6, c);
  const armSvg = (a, c) => capsule(a.s, a.e, 5.4, 4, c) + capsule(a.e, a.w, 4, 3.2, c) + dot(a.w, 4, c);
  let torso;
  if (S.front) {
    // Shoulders broad, waist narrower, hips a touch wider.
    const waistN = at(S.hip, S.t, 20), wN = at(waistN, S.t + 90, 10), wF = at(waistN, S.t + 90, -10);
    const pts = [S.shN, at(S.shN, S.t + 180, 9), wN, S.hpN, S.hpF, wF, at(S.shF, S.t + 180, 9), S.shF].map((q) => `${f1(q[0])},${f1(q[1])}`).join(' ');
    torso = `<polygon points="${pts}" fill="${N}" stroke="${N}" stroke-width="8" stroke-linejoin="round"/>`;
  } else {
    // Side view: pelvis, waist and a deeper chest, following the spine curve (c).
    const mid = [(S.hip[0] + S.sh[0]) / 2, (S.hip[1] + S.sh[1]) / 2];
    const chest = at(at(mid, S.t, 8), S.t + 90, S.c * 1.6 + 2.5);
    const waist = at(at(mid, S.t, -10), S.t + 90, S.c * 1.2);
    torso = capsule(S.hip, waist, 10, 9, N) + capsule(waist, chest, 9, 12, N) + capsule(chest, S.sh, 12, 8.5, N);
  }
  const props = (back) => (m.props || []).filter((q) => !!q.back === back).map((q) => PROPS[q.k].draw(S, q)).join('');
  return props(true)
    + legSvg(S.legF, F) + armSvg(S.armF, F)
    + torso + capsule(S.sh, S.neck, 4.6, 4.2, N) + dot(S.head, L.head, N)
    + legSvg(S.legN, N) + armSvg(S.armN, N)
    + props(false);
}

// Framing: union of the figure over the whole cycle, cached per motion.
const frames = new Map();
function frameOf(id) {
  if (frames.has(id)) return frames.get(id);
  const m = MOTIONS[id];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (p, r = 0) => { x0 = Math.min(x0, p[0] - r); y0 = Math.min(y0, p[1] - r); x1 = Math.max(x1, p[0] + r); y1 = Math.max(y1, p[1] + r); };
  for (let i = 0; i < 24; i++) {
    const S = solve(poseAt(m, i / 24), m);
    add(S.head, L.head); add(S.hip, 10); add(S.sh, 10);
    for (const l of [S.legN, S.legF]) { add(l.k, 7); add(l.a, 6); add(l.toe, 4); }
    for (const a of [S.armN, S.armF]) { add(a.e, 5); add(a.w, 5); }
    for (const q of m.props || []) for (const p of PROPS[q.k].box(S, q)) add(p);
  }
  y1 = Math.max(y1, G + 6);
  const pad = 10, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
  // Square-ish frames so figures keep a similar size across thumbnails.
  const side = Math.max(w, h);
  const f = { x: x0 - pad - (side - w) / 2, y: y0 - pad - (side - h), w: side, h: side, cx: (x0 + x1) / 2, fw: x1 - x0 };
  frames.set(id, f);
  return f;
}

function frameSvg(id, u, gid) {
  const m = MOTIONS[id];
  const f = frameOf(id);
  const shadow = `<ellipse cx="${f1(f.cx)}" cy="${G + 2}" rx="${f1(Math.min(f.fw * 0.45, 80))}" ry="4" fill="rgba(94,234,212,.12)"/>`;
  return shadow + drawFigure(solve(poseAt(m, u), m), m, gid);
}

let uid = 0;
export const hasFig = (id) => !!MOTIONS[id];
// Markup for an animated figure. It animates once it is on screen (see the loop below).
export function figSvg(id, cls = '') {
  const m = MOTIONS[id];
  if (!m) return '';
  const f = frameOf(id);
  const gid = `fg${++uid}`;
  const off = Math.random().toFixed(3);
  return `<svg class="fig ${cls}" viewBox="${f1(f.x)} ${f1(f.y)} ${f1(f.w)} ${f1(f.h)}" preserveAspectRatio="xMidYMax meet" data-fig="${id}" data-g="${gid}" data-o="${off}" role="img" aria-label="Exercise demonstration">`
    + `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${f1(f.y)}" x2="0" y2="${f1(f.y + f.h)}"><stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs>`
    + `<g class="fg" stroke-linecap="round">${frameSvg(id, 0.5, gid)}</g></svg>`;
}

// One shared animation loop at ~30 fps, only for figures on screen.
const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let last = 0;
function tick(now) {
  requestAnimationFrame(tick);
  if (still || document.hidden || now - last < 33) return;
  last = now;
  const vh = innerHeight;
  for (const el of document.querySelectorAll('svg.fig')) {
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > vh) continue;
    const m = MOTIONS[el.dataset.fig];
    const u = ((now / 1000) / (m.dur || 2.8) + Number(el.dataset.o)) % 1;
    el.firstElementChild.nextElementSibling.innerHTML = frameSvg(el.dataset.fig, u, el.dataset.g);
  }
}
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tick);
