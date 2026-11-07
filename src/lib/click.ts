/** 조명 스위치 "찰칵" — 파일 없이 WebAudio 로 합성한다. 끌 때는 조금 낮은 소리 */
let ctx: AudioContext | null = null;

function burst(ac: AudioContext, at: number, ms: number, freq: number, gain: number) {
  const n = Math.floor((ac.sampleRate * ms) / 1000);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(at);
}

export function playSwitchClick(toDark: boolean) {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime + 0.01;
    const k = toDark ? 0.8 : 1;
    burst(ctx, t, 18, 2600 * k, 0.5); // 찰
    burst(ctx, t + 0.07, 34, 1500 * k, 0.7); // 칵
  } catch {
    /* 오디오 불가 환경 */
  }
}

/** 카테고리(섹션) 이동 "톡" — 찰칵보다 짧고 가벼운 한 번의 탭 */
export function playNavTick() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime + 0.005;
    burst(ctx, t, 14, 3400, 0.35);
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(1900, t);
    o.frequency.exponentialRampToValueAtTime(1200, t + 0.03);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.04);
  } catch {
    /* 오디오 불가 환경 */
  }
}
