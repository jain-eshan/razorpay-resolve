import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon, ArrowRightIcon, Badge, Box, Button, Card, CardBody, Carousel, CarouselItem, Heading, Link, Text, VisuallyHidden } from '@razorpay/blade/components'
import { GuideArt } from '../components/GuideArt'
import { GuideHero } from '../components/GuideHero'
import type { ArtId } from '../components/FlatArt'
import { guideById } from '../lib/guides'
import { useGuideStats } from '../lib/guideStats'

// From 1280px (Blade's xl) the guide is a carousel and all three slides are this tall, so the card does not change height as you slide. Below that the content column is too narrow for columns and the slides have very different heights, so only the active slide shows, as tall as its content, with dots under it.
const WIDE = '(min-width: 1280px)'
const SLIDE_H = { base: 'auto', xl: '548px' } as const
function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches)
  useEffect(() => {
    const q = window.matchMedia(WIDE)
    const on = () => setWide(q.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return wide
}

// A card in the shape of the product cards on Razorpay's dashboard home: a picture in an inset panel, a small chip (the step), a bold title, one line of text.
function ArtCard({ art, title, text, chip }: { art: ArtId; title: string; text: string; chip?: string }) {
  return (
    <Card height="100%">
      <CardBody>
        <Box display="flex" flexDirection="column" gap="spacing.4" height="100%">
          <GuideArt art={art} />
          <Box display="flex" flexDirection="column" alignItems="flex-start" gap="spacing.3">
            {chip && <Badge size="medium" color="neutral">{chip}</Badge>}
            <Heading size="medium">{title}</Heading>
            <Text color="surface.text.gray.subtle">{text}</Text>
          </Box>
        </Box>
      </CardBody>
    </Card>
  )
}

// A product guide in the shape of Razorpay's own (Smart Collect, the agent pages). Slide 1: the hero, one paragraph, three figures. Slide 2: "What makes X great?". Slide 3: "How to use X", three steps (web/DESIGN.md section 16).
export default function GuidePage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [slide, setSlide] = useState(0)
  const wide = useWide()
  const first = useRef(true)
  const g = guideById(id)
  const stats = useGuideStats(g?.id ?? '')
  // Below xl each slide is a different height, so after a change bring the top of the guide back into view.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (!wide) document.querySelector('[data-testid="guide"]')?.scrollIntoView({ block: 'start' })
  }, [slide, wide])
  if (!g) return <Navigate to="/" replace />
  const go = () => nav(g.to)

  const slides: ReactNode[] = [
    (
      <Box key="what" display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', xl: 'repeat(2, minmax(0, 1fr))' }} minHeight={SLIDE_H}>
        <GuideHero id={g.id} />
        <Box display="flex" flexDirection="column" justifyContent="center" gap="spacing.5" padding={{ base: 'spacing.6', xl: 'spacing.9' }}>
          <Box display="flex" alignItems="center" gap="spacing.3">
            <Box width="24px" height="2px" backgroundColor="feedback.background.positive.intense" />
            <Text weight="semibold">Razorpay</Text>
          </Box>
          <Heading size="2xlarge">{g.title}</Heading>
          <Text size="large" color="surface.text.gray.subtle">{g.description}</Text>
          {stats && (
            <Box display="grid" gridTemplateColumns={`repeat(${stats.length}, minmax(0, 1fr))`} gap="spacing.5" testID="guide-stats">
              {stats.map((s) => (
                <Box key={s.label} display="flex" flexDirection="column" gap="spacing.1">
                  <Heading size="large">{s.value}</Heading>
                  <Text size="small" color="surface.text.gray.muted">{s.label}</Text>
                </Box>
              ))}
            </Box>
          )}
          <Text size="small" color="surface.text.gray.muted">{g.note}</Text>
          <Box><Button variant="primary" size="large" iconPosition="right" icon={ArrowRightIcon} onClick={() => setSlide(1)}>Read more</Button></Box>
        </Box>
      </Box>
    ),
    (
      <Box key="why" display="flex" flexDirection="column" gap="spacing.7" padding={{ base: 'spacing.6', xl: 'spacing.9' }} paddingBottom={{ base: 'spacing.6', xl: 'spacing.5' }} minHeight={SLIDE_H}>
        <Box display="flex" flexDirection={{ base: 'column', xl: 'row' }} justifyContent="space-between" alignItems={{ base: 'flex-start', xl: 'center' }} gap="spacing.4">
          <Heading size="xlarge">What makes {g.title} great?</Heading>
          <Box display="flex" flexWrap="wrap" gap="spacing.5">
            {g.links.map((l) => <Link key={l.to} href={l.to} onClick={(e) => { e.preventDefault(); nav(l.to) }}>{l.label}</Link>)}
          </Box>
        </Box>
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', xl: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
          {g.benefits.map((b) => <ArtCard key={b.title} art={b.art} title={b.title} text={b.text} />)}
        </Box>
        <Box display="flex" justifyContent="flex-end" gap="spacing.4" marginTop="auto">
          <Button variant="tertiary" size="large" icon={ArrowLeftIcon} onClick={() => setSlide(0)}>Back</Button>
          <Button variant="primary" size="large" iconPosition="right" icon={ArrowRightIcon} onClick={() => setSlide(2)}>See how to use it</Button>
        </Box>
      </Box>
    ),
    (
      <Box key="how" display="flex" flexDirection="column" gap="spacing.7" padding={{ base: 'spacing.6', xl: 'spacing.9' }} paddingBottom={{ base: 'spacing.6', xl: 'spacing.5' }} minHeight={SLIDE_H} testID="guide-steps">
        <Heading size="xlarge">How to use {g.title}</Heading>
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', xl: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
          {g.steps.map((st, i) => <ArtCard key={st.title} art={st.art} title={st.title} text={st.text} chip={`Step ${i + 1}`} />)}
        </Box>
        <Box display="flex" justifyContent="flex-end" gap="spacing.4" marginTop="auto">
          <Button variant="tertiary" size="large" icon={ArrowLeftIcon} onClick={() => setSlide(1)}>Back</Button>
          <Button variant="primary" size="large" onClick={go}>Get started</Button>
        </Box>
      </Box>
    ),
  ]

  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap="spacing.6" testID="guide">
      <Card padding="spacing.0" width="100%">
        <CardBody>
          <Box paddingBottom="spacing.6" overflow="hidden" borderRadius="large">
            {wide ? (
              <Carousel visibleItems={1} activeSlide={slide} onChange={setSlide} showIndicators navigationButtonPosition="bottom">
                {slides.map((content, i) => <CarouselItem key={i}>{content}</CarouselItem>)}
              </Carousel>
            ) : (
              <>
                {slides[slide]}
                <Box display="flex" justifyContent="center" gap="spacing.3" paddingTop="spacing.5">
                  <VisuallyHidden>{`Slide ${slide + 1} of ${slides.length}`}</VisuallyHidden>
                  {slides.map((_, i) => <Box key={i} width={i === slide ? '20px' : '8px'} height="8px" borderRadius="max" backgroundColor={i === slide ? 'feedback.background.neutral.intense' : 'feedback.background.neutral.subtle'} />)}
                </Box>
              </>
            )}
          </Box>
        </CardBody>
      </Card>
      <Link href={g.to} onClick={(e) => { e.preventDefault(); go() }} size="large">Skip and get started</Link>
    </Box>
  )
}
