'use client'

import { useEffect, useState } from 'react'

const ROTATING_WORDS = [
  'purpose',
  'excellence',
  'faith',
  'vision',
  'heart',
  'impact',
  'joy',
  'wisdom',
]

function WavyLetters({
  text,
  stagger = 0.06,
  startDelay = 0,
  className,
}: {
  text: string
  stagger?: number
  startDelay?: number
  className?: string
}) {
  return (
    <span className={className}>
      {Array.from(text).map((char, index) => (
        <span
          key={`${char}-${index}`}
          className="animate-hero-wave inline-block"
          style={{ animationDelay: `${(startDelay + index * stagger).toFixed(6)}s` }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  )
}

export function HeroHeadline() {
  const [index, setIndex] = useState(0)
  const word = ROTATING_WORDS[index]

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % ROTATING_WORDS.length)
    }, 4800)
    return () => window.clearInterval(id)
  }, [])

  return (
    <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
      <WavyLetters
        text="Manage your church"
        className="block [--wave-amp:0.07em] [--wave-duration:5.2s]"
        stagger={0.055}
      />

      <span className="mt-3 flex flex-wrap items-baseline justify-center gap-x-3">
        <span className="text-xl font-normal italic text-muted-foreground md:text-3xl">
          with
        </span>

        <span className="relative inline-block px-1 pb-2 [--wave-amp:0.18em] [--wave-duration:1.9s]">
          <span
            key={index}
            className="animate-hero-word-in font-script text-5xl leading-none md:text-7xl"
            style={{ filter: 'drop-shadow(0 6px 22px rgb(231 181 83 / 0.35))' }}
          >
            {Array.from(word).map((char, letterIndex) => (
              <span
                key={`${char}-${letterIndex}`}
                className="animate-hero-wave inline-block bg-gradient-to-b from-primary via-primary to-primary/60 bg-clip-text text-transparent"
                style={{ animationDelay: `${(letterIndex * 0.1).toFixed(4)}s` }}
              >
                {char}
              </span>
            ))}
          </span>

          <svg
            aria-hidden
            viewBox="0 0 240 16"
            preserveAspectRatio="none"
            fill="none"
            className="pointer-events-none absolute -bottom-1 left-0 h-3 w-full overflow-visible text-primary/70"
          >
            <path
              key={index}
              d="M3 11 C 52 3, 96 14, 140 8 S 210 2, 237 10"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="animate-hero-stroke [--stroke-length:300]"
            />
          </svg>
        </span>
      </span>
    </h1>
  )
}