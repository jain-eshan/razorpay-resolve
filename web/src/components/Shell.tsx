import { forwardRef, useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import styled from 'styled-components'
import {
  ActivityIcon, AtSignIcon, Avatar, Badge, BellIcon, Box, ChevronDownIcon, ClipboardIcon, CreditCardIcon, Drawer, DrawerBody, DrawerHeader, FileIcon, FileTextIcon, FlaskIcon, HomeIcon, IconButton, LinkIcon, MenuIcon, RadioIcon, RayIcon, RepeatIcon, SearchIcon, SearchInput, SettingsIcon, SideNav, SideNavBody, SideNavFooter, SideNavLink, SideNavSection, Switch, TabNav, TabNavItem, TabNavItems, Text, TopNav, TopNavActions, TopNavBrand, TopNavContent, TrendingUpIcon, UsersIcon, useTheme, WalletIcon,
  type IconComponent,
} from '@razorpay/blade/components'

// The shell copies the live Razorpay dashboard (web/DESIGN.md section 14). Everything Razorpay already ships is shown but inert: greyed, not clickable.
// Blindspot is one more product tab and two more nav sections. To add a screen, add an item to BLINDSPOT or PROOF below.
type Item = { title: string; to: string; icon: IconComponent }
const BLINDSPOT: Item[] = [
  { title: 'Ray', to: '/', icon: RayIcon },
  { title: 'Incidents', to: '/incidents', icon: ActivityIcon },
  { title: 'Conversations', to: '/threads', icon: UsersIcon },
  { title: 'Channels', to: '/channels', icon: RadioIcon },
  { title: 'Day-0 scan', to: '/scan', icon: SearchIcon },
]
const PROOF: Item[] = [
  { title: 'Audit log', to: '/audit', icon: ClipboardIcon },
  { title: 'How we know', to: '/how', icon: FileTextIcon },
  { title: 'Learning', to: '/learning', icon: TrendingUpIcon },
  { title: 'Settings', to: '/settings', icon: SettingsIcon },
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

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  // The phone menu must not outlive the phone layout: widening the window past `m` closes it, as SideNav's own phone mode did.
  const { theme } = useTheme()
  useEffect(() => {
    const wide = window.matchMedia(`(min-width: ${theme.breakpoints.m}px)`)
    const close = (e: MediaQueryListEvent) => { if (e.matches) setOpen(false) }
    wide.addEventListener('change', close)
    return () => wide.removeEventListener('change', close)
  }, [theme.breakpoints.m])
  const on =(to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))
  const link = (i: Item) => <SideNavLink key={i.to} title={i.title} icon={i.icon} href={i.to} isActive={on(i.to)} as={Link} onClick={() => setOpen(false)} />
  const inert = (title: string, icon: IconComponent) => <SideNavLink key={title} title={title} icon={icon} as={InertItem} />
  // One set of items, shown by the desktop SideNav (hidden below `m`) and by the phone menu below.
  // The phone menu is a plain Blade Drawer, not SideNav's own phone mode: that mode (SideNav given `onDismiss`) keeps two modal drawers mounted even while closed. Their focus managers hide the whole page from assistive technology, and fight over Tab when the menu is open. A Drawer mounts only while open.
  const nav = (
    <>
      <SideNavBody>
        <SideNavSection>{CORE.map(([t, i]) => inert(t, i))}</SideNavSection>
        <SideNavSection title="BLINDSPOT">{BLINDSPOT.map(link)}</SideNavSection>
        <SideNavSection title="PROOF AND CONTROL">{PROOF.map(link)}</SideNavSection>
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
          <Box display={{ base: 'none', m: 'flex' }} width="100%" minWidth="0px" overflow="hidden">
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
            <Avatar name="Kaksha" size="small" />
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
