import { Route, Routes } from 'react-router-dom'
import { Alert, Box } from '@razorpay/blade/components'
import { Shell } from './components/Shell'
import Audit from './routes/Audit'
import Case from './routes/Case'
import ChatDemo from './routes/ChatDemo'
import Channels from './routes/Channels'
import Dev from './routes/Dev'
import EmailDemo from './routes/EmailDemo'
import HelpDemo from './routes/HelpDemo'
import IgDemo from './routes/IgDemo'
import How from './routes/How'
import Incident from './routes/Incident'
import Incidents from './routes/Incidents'
import GuidePage from './routes/GuidePage'
import Home from './routes/Home'
import Learning from './routes/Learning'
import PublicDemo from './routes/PublicDemo'
import Reference from './routes/Reference'
import Scan from './routes/Scan'
import Settings from './routes/Settings'
import Setup from './routes/Setup'
import { ThreadPage, Threads } from './routes/Threads'

// The shell follows the Razorpay dashboard (components/Shell.tsx, web/DESIGN.md section 14): Razorpay's own top bar with Blindspot as one more product tab, and a side nav where everything Razorpay ships is shown inert and Blindspot is added.
export default function App() {
  return (
    <Shell>
        <Box flex="1" overflow="auto" minWidth="0px" backgroundColor="surface.background.gray.moderate">
          <Alert color="neutral" isFullWidth isDismissible={false} description="Synthetic data. The merchant (Kaksha), its customers and every payment here are fictional." />
          <Box maxWidth="1120px" marginX="auto" testID="page" padding={{ base: 'spacing.5', m: 'spacing.7' }} paddingBottom="spacing.11">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/guides/:id" element={<GuidePage />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/incidents/:id" element={<Incident />} />
              <Route path="/incidents/:id/dev" element={<Dev />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/threads" element={<Threads />} />
              <Route path="/threads/:id" element={<ThreadPage />} />
              <Route path="/cases/:id" element={<Case />} />
              <Route path="/channels" element={<Channels />} />
              <Route path="/chat-demo" element={<ChatDemo />} />
              <Route path="/help-demo/:surface" element={<HelpDemo />} />
              <Route path="/email-demo" element={<EmailDemo />} />
              <Route path="/ig-demo" element={<IgDemo />} />
              <Route path="/public-demo" element={<PublicDemo />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/how" element={<How />} />
              <Route path="/learning" element={<Learning />} />
              <Route path="/reference" element={<Reference />} />
            </Routes>
          </Box>
        </Box>
    </Shell>
  )
}
