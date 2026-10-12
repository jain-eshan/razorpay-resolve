import { forwardRef, useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import {
  ActivityIcon, AtSignIcon, Avatar, Badge, BellIcon, Box, ChevronDownIcon, ClipboardIcon, CodeSnippetIcon, CreditCardIcon, Drawer, DrawerBody, DrawerHeader, FileIcon, FileTextIcon, FlaskIcon, HomeIcon, IconButton, LinkIcon, MenuIcon, RadioIcon, RayIcon, RepeatIcon, SearchInput, SettingsIcon, SideNav, SideNavBody, SideNavFooter, SideNavLink, SideNavSection, Switch, TabNav, TabNavItem, TabNavItems, Text, TopNav, TopNavActions, TopNavBrand, TopNavContent, TrendingUpIcon, UnlockIcon, UsersIcon, useTheme, WalletIcon,
  Menu, MenuDivider, MenuHeader, MenuItem, MenuOverlay,
  type IconComponent,
} from '@razorpay/blade/components'
import { ACCOUNTS, signIn, useAccount, type AccountId } from '../lib/account'

// The shell copies the live Razorpay dashboard (web/DESIGN.md section 14). Everything Razorpay already ships is shown but inert: greyed, not clickable.
// Blindspot is one more product tab and two more nav sections. To add a screen, add an item to BLINDSPOT or PROOF below.
// Names follow Razorpay's own (researched 11 Oct 2026, web/DESIGN.md section 22): short nouns a merchant would use, no "incident", "scan" or "log".
// `also` lists other paths that light the same item: Integration covers its two steps, Build with AI and the go-live check.
// `only`: the item is in one account's menu. A shopping app has no subscription renewals and does not hear from customers through Blindspot (its own alert tools are its door),
// so the brand account's menu leaves those pages out. Pages of the brand account join its menu in the change that builds them.
type Item = { title: string; to: string; icon: IconComponent; also?: string[]; only?: AccountId }
const BLINDSPOT: Item[] = [
  { title: 'Overview', to: '/', icon: RayIcon, also: ['/ray', '/how-it-works'] },
  { title: 'Payment issues', to: '/incidents', icon: ActivityIcon, also: ['/scan', '/demo/incident'] },
  { title: 'Customer complaints', to: '/threads', icon: UsersIcon, also: ['/cases', '/chat-demo', '/help-demo', '/email-demo', '/ig-demo', '/public-demo'], only: 'kaksha' },
  { title: 'Unpaid access', to: '/access', icon: UnlockIcon, only: 'kaksha' },
  { title: 'Integration', to: '/connect', icon: CodeSnippetIcon, also: ['/release-check'], only: 'kaksha' },
]
const PROOF: Item[] = [
  { title: 'Connectors', to: '/channels', icon: RadioIcon, only: 'kaksha' },
  { title: 'Settings', to: '/settings', icon: SettingsIcon, only: 'kaksha' },
  { title: 'Alert tuning', to: '/learning', icon: TrendingUpIcon, only: 'kaksha' },
  { title: 'Audit trail', to: '/audit', icon: ClipboardIcon, only: 'kaksha' },
  { title: 'Accuracy', to: '/how', icon: FileTextIcon },
]

const CORE: [string, IconComponent][] = [['Home', HomeIcon], ['Transactions', RepeatIcon], ['Settlements', WalletIcon], ['Reports', FileTextIcon]]
const PAYMENT_PRODUCTS = ['Payment Links', 'Payment Pages', 'Razorpay.me Link', 'POS', 'Invoices', 'Payment Button', 'Affordability', 'QR Codes', 'Subscriptions', 'Smart Collect', 'Checkout Rewards', 'Konnect', 'Customer Trust', 'Optimizer']
const PRODUCT_ICONS: Record<string, IconComponent> = { 'Payment Links': LinkIcon, 'Payment Pages': FileIcon, 'Razorpay.me Link': AtSignIcon }

// Blade has no disabled nav link, so an inert one renders a plain span in the link's place.
const InertItem = styled(forwardRef<HTMLSpanElement, { children?: ReactNode; className?: string }>(({ children, className }, ref) => (
  <span ref={ref} className={className} aria-disabled="true" title="Part of the Razorpay dashboard, not in this prototype">{children}</span>
)))`
  opacity: 0.5;
  cursor: not-allowed;
`

// SideNav hides its collapsed-nav extras (the line after a section title, the short "+11" button) with a rule on its own container. The phone menu is not inside SideNav, so it needs the same rule.
// Blade's Box drops className, hence a plain wrapper. `display: contents` keeps it out of the layout.
const HideCollapsedExtras = styled.div`
  display: contents;
  .show-when-collapsed { display: none; }
`

// Production's product tabs. Blindspot is the only live one.
const TABS: ComponentProps<typeof TabNav>['items'] = [
  { title: 'Payments', icon: CreditCardIcon, as: InertItem },
  { title: 'Blindspot', icon: ActivityIcon, href: '/', as: Link, isActive: true, titleSuffix: <Badge size="small" color="positive">BETA</Badge> },
  { title: 'Banking+', icon: WalletIcon, as: InertItem },
  { title: 'Payroll', icon: UsersIcon, as: InertItem },
  { title: 'More', trailing: <ChevronDownIcon size="small" color="surface.icon.staticWhite.subtle" />, as: InertItem },
]

const noop = () => {}

// The avatar opens the account menu, as on the live dashboard: who you are signed in as, and the other demo account one tap away. Switching keeps you on Overview of the other account.
function AccountMenu() {
  const me = useAccount()
  const nav = useNavigate()
  const other = ACCOUNTS[me.id === 'kaksha' ? 'flipkart' : 'kaksha']
  return (
    <Menu>
      <Avatar name={me.name} size="small" testID="account-avatar" />
      <MenuOverlay>
        <MenuHeader title={me.name} subtitle={`${me.line} · ${me.mid}`} />
        <MenuItem title={`Switch to ${other.name}`} description={other.line} leading={<Avatar name={other.name} size="xsmall" />} onClick={() => { signIn(other.id); nav('/') }} />
        <MenuDivider />
        <MenuItem title="See both demo accounts" onClick={() => nav('/signin')} />
      </MenuOverlay>
    </Menu>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const me = useAccount()
  const mine = (i: Item) => !i.only || i.only === me.id
  const [open, setOpen] = useState(false)
  // The phone menu must not outlive the phone layout: widening the window past `m` closes it, as SideNav's own phone mode did.
  const { theme } = useTheme()
  useEffect(() => {
    const wide = window.matchMedia(`(min-width: ${theme.breakpoints.m}px)`)
    const close = (e: MediaQueryListEvent) => { if (e.matches) setOpen(false) }
    wide.addEventListener('change', close)
    return () => wide.removeEventListener('change', close)
  }, [theme.breakpoints.m])
  // A path matches a whole segment, so /how (Accuracy) does not light up on /how-it-works (reached from Overview).
  const at = (p: string) => pathname === p || pathname.startsWith(`${p}/`)
  const on = (i: Item) => (i.to === '/' ? pathname === '/' || (i.also ?? []).some(at) : [i.to, ...(i.also ?? [])].some(at))
  const link = (i: Item) => <SideNavLink key={i.to} title={i.title} icon={i.icon} href={i.to} isActive={on(i)} as={Link} onClick={() => setOpen(false)} />
  const inert = (title: string, icon: IconComponent) => <SideNavLink key={title} title={title} icon={icon} as={InertItem} />
  // One set of items, shown by the desktop SideNav (hidden below `m`) and by the phone menu below.
  // The phone menu is a plain Blade Drawer, not SideNav's own phone mode: that mode (SideNav given `onDismiss`) keeps two modal drawers mounted even while closed. Their focus managers hide the whole page from assistive technology, and fight over Tab when the menu is open. A Drawer mounts only while open.
  const nav = (
    <>
      <SideNavBody>
        <SideNavSection>{CORE.map(([t, i]) => inert(t, i))}</SideNavSection>
        <SideNavSection title="BLINDSPOT">{BLINDSPOT.filter(mine).map(link)}</SideNavSection>
        <SideNavSection title="CONTROL">{PROOF.filter(mine).map(link)}</SideNavSection>
        <SideNavSection title="PAYMENT PRODUCTS" maxVisibleItems={3}>{PAYMENT_PRODUCTS.map((t) => inert(t, PRODUCT_ICONS[t] ?? LinkIcon))}</SideNavSection>
      </SideNavBody>
      <SideNavFooter>
        <Box display="flex" alignItems="center" justifyContent="space-between" paddingX="spacing.4" paddingY="spacing.3" opacity={0.5}>
          <Box display="flex" alignItems="center" gap="spacing.4"><FlaskIcon size="medium" /><Text>Test Mode</Text></Box>
          <Switch accessibilityLabel="Test mode" isChecked isDisabled />
        </Box>
        {inert('Account & Settings', SettingsIcon)}
      </SideNavFooter>
    </>
  )
  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <TopNav>
        {/* Blade centres the brand with its own paddingY (16px) when the bar has no padding, and the bar adds 8px of padding below the m breakpoint, so the brand takes 8px there. */}
        <TopNavBrand paddingY={{ base: 'spacing.3', m: 'spacing.5' }}>
          <Box display="flex" alignItems="center" gap="spacing.4">
            <Box display={{ base: 'block', m: 'none' }}><IconButton icon={MenuIcon} accessibilityLabel="Open menu" onClick={() => setOpen(true)} /></Box>
            <Link to="/" aria-label="Razorpay home" style={{ display: 'flex', alignItems: 'center', gap: 'inherit', textDecoration: 'none', color: 'inherit' }}>
              {/* The official lockup, blue and white for the black bar, as the live dashboard shows it. A file, not Blade's single-colour glyph plus text: the real logo is one drawing with its own spacing. */}
              <img src="/razorpay-logo.svg" alt="" width="112" height="24" style={{ display: 'block' }} />
            </Link>
          </Box>
        </TopNavBrand>
        <TopNavContent>
          {/* Five tabs need about 570px beside the logo and the actions, so they show from l; at m the strip used to cut Payroll in half and hide More. */}
          <Box display={{ base: 'none', l: 'flex' }} width="100%" minWidth="0px" overflow="hidden">
            {/* Blade's TabNav unmounts tabs that overflow, and crashes if their size updates are still queued. All five tabs are always rendered instead. */}
            <TabNav items={TABS}>
              {() => (
                <TabNavItems>
                  {TABS.map(({ title, icon, href, as, isActive, trailing, titleSuffix }) => <TabNavItem key={title} title={title} icon={icon} href={href} as={as} isActive={isActive} trailing={trailing} titleSuffix={titleSuffix} />)}
                </TabNavItems>
              )}
            </TabNav>
          </Box>
        </TopNavContent>
        <TopNavActions>
          {/* Blade top-aligns the actions and sizes them around the 36px search field, so without it (below xl) they sit off centre. From m up the height is the search field's. Below m the actions must not make the bar's row taller than the brand (that pushes the brand down), so they take a 22px box, the avatar overflows it evenly, and 1px nudges it to centre. */}
          <Box display="flex" alignItems="center" gap="spacing.3" height={{ base: '22px', m: '36px' }} position="relative" top={{ base: '-1px', m: '0px' }}>
            <Box display={{ base: 'none', xl: 'block' }} width="360px"><SearchInput placeholder="Search payment products, settings, and more" accessibilityLabel="Search" isDisabled /></Box>
            <Box display={{ base: 'none', m: 'flex' }} gap="spacing.3">
              <IconButton icon={ActivityIcon} accessibilityLabel="Ecosystem health" isDisabled onClick={noop} />
              <IconButton icon={BellIcon} accessibilityLabel="Announcements" isDisabled onClick={noop} />
            </Box>
            <AccountMenu />
          </Box>
        </TopNavActions>
      </TopNav>
      <Box display="flex" flex="1" minHeight="0px">
        <SideNav position="relative">{nav}</SideNav>
        {children}
      </Box>
      <Drawer isOpen={open} onDismiss={() => setOpen(false)} accessibilityLabel="Main menu">
        <DrawerHeader title="Main Menu" />
        <DrawerBody>
          <HideCollapsedExtras>
            <Box display="flex" flexDirection="column" justifyContent="space-between" height="100%">{nav}</Box>
          </HideCollapsedExtras>
        </DrawerBody>
      </Drawer>
    </Box>
  )
}
