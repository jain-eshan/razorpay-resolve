import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Button, Text } from '@razorpay/blade/components'
import { Panel } from './Panel'
import { send } from '../lib/api'

// "Was this right?" on an incident. A false alarm is kept as feedback; the weekly review on the Learning screen decides what to change.
export function FeedbackPanel({ incidentId }: { incidentId: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string>()
  const tell = async () => {
    setState('busy')
    setError(undefined)
    try {
      await send('POST', '/api/feedback', { subject_type: 'incident', subject_id: incidentId, kind: 'false_alarm', payload: {} })
      setState('done')
    } catch (e) {
      setError((e as Error).message)
      setState('idle')
    }
  }
  return (
    <Panel title="Was this a real problem?" subtitle="If it was not, say so. Alerts like this one get a little stricter at the next weekly review.">
      <Box display="flex" alignItems="center" gap="spacing.4" flexWrap="wrap">
        <Button variant="secondary" isLoading={state === 'busy'} isDisabled={state !== 'idle'} onClick={tell}>This was a false alarm</Button>
        {state === 'done' && <Text color="feedback.text.positive.intense">Noted. It is counted at the next review on the <Link to="/learning">Learning screen</Link>.</Text>}
        {error && <Text color="feedback.text.negative.intense">{error}</Text>}
      </Box>
    </Panel>
  )
}
