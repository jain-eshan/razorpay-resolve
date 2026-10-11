import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Heading, PlayCircleIcon, Text } from '@razorpay/blade/components'

// The title block every page starts with: a heading, one muted line, actions on the right.
// `guide` adds a "How it works" button that opens that product guide (lib/guides.ts).
export function PageHeader({ title, description, actions, guide }: { title: string; description?: string; actions?: ReactNode; guide?: string }) {
  const nav = useNavigate()
  return (
    <Box display="flex" flexDirection={{ base: 'column', m: 'row' }} justifyContent="space-between" alignItems={{ base: 'flex-start', m: 'center' }} gap="spacing.4">
      <Box display="flex" flexDirection="column" gap="spacing.2" maxWidth="720px">
        <Heading as="h1" size="xlarge">{title}</Heading>
        {description && <Text color="surface.text.gray.muted">{description}</Text>}
      </Box>
      {(guide || actions) && (
        <Box display="flex" alignItems="center" gap="spacing.3" flexShrink={0} whiteSpace="nowrap">
          {guide && <Button variant="tertiary" size="medium" icon={PlayCircleIcon} onClick={() => nav(`/guides/${guide}`)}>How it works</Button>}
          {actions}
        </Box>
      )}
    </Box>
  )
}
