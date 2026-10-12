import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Heading, PlayCircleIcon, Text } from '@razorpay/blade/components'

// The title block every page starts with: a heading, one muted line, actions on the right.
// The actions sit beside the title from `l`: below that the page column is narrow (the side nav takes about 250px), so they go under it.
// `guide` adds a "How it works" button that opens that product guide (lib/guides.ts).
export function PageHeader({ title, description, actions, guide }: { title: string; description?: string; actions?: ReactNode; guide?: string }) {
  const nav = useNavigate()
  return (
    <Box display="flex" flexDirection={{ base: 'column', l: 'row' }} justifyContent="space-between" alignItems={{ base: 'flex-start', l: 'center' }} gap="spacing.4">
      <Box display="flex" flexDirection="column" gap="spacing.2" maxWidth="720px">
        <Heading as="h1" size="xlarge">{title}</Heading>
        {description && <Text color="surface.text.gray.muted">{description}</Text>}
      </Box>
      {(guide || actions) && (
        <Box display="flex" flexWrap="wrap" alignItems="center" gap="spacing.3" flexShrink={0} maxWidth="100%" whiteSpace="nowrap">
          {guide && <Button variant="tertiary" size="medium" icon={PlayCircleIcon} onClick={() => nav(`/guides/${guide}`)}>How it works</Button>}
          {actions}
        </Box>
      )}
    </Box>
  )
}
