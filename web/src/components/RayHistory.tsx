import { Link } from 'react-router-dom'
import { Box, Drawer, DrawerBody, DrawerHeader, Text } from '@razorpay/blade/components'
import { chats } from '../lib/rayChats'
import { when } from '../lib/format'

// The list of Ray chats, opened from the hamburger in the chat rail or from "History" on the Overview. Razorpay's own Ray keeps its chats behind the same hamburger.
export function RayHistory({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const all = isOpen ? chats() : []
  return (
    <Drawer isOpen={isOpen} onDismiss={onClose} accessibilityLabel="Chat history">
      <DrawerHeader title="Chat history" />
      <DrawerBody>
        {all.length === 0 ? (
          <Text color="surface.text.gray.muted">No chats yet. Ask Ray something and it will be listed here. Chats are kept in this browser only.</Text>
        ) : (
          <Box display="flex" flexDirection="column" testID="ray-history">
            {all.map((c) => (
              <Link key={c.id} to={`/ray/${c.id}`} onClick={onClose} style={{ textDecoration: 'none' }}>
                <Box paddingY="spacing.4" display="flex" flexDirection="column" gap="spacing.1" borderBottomWidth="thin" borderBottomColor="surface.border.gray.subtle">
                  <Text weight="semibold" truncateAfterLines={2}>{c.turns[0].q}</Text>
                  <Text size="small" color="surface.text.gray.muted">{`${when(c.at)} · ${c.turns.length} question${c.turns.length === 1 ? '' : 's'}`}</Text>
                </Box>
              </Link>
            ))}
            <Box paddingTop="spacing.4"><Text size="small" color="surface.text.gray.muted">Chats are kept in this browser only.</Text></Box>
          </Box>
        )}
      </DrawerBody>
    </Drawer>
  )
}
