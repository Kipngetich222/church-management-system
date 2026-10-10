'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/theme/theme-provider'

export type LightRaysProps = {
  className?: string
  /** How fast the shafts drift. */
  raysSpeed?: number
  /** How wide the fan of light opens (0 = tight beam, 1 = wide wash). */
  lightSpread?: number
  /** 0 = pure white light, 1 = fully saturated golden light. */
  saturation?: number
  /** How strongly the pointer drags the light source. */
  mouseInfluence?: number
  /** Normalised distance the rays reach from the source. */
  rayLength?: number
  /** Distance at which the glow dissolves into the background. */
  fadeDistance?: number
  /** Gentle brightness breathing. */
  pulsating?: boolean
  /** Follow the pointer across the viewport. */
  followMouse?: boolean
  /** Film grain amount, keeps gradients from banding. */
  noiseAmount?: number
  /** Organic wobble applied to the beams. */
  distortion?: number
  /** Overall opacity of the effect. */
  intensity?: number
  /** Base colour of the rays. */
  rayColor?: string
}

const VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 iResolution;
uniform float iTime;
uniform float uRaysSpeed;
uniform float uLightSpread;
uniform float uSaturation;
uniform float uMouseInfluence;
uniform float uRayLength;
uniform float uFadeDistance;
uniform float uNoise;
uniform float uDistort;
uniform float uPulsating;
uniform float uIntensity;
uniform vec2 uMouse;
uniform vec3 uRayColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

  // Light source just above the top edge, nudged by the pointer.
  vec2 origin = vec2(0.0, 0.82);
  origin += uMouse * 0.18 * uMouseInfluence;

  vec2 d = p - origin;
  float dist = length(d);

  // Angle measured from straight down so shafts fan out from the source.
  float angle = atan(d.x, d.y);
  float t = iTime * uRaysSpeed;

  // Soft organic wobble.
  angle += (noise(vec2(angle * 4.0 + t * 0.35, t * 0.15)) - 0.5) * uDistort;

  // Layered value noise over the angle axis -> volumetric shafts.
  float shafts = 0.0;
  shafts += noise(vec2(angle * 5.0 + t * 0.4, 0.5));
  shafts += 0.6 * noise(vec2(angle * 11.0 - t * 0.8, 3.3));
  shafts += 0.35 * noise(vec2(angle * 23.0 + t * 1.4, 7.7));
  shafts /= 1.95;
  shafts = pow(clamp(shafts, 0.0, 1.0), 1.6);

  float halfWidth = mix(0.18, 1.5, clamp(uLightSpread, 0.0, 1.0));
  float beam = smoothstep(halfWidth, halfWidth * 0.15, abs(angle));

  float reach = max(uRayLength, 0.01);
  float lengthFade = smoothstep(reach, reach * 0.15, dist);
  float edge = 1.0 - smoothstep(0.15, uFadeDistance, dist);
  float pulse = uPulsating > 0.5 ? 0.82 + 0.18 * sin(t * 1.8) : 1.0;

  float intensity = shafts * beam * lengthFade * edge * pulse * uIntensity;
  intensity *= 1.0 - uNoise * (hash(gl_FragCoord.xy + iTime) - 0.5) * 2.0;
  intensity = clamp(intensity, 0.0, 1.0);

  vec3 color = mix(vec3(1.0), uRayColor, clamp(uSaturation, 0.0, 1.0));
  color = mix(color, vec3(1.0), smoothstep(0.6, 0.0, dist) * 0.25);

  gl_FragColor = vec4(color * intensity, intensity);
}
`

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '').trim()
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  const int = parseInt(full || 'e8b84b', 16)
  if (Number.isNaN(int)) return [0.91, 0.72, 0.29]
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255]
}

export function LightRays({
  className,
  raysSpeed = 0.8,
  lightSpread = 0.3,
  saturation = 0.5,
  mouseInfluence = 0.5,
  rayLength = 1.7,
  fadeDistance = 2.4,
  pulsating = true,
  followMouse = true,
  noiseAmount = 0.06,
  distortion = 0.35,
  intensity = 0.7,
  rayColor = '#f0b429',
}: LightRaysProps) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseTarget = useRef<[number, number]>([0, 0])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    })

    // Graceful fallback: the parent supplies a static gradient behind us.
    if (!gl) return

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vertexShader = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vertexShader || !fragmentShader) return

    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    // Full-screen triangle.
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    )
    const positionLocation = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    const uniforms = {
      resolution: gl.getUniformLocation(program, 'iResolution'),
      time: gl.getUniformLocation(program, 'iTime'),
      raysSpeed: gl.getUniformLocation(program, 'uRaysSpeed'),
      lightSpread: gl.getUniformLocation(program, 'uLightSpread'),
      saturation: gl.getUniformLocation(program, 'uSaturation'),
      mouseInfluence: gl.getUniformLocation(program, 'uMouseInfluence'),
      rayLength: gl.getUniformLocation(program, 'uRayLength'),
      fadeDistance: gl.getUniformLocation(program, 'uFadeDistance'),
      noise: gl.getUniformLocation(program, 'uNoise'),
      distortion: gl.getUniformLocation(program, 'uDistort'),
      pulsating: gl.getUniformLocation(program, 'uPulsating'),
      intensity: gl.getUniformLocation(program, 'uIntensity'),
      mouse: gl.getUniformLocation(program, 'uMouse'),
      rayColor: gl.getUniformLocation(program, 'uRayColor'),
    }


    // The beams need more gold to read against the light parchment base.
    const effectiveSaturation =
      theme === 'light' ? Math.min(1, saturation + 0.4) : saturation
    const effectiveColor = theme === 'light' ? '#c9922b' : rayColor
    const [r, g, b] = hexToRgb(effectiveColor)

    gl.uniform1f(uniforms.raysSpeed, raysSpeed)
    gl.uniform1f(uniforms.lightSpread, lightSpread)
    gl.uniform1f(uniforms.saturation, effectiveSaturation)
    gl.uniform1f(uniforms.mouseInfluence, mouseInfluence)
    gl.uniform1f(uniforms.rayLength, rayLength)
    gl.uniform1f(uniforms.fadeDistance, fadeDistance)
    gl.uniform1f(uniforms.noise, noiseAmount)
    gl.uniform1f(uniforms.distortion, distortion)
    gl.uniform1f(uniforms.pulsating, pulsating ? 1 : 0)
    gl.uniform1f(uniforms.intensity, intensity)
    gl.uniform3f(uniforms.rayColor, r, g, b)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    let width = 0
    let height = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const nextWidth = Math.max(1, Math.floor(container.clientWidth * dpr))
      const nextHeight = Math.max(1, Math.floor(container.clientHeight * dpr))
      if (nextWidth === width && nextHeight === height) return
      width = nextWidth
      height = nextHeight
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
      gl.uniform2f(uniforms.resolution, width, height)
      if (prefersReducedMotion) render(performance.now())
    }

    const mouse = [0, 0]
    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      mouseTarget.current = [
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      ]
    }

    let frame = 0
    const start = performance.now()

    const render = (now: number) => {
      const elapsed = (now - start) / 1000
      const targetX = followMouse ? mouseTarget.current[0] : 0
      const targetY = followMouse ? mouseTarget.current[1] : 0
      const ease = prefersReducedMotion ? 1 : 0.06
      mouse[0] += (targetX - mouse[0]) * ease
      mouse[1] += (targetY - mouse[1]) * ease
      gl.uniform1f(uniforms.time, elapsed)
      gl.uniform2f(uniforms.mouse, mouse[0], mouse[1])
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!prefersReducedMotion) frame = requestAnimationFrame(render)
    }

    resize()
    frame = requestAnimationFrame(render)

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    if (followMouse) window.addEventListener('pointermove', onPointerMove)

    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame)
      } else if (!prefersReducedMotion) {
        frame = requestAnimationFrame(render)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
    }
  }, [
    raysSpeed,
    lightSpread,
    saturation,
    mouseInfluence,
    rayLength,
    fadeDistance,
    pulsating,
    followMouse,
    noiseAmount,
    distortion,
    intensity,
    rayColor,
    theme,
  ])

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn('pointer-events-none relative h-full w-full', className)}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
