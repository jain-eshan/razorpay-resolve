import { useEffect, type ReactNode } from 'react'
import { Mine } from './components/Mine'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Alert, Box } from '@razorpay/blade/components'
import { pickerDue, signIn, useAccount } from './lib/account'
import { Shell } from './components/Shell'
import Audit from './routes/Audit'
import BrandAlerts from './routes/BrandAlerts'
import BrandAudit from './routes/BrandAudit'
import BrandConnectors from './routes/BrandConnectors'
import BrandSettings, { BrandIntegration } from './routes/BrandSettings'
import Case from './routes/Case'
import ChatDemo from './routes/ChatDemo'
import Channels from './routes/Channels'
import Dev from './routes/Dev'
import EmailDemo from './routes/EmailDemo'
import HelpDemo from './routes/HelpDemo'
import IgDemo from './routes/IgDemo'
import How from './routes/How'
import HowItWorks from './routes/HowItWorks'
import Incident from './routes/Incident'
import Incidents from './routes/Incidents'
import GuidePage from './routes/GuidePage'
import Home from './routes/Home'
import Leakage from './routes/Leakage'
import ReleaseCheck from './routes/ReleaseCheck'
import Connect from './routes/Connect'
import Learning from './routes/Learning'
import PublicDemo from './routes/PublicDemo'
import RayChat from './routes/RayChat'
import Reference from './routes/Reference'
import Scan from './routes/Scan'
import Settings from './routes/Settings'
import Setup from './routes/Setup'
import SignIn from './routes/SignIn'
import { ThreadPage, Threads } from './routes/Threads'

const K = (el: ReactNode) => <Mine only="kaksha">{el}</Mine>

// The four screens of the first big-brand demo became the brand account's own pages. Old links land on its open payment issue.
function ToBrandIssue() {
  useEffect(() => signIn('flipkart'), [])
  return <Navigate to="/incidents/FK-1" replace />
}

// The shell follows the Razorpay dashboard (components/Shell.tsx, web/DESIGN.md section 14): Razorpay's own top bar with Blindspot as one more product tab, and a side nav where everything Razorpay ships is shown inert and Blindspot is added.
export default function App() {
  // Ray's chat page is full width with its own rail, like Razorpay's Ray page: no page container.
  const { pathname } = useLocation()
  const me = useAccount()
  const chat = pathname.startsWith('/ray')
  // Pages both accounts have, built for each: the brand's version or Kaksha's on the same path.
  const brand = me.kind === 'enterprise'
  // The account picker is the way in: a first visit to Overview opens it. It sits outside the dashboard shell.
  if (pathname === '/signin') return <SignIn />
  if (pathname === '/' && pickerDue()) return <Navigate to="/signin" replace />
  return (
    <Shell>
        <Box flex="1" overflow="auto" minWidth="0px" backgroundColor="surface.background.gray.moderate" testID="scroller">
          {/* A plain <main>: Blade's Box does not take an element type, and screen readers need one main region per page to jump to. */}
          {/* On Ray's chat page the main region fills the screen, so the rail runs the full height and the input can sit at the bottom. */}
          <main style={chat ? { minHeight: '100%', display: 'flex', flexDirection: 'column' } : undefined}>
          <Alert color="neutral" isFullWidth isDismissible={false} description={me.kind === 'enterprise'
            ? `Demo account. ${me.name}'s customers, payments and incidents here are made up. This is not the real ${me.name}.`
            : `Demo account. ${me.name}, its customers and every payment here are made up.`} />
          {chat ? (
            <Routes>
              <Route path="/ray" element={K(<RayChat />)} />
              <Route path="/ray/:id" element={K(<RayChat />)} />
            </Routes>
          ) : (
          <Box maxWidth="1120px" marginX="auto" testID="page" padding={{ base: 'spacing.5', m: 'spacing.7' }} paddingBottom="spacing.11">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/guides/:id" element={K(<GuidePage />)} />
              <Route path="/setup" element={K(<Setup />)} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/incidents/:id" element={<Incident />} />
              <Route path="/incidents/:id/dev" element={K(<Dev />)} />
              <Route path="/demo/*" element={<ToBrandIssue />} />
              <Route path="/scan" element={K(<Scan />)} />
              <Route path="/access" element={K(<Leakage />)} />
              <Route path="/release-check" element={K(<ReleaseCheck />)} />
              <Route path="/connect" element={brand ? <BrandIntegration /> : <Connect />} />
              <Route path="/alerts" element={<Mine only="flipkart"><BrandAlerts /></Mine>} />
              <Route path="/threads" element={K(<Threads />)} />
              <Route path="/threads/:id" element={K(<ThreadPage />)} />
              <Route path="/cases/:id" element={K(<Case />)} />
              <Route path="/channels" element={brand ? <BrandConnectors /> : <Channels />} />
              <Route path="/chat-demo" element={K(<ChatDemo />)} />
              <Route path="/help-demo/:surface" element={K(<HelpDemo />)} />
              <Route path="/email-demo" element={K(<EmailDemo />)} />
              <Route path="/ig-demo" element={K(<IgDemo />)} />
              <Route path="/public-demo" element={K(<PublicDemo />)} />
              <Route path="/audit" element={brand ? <BrandAudit /> : <Audit />} />
              <Route path="/settings" element={brand ? <BrandSettings /> : <Settings />} />
              <Route path="/how" element={K(<How />)} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/learning" element={K(<Learning />)} />
              <Route path="/reference" element={<Reference />} />
            </Routes>
          </Box>
          )}
          </main>
        </Box>
    </Shell>
  )
}
