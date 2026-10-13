import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Code, CopyIcon, CheckIcon, ShieldIcon, Text } from '@razorpay/blade/components'
import { PageHeader } from '../components/PageHeader'
import { IntegrationSteps } from '../components/IntegrationSteps'
import { Panel } from '../components/Panel'
import { CONNECT_PROMPT, CONNECT_WHY } from '../lib/connectPrompt'

// Connect by prompt (PRD D21). Razorpay now gives a merchant a prompt to paste into a coding agent instead of reading the docs. This is the one that connects Resolve.
// A page of text and two buttons: it reads nothing from the server and changes nothing.
export default function Connect() {
  const nav = useNavigate()
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no')
  useEffect(() => {
    if (copied !== 'yes') return
    const t = setTimeout(() => setCopied('no'), 2500)  // the button goes back to "Copy the prompt", so a second copy is a visible change again
    return () => clearTimeout(t)
  }, [copied])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONNECT_PROMPT)
      setCopied('yes')
    } catch {
      setCopied('failed')
    }
  }
  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader guide="integration" title="Integration" description="Paste one prompt into your coding agent. It sets up your webhook so every customer who pays gets access, and so Resolve can tell when one does not. Then run the go-live check." />
      <IntegrationSteps />
      <Alert isFullWidth isDismissible={false} color="information" title="Prototype" description="Razorpay already gives a prompt for the integration; this is the part Resolve would add. The confirmation address in it is a placeholder, because nothing like it exists at Razorpay yet. Resolve never asks for your webhook secret." />

      <Panel title="1. Paste this into your coding agent" subtitle="Claude Code, Cursor, Replit or any agent that can edit your project"
        trailing={<Box flexShrink={0} whiteSpace="nowrap"><Button variant="secondary" icon={copied === 'yes' ? CheckIcon : CopyIcon} onClick={copy}>{copied === 'yes' ? 'Copied' : 'Copy the prompt'}</Button></Box>}>
        {copied === 'failed' && <Text size="small" color="feedback.text.negative.intense">Your browser did not allow copying. Select the text below and copy it yourself.</Text>}
        <Box whiteSpace="pre-wrap" overflow="auto" testID="connect-prompt">
          <Code size="medium">{CONNECT_PROMPT}</Code>
        </Box>
      </Panel>

      <Panel title="2. Check it" subtitle="The go-live check sends your webhook a test payment and tells you whether access was given">
        <Box maxWidth="720px"><Text>When the agent is done, run the tests it wrote, deploy to a place where you can reach it, and run the go-live check. If a step fails it says what it means and what to do.</Text></Box>
        <Box><Button variant="secondary" icon={ShieldIcon} onClick={() => nav('/release-check')}>Open the go-live check</Button></Box>
      </Panel>

      <Panel title="What each rule closes" subtitle="Every line of the prompt is there because Resolve finds the failure it prevents">
        <Box display="flex" flexDirection="column" gap="spacing.5">
          {CONNECT_WHY.map((w, i) => (
            <Box key={w.rule} display="flex" flexDirection="column" gap="spacing.1" maxWidth="720px">
              <Text weight="semibold">{`${i + 1}. ${w.rule}`}</Text>
              <Text size="small">{w.closes}</Text>
              <Text size="small" color="surface.text.gray.muted">{`Where you see it: ${w.seen}`}</Text>
            </Box>
          ))}
        </Box>
      </Panel>
    </Box>
  )
}
