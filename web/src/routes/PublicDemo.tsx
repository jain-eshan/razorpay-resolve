import { useEffect, useState } from 'react'
import { Alert, Badge, Box, Button, Card, CardBody, Heading, Link, Text } from '@razorpay/blade/components'
import { ThreadView } from '../components/ThreadView'
import { isLive, send, type Schemas } from '../lib/api'
import { demoNote } from '../lib/demo'
import { useLiveThread } from '../lib/live'
import { PageHeader } from '../components/PageHeader'

type Post = { id: string; kind: string; label: string; handle: string; text: string; url: string | null; follow_up: { channel: string; who: string; text: string } | null }
const KIND: Record<string, string> = { public_with_reference: 'Names a payment', public_without_reference: 'No payment named', public_threat: 'A threat', real_public_post: 'Real post' }

// A public post that mentions the merchant. Blindspot never discusses a payment in public: at most one generic line with a private link, held for the founder. If the customer then writes privately, the conversation carries on there.
export default function PublicDemo() {
  const [posts, setPosts] = useState<Post[]>([])
  const [sel, setSel] = useState<Post>()
  const [tid, setTid] = useState<string>()
  const [ptid, setPtid] = useState<string>()
  const [v, setV] = useState(0)
  const [error, setError] = useState<string>()
  const t = useLiveThread(tid, v)
  const priv = useLiveThread(ptid, v)
  useEffect(() => {
    fetch('/snapshot/public_posts.json').then((r) => r.json()).then(setPosts, () => setError('Could not load the posts.'))
  }, [])
  const show = async (p: Post) => {
    setError(undefined)
    setSel(p)
    setPtid(undefined)
    try {
      const step = await send<Schemas['ThreadStep']>('POST', '/api/inbound/public_mention', { customer_ref: p.handle, text: p.text, context: { label: p.label, external_ref: p.id }, is_public: true })
      setTid(step.thread.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const writePrivately = async () => {
    if (!sel?.follow_up || !tid) return
    setError(undefined)
    try {
      const step = await send<Schemas['ThreadStep']>('POST', `/api/inbound/${sel.follow_up.channel}`, { customer_ref: sel.follow_up.who, text: sel.follow_up.text, context: { public_thread: tid } })
      setPtid(step.thread.id)
      setV((n) => n + 1)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <PageHeader title="A public post" description="When someone posts about a payment problem in public, Blindspot does not discuss it there. It drafts one generic reply with a private link, with no amount, name or status in it, and holds it for the founder. Nothing in the post is looked up, and the handle is never tied to a payment until the customer writes privately." />
      {!isLive && <Alert isFullWidth color="information" isDismissible={false} title="Guided demo" description={`${demoNote} Pick a post. Real posts from the research are watched and never answered.`} />}
      {error && <Alert isFullWidth color="negative" isDismissible={false} title="Not done" description={error} />}
      <Box display="grid" gridTemplateColumns={{ base: '1fr', l: 'minmax(320px, 440px) minmax(0, 1fr)' }} gap="spacing.7" alignItems="start">
        <Box display="flex" flexDirection="column" gap="spacing.4" testID="public-posts">
          {posts.map((p) => (
            <Card key={p.id}><CardBody>
              <Box display="flex" flexDirection="column" gap="spacing.3">
                <Box display="flex" gap="spacing.3" alignItems="center" flexWrap="wrap">
                  <Text size="small" weight="semibold">{p.handle}</Text>
                  <Badge color={p.label === 'real_public_post' ? 'information' : 'neutral'} size="medium">{p.label === 'real_public_post' ? 'Real post, watched only' : 'Synthetic'}</Badge>
                  <Badge color="neutral" size="medium">{KIND[p.kind] ?? p.kind}</Badge>
                </Box>
                <Text>{p.text}</Text>
                {p.url && <Link href={p.url} target="_blank" size="small">Source</Link>}
                <Box><Button size="small" variant={sel?.id === p.id ? 'primary' : 'secondary'} onClick={() => show(p)}>Show this post to Blindspot</Button></Box>
              </Box>
            </CardBody></Card>
          ))}
        </Box>
        <Box minWidth="0px" display="flex" flexDirection="column" gap="spacing.5">
          {t ? <ThreadView thread={t} onChanged={() => setV((n) => n + 1)} /> : <Text color="surface.text.gray.muted">The founder's view appears when you pick a post.</Text>}
          {t && sel?.follow_up && !ptid && t.messages.some((m) => m.sender_role === 'agent' && m.policy.status === 'sent') && (
            <Box display="flex" flexDirection="column" gap="spacing.3" alignItems="flex-start">
              <Text size="small" color="surface.text.gray.muted">The reply is posted. The customer follows the private link and writes:</Text>
              <Text>{sel.follow_up.text}</Text>
              <Button onClick={writePrivately}>The customer writes privately</Button>
            </Box>
          )}
          {priv && (
            <Box display="flex" flexDirection="column" gap="spacing.3">
              <Heading size="medium">The private conversation</Heading>
              <ThreadView thread={priv} onChanged={() => setV((n) => n + 1)} />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
