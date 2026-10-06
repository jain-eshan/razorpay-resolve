import { useNavigate } from 'react-router-dom'
import { Breadcrumb, BreadcrumbItem } from '@razorpay/blade/components'

// "Incidents / INC-1", like the dashboard's "Account & Settings / Webhooks". The last item is the current page.
export function Crumbs({ items }: { items: { label: string; to: string }[] }) {
  const nav = useNavigate()
  return (
    <Breadcrumb size="medium">
      {items.map((c, i) => (
        <BreadcrumbItem key={c.to} href={c.to} isCurrentPage={i === items.length - 1} onClick={(e) => { e.preventDefault(); nav(c.to) }}>{c.label}</BreadcrumbItem>
      ))}
    </Breadcrumb>
  )
}
