/**
 * Keyframes and classes of every scene, rendered once by `ScenePlayer`.
 *
 * `.rifa-a` is the choreography: it plays once over the scene (`--rifa-T`), with keyframe
 * percentages as fractions of it, and `--rifa-t0` (a negative delay) jumps a late arrival into
 * the right moment. `.rifa-loop` is ambient motion (water, wheels, flags) that cycles meanwhile.
 */
export const SCENE_STYLES = `
.rifa-stage { position: relative; width: 100%; overflow: hidden; border-radius: 1rem; background: #1a0e2e; box-shadow: 0 0 0 1px rgb(251 248 255 / .08); }
.rifa-stage-compact { margin-inline: auto; max-width: min(100%, 66vh); border-radius: .75rem; box-shadow: none; }
.rifa-svg { display: block; width: 100%; height: auto; }
.rifa-svg text { font-family: var(--font-display, var(--font-bricolage, sans-serif)); font-weight: 800; }
.rifa-reduced { display: none; }

.rifa-a { transform-box: view-box; transform-origin: 0 0; animation-duration: var(--rifa-T, 7000ms); animation-iteration-count: 1; animation-fill-mode: both; animation-delay: var(--rifa-t0, 0ms); }
.rifa-loop { transform-box: view-box; transform-origin: 0 0; }
.rifa-flag { transform-box: fill-box; transform-origin: 50% 0; animation: rifa-flag 2.2s ease-in-out infinite backwards; }
.rifa-spark { transform-box: fill-box; transform-origin: center; }

@keyframes rifa-spin { to { transform: rotate(360deg); } }
@keyframes rifa-bob { 50% { transform: translateY(-8px); } }
@keyframes rifa-twinkle { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
@keyframes rifa-flag { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
@keyframes rifa-cap { 0%, 84% { transform: scale(0); opacity: 0; } 88% { transform: scale(1.15); opacity: 1; } 91%, 97% { transform: scale(1); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
@keyframes rifa-splash { 0% { transform: translate(0, 0) scale(1); opacity: 0; } 1% { opacity: 1; } 11%, 100% { transform: translate(var(--dx), var(--dy)) scale(.3); opacity: 0; } }
@keyframes rifa-ripple { 0% { transform: scale(.2); opacity: 0; } 2% { opacity: .9; } 22%, 100% { transform: scale(1.7); opacity: 0; } }
@keyframes rifa-rise { 0% { transform: translate(var(--x), 0); opacity: 0; } 2% { opacity: .9; } 16%, 100% { transform: translate(var(--x), -70px); opacity: 0; } }
@keyframes rifa-rain { to { stroke-dashoffset: -48; } }
@keyframes rifa-wave { to { transform: translateX(-200px); } }
@keyframes rifa-drip { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(60px); opacity: 0; } }
.rifa-cap { animation-name: rifa-cap; }
.rifa-splash { animation-name: rifa-splash; }
.rifa-ripple { animation-name: rifa-ripple; }
.rifa-rise { animation-name: rifa-rise; }

/* 1 · retrete */
@keyframes rifa-s1drop { 0% { transform: translateY(-300px); opacity: 0; animation-timing-function: cubic-bezier(.5, 0, 1, 1); } 3% { opacity: 1; } 13% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, .4, 1); } 16% { transform: translateY(-18px); animation-timing-function: cubic-bezier(.6, 0, 1, 1); } 19%, 100% { transform: translateY(0); opacity: 1; } }
@keyframes rifa-s1spin { 0%, 22% { transform: rotate(0deg); animation-timing-function: cubic-bezier(.45, 0, .9, .6); } 78%, 100% { transform: rotate(1440deg); } }
@keyframes rifa-s1drain { 0%, 22% { transform: translateX(64px) scale(1); opacity: 1; animation-timing-function: cubic-bezier(.3, 0, .8, .7); } 76% { transform: translateX(0) scale(.08); opacity: 1; } 79%, 100% { transform: translateX(0) scale(0); opacity: 0; } }
@keyframes rifa-s1handle { 0%, 17% { transform: rotate(0); } 20% { transform: rotate(-40deg); } 27%, 100% { transform: rotate(0); } }
@keyframes rifa-s1rush { 0%, 20% { opacity: 0; } 27%, 72% { opacity: 1; } 82%, 100% { opacity: 0; } }
.rifa-s1-drop { animation-name: rifa-s1drop; }
.rifa-s1-spin { animation-name: rifa-s1spin; }
.rifa-s1-drain { animation-name: rifa-s1drain; }
.rifa-s1-handle { animation-name: rifa-s1handle; }
.rifa-s1-rush { animation-name: rifa-s1rush; }

/* 2 · globazo */
@keyframes rifa-s2squash { 0%, 24% { transform: scale(1, 1); } 26% { transform: scale(1.1, .88); } 30% { transform: scale(.96, 1.05); } 34%, 48% { transform: scale(1, 1); } 50% { transform: scale(1.12, .86); } 54% { transform: scale(.97, 1.03); } 58%, 100% { transform: scale(1.03, .96); } }
@keyframes rifa-s2hat { 0%, 24% { transform: translateY(0) rotate(0); } 27% { transform: translateY(-40px) rotate(-8deg); } 32%, 48% { transform: translateY(0) rotate(0); } 51% { transform: translateY(-60px) rotate(10deg); } 57%, 100% { transform: translateY(0) rotate(5deg); } }
@keyframes rifa-s2wet { 0%, 24% { opacity: 0; } 26%, 48% { opacity: .3; } 50%, 100% { opacity: .55; } }
@keyframes rifa-s2left { 0%, 51% { transform: translate(0, 0) rotate(0); } 53% { transform: translate(-6px, 4px) rotate(-8deg); animation-timing-function: cubic-bezier(.5, 0, 1, 1); } 66%, 100% { transform: translate(-50px, 78px) rotate(-75deg); } }
@keyframes rifa-s2right { 0%, 52% { transform: translate(0, 0) rotate(0); } 54% { transform: translate(6px, 4px) rotate(8deg); animation-timing-function: cubic-bezier(.5, 0, 1, 1); } 68%, 100% { transform: translate(56px, 80px) rotate(70deg); } }
@keyframes rifa-s2bx { 0%, 10% { transform: translateX(0); } 24%, 100% { transform: translateX(225px); } }
@keyframes rifa-s2by { 0%, 10% { transform: translateY(0); animation-timing-function: cubic-bezier(.2, .6, .4, 1); } 17% { transform: translateY(-70px); animation-timing-function: cubic-bezier(.6, 0, .8, .4); } 24%, 100% { transform: translateY(58px); } }
@keyframes rifa-s2b { 0%, 9% { opacity: 0; transform: scale(1) rotate(0); } 10% { opacity: 1; } 23% { opacity: 1; transform: scale(1) rotate(260deg); } 24% { opacity: 1; transform: scale(1.5) rotate(270deg); } 26%, 100% { opacity: 0; transform: scale(1.8) rotate(270deg); } }
@keyframes rifa-s2drips { 0%, 26% { opacity: 0; } 30%, 100% { opacity: 1; } }
.rifa-s2-squash { animation-name: rifa-s2squash; }
.rifa-s2-hat { animation-name: rifa-s2hat; }
.rifa-s2-wet { animation-name: rifa-s2wet; }
.rifa-s2-left { animation-name: rifa-s2left; }
.rifa-s2-right { animation-name: rifa-s2right; }
.rifa-s2-bx { animation-name: rifa-s2bx; animation-timing-function: linear; }
.rifa-s2-by { animation-name: rifa-s2by; }
.rifa-s2-b { animation-name: rifa-s2b; }
.rifa-s2-drips { animation-name: rifa-s2drips; }

/* 3 · lagarto */
@keyframes rifa-s3duende { 0% { transform: translate(0, 0) rotate(0); opacity: 0; } 3% { opacity: 1; } 40% { transform: translate(0, 0) rotate(0); } 42% { transform: translate(-16px, 0) rotate(-6deg); } 45% { transform: translate(50px, -24px) rotate(20deg); animation-timing-function: cubic-bezier(.4, 0, .9, .6); } 54% { transform: translate(200px, 30px) rotate(70deg); } 62%, 100% { transform: translate(260px, 200px) rotate(95deg); opacity: 1; } }
@keyframes rifa-s3croc { 0% { transform: translate(0, 14px); } 12% { transform: translate(-6px, 9px); } 24% { transform: translate(0, 13px); } 32% { transform: translate(4px, 14px); } 37% { transform: translate(6px, 24px); animation-timing-function: cubic-bezier(.1, .9, .2, 1); } 40% { transform: translate(-44px, -10px); } 44% { transform: translate(-40px, -6px); animation-timing-function: cubic-bezier(.4, 0, .9, .6); } 56% { transform: translate(10px, 40px); } 64%, 100% { transform: translate(30px, 90px); } }
@keyframes rifa-s3jaw { 0%, 34% { transform: rotate(0); } 38% { transform: rotate(30deg); } 41%, 100% { transform: rotate(0); } }
@keyframes rifa-s3float { 0%, 60% { opacity: 0; transform: translateY(60px) rotate(0); } 66% { opacity: 1; transform: translateY(-14px) rotate(-6deg); } 74% { transform: translateY(5px) rotate(5deg); } 82% { transform: translateY(-3px) rotate(-3deg); } 90% { transform: translateY(3px) rotate(3deg); } 100% { opacity: 1; transform: translateY(0) rotate(0); } }
.rifa-s3-duende { animation-name: rifa-s3duende; }
.rifa-s3-croc { animation-name: rifa-s3croc; }
.rifa-s3-jaw { animation-name: rifa-s3jaw; }
.rifa-s3-float { animation-name: rifa-s3float; }

/* 4 · micro 72 */
@keyframes rifa-s4duende { 0%, 28% { transform: rotate(0) scale(1, 1); } 36% { transform: rotate(-3deg) scale(1.02, .96); } 44% { transform: rotate(-6deg) scale(1.05, .9); } 50% { transform: rotate(-14deg) scale(1.06, .86); animation-timing-function: cubic-bezier(.6, 0, 1, 1); } 53% { transform: rotate(-90deg) scale(1, 1); } 55% { transform: rotate(-83deg) scale(1, 1); } 57%, 100% { transform: rotate(-90deg) scale(1, 1); } }
@keyframes rifa-s4cloud { 0%, 14% { transform: translateX(300px); animation-timing-function: cubic-bezier(.2, 0, 0, 1); } 24%, 56% { transform: translateX(0); animation-timing-function: cubic-bezier(.4, 0, 1, 1); } 64%, 100% { transform: translateX(-380px); } }
@keyframes rifa-s4rainvis { 0%, 22% { opacity: 0; } 26%, 56% { opacity: 1; } 60%, 100% { opacity: 0; } }
@keyframes rifa-s4puddle { 0%, 26% { transform: scale(0, 0); } 56%, 100% { transform: scale(1, 1); } }
@keyframes rifa-s4bubble { 0%, 63% { transform: scale(0); opacity: 0; } 66% { transform: scale(1.1); opacity: 1; } 68%, 75% { transform: scale(1); opacity: 1; } 78%, 100% { transform: scale(.6); opacity: 0; } }
@keyframes rifa-s4bus { 0%, 58% { transform: translateX(-300px); animation-timing-function: cubic-bezier(.2, .6, .35, 1); } 68% { transform: translateX(-40px); animation-timing-function: linear; } 74% { transform: translateX(0px); animation-timing-function: cubic-bezier(.6, 0, .9, .5); } 84%, 100% { transform: translateX(560px); } }
.rifa-s4-duende { animation-name: rifa-s4duende; }
.rifa-s4-cloud { animation-name: rifa-s4cloud; }
.rifa-s4-rainvis { animation-name: rifa-s4rainvis; }
.rifa-s4-puddle { animation-name: rifa-s4puddle; }
.rifa-s4-bubble { animation-name: rifa-s4bubble; }
.rifa-s4-bus { animation-name: rifa-s4bus; }

/* winner */
@keyframes rifa-wspot { 0%, 8% { opacity: 0; } 30%, 100% { opacity: 1; } }
@keyframes rifa-wneon { 0%, 8% { opacity: 0; } 10% { opacity: 1; } 11% { opacity: .15; } 13% { opacity: 1; } 14% { opacity: .3; } 17%, 100% { opacity: 1; } }
@keyframes rifa-wcrown { 0%, 22% { transform: translateY(-150px) rotate(-12deg); opacity: 0; animation-timing-function: cubic-bezier(.5, 0, 1, 1); } 23% { opacity: 1; } 30% { transform: translateY(0) rotate(0); animation-timing-function: cubic-bezier(0, 0, .4, 1); } 33% { transform: translateY(-14px) rotate(3deg); animation-timing-function: cubic-bezier(.6, 0, 1, 1); } 36%, 100% { transform: translateY(0) rotate(0); opacity: 1; } }
@keyframes rifa-wafter { 0%, 33% { opacity: 0; } 37%, 100% { opacity: 1; } }
@keyframes rifa-hop { 0%, 100% { transform: translateY(0) scale(1, 1); animation-timing-function: cubic-bezier(0, 0, .4, 1); } 12% { transform: translateY(0) scale(1.06, .94); } 50% { transform: translateY(-60px) scale(.97, 1.03); animation-timing-function: cubic-bezier(.6, 0, 1, 1); } }
@keyframes rifa-candyx { to { transform: translateX(var(--cx)); } }
@keyframes rifa-candyy { 0% { transform: translateY(0); animation-timing-function: cubic-bezier(.2, .6, .4, 1); } 40% { transform: translateY(var(--cy1)); animation-timing-function: cubic-bezier(.6, 0, .8, .4); } 100% { transform: translateY(var(--cy2)); } }
@keyframes rifa-candyspin { 0% { transform: rotate(0); opacity: 1; } 85% { opacity: 1; } 100% { transform: rotate(540deg); opacity: 0; } }
@keyframes rifa-confetti { 0% { transform: translate(var(--x), -20px) rotate(0); } 100% { transform: translate(calc(var(--x) + 30px), 320px) rotate(720deg); } }
@keyframes rifa-spark { 0%, 100% { transform: scale(.2); opacity: 0; } 50% { transform: scale(1); opacity: 1; } }
.rifa-w-spot { animation-name: rifa-wspot; }
.rifa-w-neon { animation-name: rifa-wneon; }
.rifa-w-crown { animation-name: rifa-wcrown; }
.rifa-w-after { animation-name: rifa-wafter; }

/* Low motion: two still frames, hard cuts instead of movement. */
@keyframes rifa-r-before { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
@keyframes rifa-r-after { 0%, 49.9% { opacity: 0; } 50%, 100% { opacity: 1; } }
@keyframes rifa-r-name { 0%, 7.9% { opacity: 0; } 8%, 100% { opacity: 1; } }
@keyframes rifa-r-crown { 0%, 32.9% { opacity: 0; } 33%, 100% { opacity: 1; } }
.rifa-r-before { animation-name: rifa-r-before; }
.rifa-r-after { animation-name: rifa-r-after; }

/* The settled final frame of the winner. */
.rifa-still .rifa-a, .rifa-still .rifa-loop, .rifa-still .rifa-flag { animation: none !important; }
.rifa-still .rifa-w-fly { display: none; }

@media (prefers-reduced-motion: reduce) {
  .rifa-stage .rifa-full { display: none; }
  .rifa-stage .rifa-reduced { display: block; }
  .rifa-stage .rifa-loop, .rifa-stage .rifa-flag { animation: none !important; }
  .rifa-stage .rifa-w-spot, .rifa-stage .rifa-w-neon { animation-name: rifa-r-name; }
  .rifa-stage .rifa-w-crown, .rifa-stage .rifa-w-after { animation-name: rifa-r-crown; }
  .rifa-stage .rifa-w-fly { display: none; }
}
`;
