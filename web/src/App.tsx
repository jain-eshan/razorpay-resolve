import { NavLink, Route, Routes } from 'react-router-dom'
import { Box, RazorpayIcon, Text } from '@razorpay/blade/components'
import Audit from './routes/Audit'
import Case from './routes/Case'
import ChatDemo from './routes/ChatDemo'
import Channels from './routes/Channels'
import Dev from './routes/Dev'
import EmailDemo from './routes/EmailDemo'
import HelpDemo from './routes/HelpDemo'
import How from './routes/How'
import Incident from './routes/Incident'
import Incidents from './routes/Incidents'
import Ray from './routes/Ray'
import Reference from './routes/Reference'
import Scan from './routes/Scan'
import Settings from './routes/Settings'
import { ThreadPage, Threads } from './routes/Threads'

const NAV = [['/', 'RAY'], ['/incidents', 'Incidents'], ['/threads', 'Conversations'], ['/channels', 'Channels'], ['/scan', 'Day-0 scan'], ['/how', 'How we know'], ['/audit', 'Audit'], ['/settings', 'Settings']] as const

export default function App() {
  return (
    <Box backgroundColor="surface.background.gray.moderate" minHeight="100vh">
      <Box display="flex" alignItems="center" gap="spacing.5" flexWrap="wrap" paddingX={{ base: 'spacing.5', m: 'spacing.9' }} paddingY="spacing.5">
        <Box display="flex" alignItems="center" gap="spacing.3">
          <RazorpayIcon size="large" color="interactive.icon.primary.normal" />
          <Text weight="semibold">Blindspot</Text>
        </Box>
        <Box display="flex" gap="spacing.5" flexWrap="wrap" as="nav">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({ textDecoration: 'none', fontWeight: isActive ? 600 : 400 })}>
              <Text color="interactive.text.primary.normal">{label}</Text>
            </NavLink>
          ))}
        </Box>
      </Box>
      <Box maxWidth="1080px" marginX="auto" paddingX={{ base: 'spacing.5', m: 'spacing.9' }} paddingBottom="spacing.11">
        <Routes>
          <Route path="/" element={<Ray />} />
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
          <Route path="/audit" element={<Audit />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/how" element={<How />} />
          <Route path="/reference" element={<Reference />} />
        </Routes>
      </Box>
    </Box>
  )
}
