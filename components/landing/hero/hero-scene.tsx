"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { VisualQuality } from "@/lib/motion/capabilities";
import type { ResolvedTheme } from "@/lib/theme/theme";

/*
 * "The Dot Field": one cloud of points that keeps re-forming. A sphere, the
 * word "Gixxer" in the wordmark's own typeface, a rippling sheet, a torus
 * surface and a cube, all made of dots and nothing but dots: no rings, no
 * threads, no spiral. Every point carries all five positions as vertex
 * attributes and the shader interpolates between them, so a morph costs the
 * same as standing still. While the word is on screen the cloud stops
 * spinning, faces the camera and calms its noise, so the letters read cleanly. Per frame the CPU writes a
 * handful of uniforms and lerps two rotations.
 *
 * The loop only runs while the hero is on screen and the tab is visible
 * (the parent switches `frameloop` to "never" otherwise), and the geometries
 * and material are disposed explicitly on unmount.
 *
 * Theme handling: on dark the points are white light, additively blended so
 * overlaps glow. Additive blending cannot darken, so on light the points
 * switch to ink with normal blending and lower opacity.
 */

export interface Pointer {
  x: number;
  y: number;
}

interface HeroSceneProps {
  pointer: RefObject<Pointer>;
  active: boolean;
  quality: VisualQuality;
  theme: ResolvedTheme;
  onReady: () => void;
}

const PALETTE: Record<ResolvedTheme, { particle: THREE.Color; opacity: number; dust: number }> = {
  dark: { particle: new THREE.Color("#ffffff"), opacity: 1, dust: 0.4 },
  light: { particle: new THREE.Color("#030000"), opacity: 0.6, dust: 0.25 },
};

/** Hold time per form, in order: sphere, word, sheet, torus, cube. */
const FORM_HOLDS = [3.2, 5.6, 4, 4, 4] as const;
const FORMS = FORM_HOLDS.length;
const WORD_FORM = 1;
const MORPH_SECONDS = 2;
const CYCLE_SECONDS = FORM_HOLDS.reduce((total, hold) => total + hold + MORPH_SECONDS, 0);
const WORD = "Gixxer";

/** Where the timeline is: which form it leaves, which it heads to, and how far along. */
function schedule(time: number): { from: number; to: number; mix: number } {
  let local = time % CYCLE_SECONDS;
  for (let form = 0; form < FORMS; form++) {
    const hold = FORM_HOLDS[form]!;
    if (local < hold) return { from: form, to: (form + 1) % FORMS, mix: 0 };
    local -= hold;
    if (local < MORPH_SECONDS) return { from: form, to: (form + 1) % FORMS, mix: local / MORPH_SECONDS };
    local -= MORPH_SECONDS;
  }
  return { from: 0, to: 1, mix: 0 };
}

/* Simplex noise by Ian McEwan, Ashima Arts (MIT). The standard GLSL implementation. */
const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const VERTEX = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uAmplitude;
uniform int uFrom;
uniform int uTo;
uniform float uMix;
attribute vec3 aForm0;
attribute vec3 aForm1;
attribute vec3 aForm2;
attribute vec3 aForm3;
attribute vec3 aForm4;
attribute float aSeed;
varying float vAlpha;
${NOISE_GLSL}
vec3 pick(int k) {
  if (k == 0) return aForm0;
  if (k == 1) return aForm1;
  if (k == 2) return aForm2;
  if (k == 3) return aForm3;
  return aForm4;
}
void main() {
  vec3 from = pick(uFrom);
  vec3 to = pick(uTo);
  // Each point leaves a little early or late, so the cloud streams rather than snaps.
  float t = smoothstep(0.0, 1.0, clamp((uMix - aSeed * 0.35) / 0.65, 0.0, 1.0));
  vec3 p = mix(from, to, t);
  float slow = snoise(p * 1.3 + vec3(0.0, uTime * 0.14, 0.0));
  float fine = snoise(p * 4.0 - vec3(uTime * 0.1)) * 0.3;
  vec3 dir = normalize(p + vec3(0.0001));
  p += dir * (slow + fine) * uAmplitude;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float size = 1.6 + aSeed * 1.8 + max(slow, 0.0) * 1.1;
  gl_PointSize = size * uPixelRatio * (3.7 / -mvPosition.z);
  vAlpha = 0.25 + 0.75 * smoothstep(-0.4, 0.6, slow);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.1, d) * vAlpha * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
}
`;

/** Deterministic pseudo-random so both themes build the same cloud. */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Dots that spell the word: draw it once on an offscreen canvas in the
 * wordmark's face (Exo 2, heavy italic), keep the inked pixels, and scatter
 * the points over them. Centred on the origin, `width` world units wide.
 */
function wordPositions(count: number, width: number, offsetX: number, rand: () => number): Float32Array {
  const out = new Float32Array(count * 3);
  const W = 1200;
  const H = 360;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return out;
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-exo2").trim() || "sans-serif";
  let size = 280;
  context.font = `italic 900 ${size}px ${family}`;
  const measured = context.measureText(WORD).width;
  if (measured > W * 0.9) {
    size = Math.floor((size * W * 0.9) / measured);
    context.font = `italic 900 ${size}px ${family}`;
  }
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(WORD, W / 2, H / 2);
  const pixels = context.getImageData(0, 0, W, H).data;

  const inked: number[] = [];
  let minX = W;
  let maxX = 0;
  let minY = H;
  let maxY = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if ((pixels[(y * W + x) * 4 + 3] ?? 0) > 140) {
        inked.push(x, y);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pairs = inked.length / 2;
  if (pairs === 0) return out;
  const scale = width / Math.max(1, maxX - minX);
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  for (let i = 0; i < count; i++) {
    const pick = Math.floor(rand() * pairs) * 2;
    const x = inked[pick]!;
    const y = inked[pick + 1]!;
    out[i * 3] = (x - centreX + (rand() - 0.5) * 2) * scale + offsetX;
    out[i * 3 + 1] = -(y - centreY + (rand() - 0.5) * 2) * scale;
    out[i * 3 + 2] = (rand() - 0.5) * 0.08;
  }
  return out;
}

/** The five dot forms, one position per point in each, plus a per-point seed. */
function buildGeometry(count: number, wordWidth: number, wordOffset: number): THREE.BufferGeometry {
  const rand = mulberry(48219);
  const word = wordPositions(count, wordWidth, wordOffset, mulberry(4471));
  const sphere = new Float32Array(count * 3);
  const sheet = new Float32Array(count * 3);
  const torus = new Float32Array(count * 3);
  const cube = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  const golden = Math.PI * (3 - Math.sqrt(5));
  const side = Math.ceil(Math.sqrt(count));
  const perFace = Math.ceil(count / 6);
  const faceSide = Math.ceil(Math.sqrt(perFace));

  for (let i = 0; i < count; i++) {
    seeds[i] = rand();

    // Sphere: Fibonacci lattice, evenly spread dots.
    {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      sphere[i * 3] = Math.cos(theta) * r * 1.3;
      sphere[i * 3 + 1] = y * 1.3;
      sphere[i * 3 + 2] = Math.sin(theta) * r * 1.3;
    }

    // Sheet: a tilted grid of dots with a slow ripple through it.
    {
      const column = i % side;
      const row = Math.floor(i / side);
      const u = (column / (side - 1)) * 2 - 1;
      const v = (row / (side - 1)) * 2 - 1;
      const ripple = Math.sin(Math.hypot(u, v) * 6) * 0.12;
      sheet[i * 3] = u * 1.8;
      sheet[i * 3 + 1] = v * 1.1 + ripple;
      sheet[i * 3 + 2] = -v * 0.4 + ripple * 0.5;
    }

    // Torus: dots spread over the whole surface of a fat ring, never a thin line.
    {
      const u = rand() * Math.PI * 2;
      const w = rand() * Math.PI * 2;
      const R = 1.05;
      const r = 0.48;
      torus[i * 3] = (R + r * Math.cos(w)) * Math.cos(u);
      torus[i * 3 + 1] = r * Math.sin(w);
      torus[i * 3 + 2] = (R + r * Math.cos(w)) * Math.sin(u);
    }

    // Cube: a regular grid of dots on each of the six faces.
    {
      const face = Math.floor(i / perFace) % 6;
      const k = i % perFace;
      const a = ((k % faceSide) / (faceSide - 1)) * 2 - 1;
      const b = (Math.floor(k / faceSide) / (faceSide - 1)) * 2 - 1;
      const s = 0.95;
      const points: [number, number, number][] = [
        [s, a * s, b * s],
        [-s, a * s, b * s],
        [a * s, s, b * s],
        [a * s, -s, b * s],
        [a * s, b * s, s],
        [a * s, b * s, -s],
      ];
      const [x, y, z] = points[face]!;
      cube[i * 3] = x;
      cube[i * 3 + 1] = y;
      cube[i * 3 + 2] = z;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(sphere, 3));
  geometry.setAttribute("aForm0", new THREE.Float32BufferAttribute(sphere, 3));
  geometry.setAttribute("aForm1", new THREE.Float32BufferAttribute(word, 3));
  geometry.setAttribute("aForm2", new THREE.Float32BufferAttribute(sheet, 3));
  geometry.setAttribute("aForm3", new THREE.Float32BufferAttribute(torus, 3));
  geometry.setAttribute("aForm4", new THREE.Float32BufferAttribute(cube, 3));
  geometry.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
  // The cloud never leaves this box, so skip per-frame bounds recomputation.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 3);
  return geometry;
}

/** Sparse dust in a shell around the cloud. */
function buildDustGeometry(count: number): THREE.BufferGeometry {
  const rand = mulberry(7);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 2.2 + rand() * 1.5;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.7;
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function DotField({ pointer, quality, theme, onReady }: Omit<HeroSceneProps, "active">) {
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const ready = useRef(false);
  const clock = useRef(0);
  const spinAngle = useRef(0);
  const pixelRatio = useThree((state) => state.gl.getPixelRatio());
  // The word must fit the canvas it sits in. On wide screens the canvas sits beside the
  // headline, so the word is narrower and nudged right to stay clear of it.
  const viewportWidth = useThree((state) => state.viewport.width);
  const wide = useThree((state) => state.size.width > 700);
  const wordWidth = wide ? 2.2 : Math.min(3, Math.round(viewportWidth * 0.84 * 10) / 10);
  const wordOffset = wide ? 0.32 : 0;
  const palette = PALETTE[theme];

  const geometry = useMemo(() => buildGeometry(quality === "high" ? 12_000 : 6_000, wordWidth, wordOffset), [quality, wordWidth, wordOffset]);
  const dust = useMemo(() => buildDustGeometry(quality === "high" ? 320 : 160), [quality]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uAmplitude: { value: 0.1 },
      uFrom: { value: 0 },
      uTo: { value: 1 },
      uMix: { value: 0 },
      uColor: { value: palette.particle.clone() },
      uOpacity: { value: palette.opacity },
    }),
    // Rebuilt on theme change so the shader picks up the new colour.
    [palette],
  );

  // Geometries are built outside JSX, so they are ours to free. Materials
  // declared in JSX are disposed by React Three Fiber on unmount.
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => dust.dispose(), [dust]);

  useFrame((_state, delta) => {
    // Clamp the step so a paused tab does not jump the morph when it resumes.
    const dt = Math.min(delta, 0.05);
    clock.current += dt;
    const t = clock.current;

    const { from, to, mix: raw } = schedule(t);
    const mix = easeInOut(raw);
    const loosen = Math.sin(mix * Math.PI);
    // How much of the word is on screen: 1 while it holds, easing in and out around it.
    const word = from === WORD_FORM ? 1 - mix : to === WORD_FORM ? mix : 0;

    if (material.current) {
      const u = material.current.uniforms;
      u.uTime!.value = t;
      u.uPixelRatio!.value = pixelRatio;
      u.uFrom!.value = from;
      u.uTo!.value = to;
      u.uMix!.value = mix;
      u.uAmplitude!.value = (0.08 + loosen * 0.16) * (1 - 0.8 * word);
    }

    // Spin freely, except around the word: then finish the current turn and face the camera.
    if (word > 0) {
      const facing = Math.ceil(spinAngle.current / (Math.PI * 2) - 0.02) * Math.PI * 2;
      spinAngle.current = THREE.MathUtils.lerp(spinAngle.current, facing, Math.min(1, dt * 2.6));
    } else {
      spinAngle.current += dt * 0.08;
    }
    if (spin.current) spin.current.rotation.y = spinAngle.current;
    if (tilt.current) {
      const target = pointer.current ?? { x: 0, y: 0 };
      const calm = 1 - 0.6 * word;
      tilt.current.rotation.x = THREE.MathUtils.lerp(tilt.current.rotation.x, (target.y * 0.26 + 0.18 * (1 - word)) * calm, dt * 2.2);
      tilt.current.rotation.y = THREE.MathUtils.lerp(tilt.current.rotation.y, target.x * 0.36 * calm, dt * 2.2);
    }
    if (!ready.current) {
      ready.current = true;
      onReady();
    }
  });

  return (
    <group ref={tilt}>
      <group ref={spin}>
        <points geometry={geometry}>
          <shaderMaterial
            key={theme}
            ref={material}
            uniforms={uniforms}
            vertexShader={VERTEX}
            fragmentShader={FRAGMENT}
            transparent
            depthWrite={false}
            blending={theme === "dark" ? THREE.AdditiveBlending : THREE.NormalBlending}
          />
        </points>
        <points geometry={dust}>
          <pointsMaterial color={palette.particle} size={0.02} sizeAttenuation transparent opacity={palette.dust} depthWrite={false} />
        </points>
      </group>
    </group>
  );
}

export function HeroScene({ pointer, active, quality, theme, onReady }: HeroSceneProps) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={quality === "high" ? [1, 1.5] : 1}
      camera={{ position: [0, 0, 5.1], fov: 38, near: 0.1, far: 20 }}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ background: "transparent" }}
    >
      <DotField pointer={pointer} quality={quality} theme={theme} onReady={onReady} />
    </Canvas>
  );
}
