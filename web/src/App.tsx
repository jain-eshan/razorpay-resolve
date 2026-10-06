import { Route, Routes } from 'react-router-dom'
import { Box, RazorpayIcon, Text } from '@razorpay/blade/components'
import Incident from './routes/Incident'
import Incidents from './routes/Incidents'
import Reference from './routes/Reference'

export default function App() {
  return (
    <Box backgroundColor="surface.background.gray.moderate" minHeight="100vh">
      <Box display="flex" alignItems="center" gap="spacing.3" paddingX={{ base: 'spacing.5', m: 'spacing.9' }} paddingY="spacing.5">
        <RazorpayIcon size="large" color="interactive.icon.primary.normal" />
        <Text weight="semibold">Blindspot</Text>
      </Box>
      <Box maxWidth="1080px" marginX="auto" paddingX={{ base: 'spacing.5', m: 'spacing.9' }} paddingBottom="spacing.11">
        <Routes>
          <Route path="/" element={<Incidents />} />
          <Route path="/incidents/:id" element={<Incident />} />
          <Route path="/reference" element={<Reference />} />
        </Routes>
      </Box>
    </Box>
  )
}
