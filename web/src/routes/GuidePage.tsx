import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowRightIcon, Box, Button, Card, CardBody, Carousel, CarouselItem, Heading, Link, Text } from '@razorpay/blade/components'
import { guideById } from '../lib/guides'

// A product guide in the shape of Razorpay's own (Smart Collect, Checkout Rewards). Slide 1 is the hero, slide 2 is "What makes X great?" (web/DESIGN.md section 16).
export default function GuidePage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [slide, setSlide] = useState(0)
  const g = guideById(id)
  if (!g) return <Navigate to="/" replace />
  const go = () => nav(g.to)
  const Icon = g.icon

  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap="spacing.6" testID="guide">
      <Card padding="spacing.0" width="100%">
        <CardBody>
          <Carousel visibleItems={1} activeSlide={slide} onChange={setSlide} showIndicators navigationButtonPosition="bottom">
            <CarouselItem>
              <Box display="grid" gridTemplateColumns={{ base: '1fr', m: '1fr 1fr' }} minHeight="420px">
                <Box display={{ base: 'none', m: 'flex' }} alignItems="center" justifyContent="center" backgroundColor="surface.background.primary.subtle">
                  <Box backgroundColor="surface.background.gray.intense" borderRadius="max" width="96px" height="96px" display="flex" alignItems="center" justifyContent="center">
                    <Icon size="2xlarge" color="surface.icon.primary.normal" />
                  </Box>
                </Box>
                <Box display="flex" flexDirection="column" justifyContent="center" gap="spacing.5" padding={{ base: 'spacing.6', m: 'spacing.9' }}>
                  <Text weight="semibold" color="interactive.text.primary.normal">Razorpay</Text>
                  <Heading size="2xlarge">{g.title}</Heading>
                  <Text size="large" color="surface.text.gray.subtle">{g.description}</Text>
                  <Box><Button variant="primary" size="large" iconPosition="right" icon={ArrowRightIcon} onClick={() => setSlide(1)}>Read more</Button></Box>
                </Box>
              </Box>
            </CarouselItem>
            <CarouselItem>
              <Box display="flex" flexDirection="column" gap="spacing.7" padding={{ base: 'spacing.6', m: 'spacing.9' }} minHeight="420px">
                <Heading size="xlarge">What makes {g.title} great?</Heading>
                <Box display="grid" gridTemplateColumns={{ base: '1fr', m: 'repeat(3, minmax(0, 1fr))' }} gap="spacing.5">
                  {g.benefits.map((b) => (
                    <Box key={b.title} backgroundColor="surface.background.gray.subtle" borderRadius="medium" padding="spacing.6" display="flex" flexDirection="column" gap="spacing.4">
                      <b.icon size="xlarge" color="surface.icon.primary.normal" />
                      <Heading size="small">{b.title}</Heading>
                      <Text color="surface.text.gray.muted">{b.text}</Text>
                    </Box>
                  ))}
                </Box>
                <Box display="flex" justifyContent="flex-end" gap="spacing.4">
                  <Button variant="tertiary" size="large" onClick={() => setSlide(0)}>Back</Button>
                  <Button variant="primary" size="large" onClick={go}>Get started</Button>
                </Box>
              </Box>
            </CarouselItem>
          </Carousel>
        </CardBody>
      </Card>
      <Link href={g.to} onClick={(e) => { e.preventDefault(); go() }}>Skip and get started</Link>
    </Box>
  )
}
