import { Box, CheckCircleIcon, Text } from '@razorpay/blade/components'

export type ChatStep = { title: string; note: string }

// The main story of the WhatsApp demo as four tiles, in the look of the payment issue's story strip (StoryStrip.tsx): done steps ticked, the current one in blue.
// `at` is the step the story is on (0 to 3), or 4 once it is finished. Every tile keeps its three lines whatever the state, so the strip is one height throughout.
export function ChatSteps({ steps, at }: { steps: ChatStep[]; at: number }) {
  return (
    // Four across from l, two from m, one on a phone.
    <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', m: 'repeat(2, minmax(0, 1fr))', l: `repeat(${steps.length}, minmax(0, 1fr))` }} gap="spacing.4" testID="chat-steps">
      {steps.map((s, i) => {
        const done = i < at
        const now = i === at
        return (
          <Box key={s.title} display="flex" alignItems="flex-start" gap="spacing.3" padding="spacing.4" borderRadius="medium" borderWidth="thin" testID={`chat-step-${i + 1}`}
            borderColor={now ? 'surface.border.primary.muted' : 'surface.border.gray.subtle'} backgroundColor={done ? 'surface.background.gray.moderate' : 'surface.background.gray.intense'}>
            {done ? <Box flexShrink={0} display="flex"><CheckCircleIcon size="large" color="feedback.icon.positive.intense" /></Box> : (
              <Box width="spacing.6" height="spacing.6" flexShrink={0} borderRadius="max" display="flex" alignItems="center" justifyContent="center" borderWidth={now ? 'thick' : 'thin'} borderColor={now ? 'surface.border.primary.normal' : 'surface.border.gray.normal'}>
                <Text size="xsmall" weight="semibold" color={now ? 'surface.text.primary.normal' : 'surface.text.gray.muted'}>{i + 1}</Text>
              </Box>
            )}
            <Box display="flex" flexDirection="column" gap="spacing.1" minWidth="spacing.0">
              <Text size="small" weight="semibold" color={now ? 'surface.text.primary.normal' : 'surface.text.gray.normal'}>{s.title}</Text>
              {/* Two lines kept for the note where four tiles sit across, so a short note does not make one tile shorter than the rest. On a phone the note is
                  left out, so the four steps take about 260px above the chat instead of 450px. */}
              <Box display={{ base: 'none', m: 'block' }} minHeight={{ base: 'spacing.0', l: '36px' }}><Text size="small" color="surface.text.gray.muted">{s.note}</Text></Box>
              <Text size="xsmall" weight="semibold" color={now ? 'surface.text.primary.normal' : 'surface.text.gray.muted'}>{done ? 'Done' : now ? 'Now' : 'Next'}</Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
