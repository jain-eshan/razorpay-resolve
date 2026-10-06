import { useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import {
  ActivityIcon, Alert, Avatar, BarChartIcon, Box, FileTextIcon, IconButton, MenuIcon, MessageCircleIcon, RadioIcon, RazorpayIcon, SearchIcon, SettingsIcon, SideNav, SideNavBody, SideNavFooter, SideNavLink, SideNavSection, Text, TopNav, TopNavActions, TopNavBrand, TopNavContent,
  UsersIcon, type IconComponent,
} from '@razorpay/blade/components'
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

type Item = { title: string; to: string; icon: IconComponent }
const WORK: Item[] = [
  { title: 'RAY', to: '/', icon: MessageCircleIcon },
  { title: 'Incidents', to: '/incidents', icon: ActivityIcon },
  { title: 'Conversations', to: '/threads', icon: UsersIcon },
  { title: 'Channels', to: '/channels', icon: RadioIcon },
  { title: 'Day-0 scan', to: '/scan', icon: SearchIcon },
]
const PROOF: Item[] = [
  { title: 'Audit log', to: '/audit', icon: FileTextIcon },
  { title: 'How we know', to: '/how', icon: BarChartIcon },
]

// The shell follows the Razorpay dashboard: Razorpay's own black top bar (Blindspot is one section in the side nav, like any other Razorpay product), a side nav with icons, and the page on a light panel (web/DESIGN.md section 13).
export default function App() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const on = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))
  const link = (i: Item) => (
    <SideNavLink key={i.to} title={i.title} icon={i.icon} href={i.to} isActive={on(i.to)} as={Link} onClick={() => setOpen(false)} />
  )
  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <TopNav>
        <TopNavBrand>
          <Box display="flex" alignItems="center" gap="spacing.4">
            <Box display={{ base: 'block', m: 'none' }}><IconButton icon={MenuIcon} accessibilityLabel="Open menu" onClick={() => setOpen(true)} /></Box>
            <Link to="/" aria-label="Razorpay home" style={{ display: 'flex', alignItems: 'center', gap: 'inherit', textDecoration: 'none', color: 'inherit' }}>
              <RazorpayIcon size="xlarge" />
              <Text size="large" weight="semibold">Razorpay</Text>
            </Link>
          </Box>
        </TopNavBrand>
        <TopNavContent><Box /></TopNavContent>
        <TopNavActions><Avatar name="Kaksha" size="small" /></TopNavActions>
      </TopNav>
      <Box display="flex" flex="1" minHeight="0px">
        <SideNav isOpen={open} onDismiss={() => setOpen(false)} position="relative">
          <SideNavBody>
            <SideNavSection title="BLINDSPOT">{WORK.map(link)}</SideNavSection>
            <SideNavSection title="PROOF AND CONTROL">{PROOF.map(link)}</SideNavSection>
          </SideNavBody>
          <SideNavFooter>{link({ title: 'Settings', to: '/settings', icon: SettingsIcon })}</SideNavFooter>
        </SideNav>
        <Box flex="1" overflow="auto" minWidth="0px" backgroundColor="surface.background.gray.moderate">
          <Alert color="neutral" isFullWidth isDismissible={false} description="Synthetic data. The merchant (Kaksha), its customers and every payment here are fictional." />
          <Box maxWidth="1120px" marginX="auto" padding={{ base: 'spacing.5', m: 'spacing.7' }} paddingBottom="spacing.11">
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
      </Box>
    </Box>
  )
}
