import { ActionList, ActionListItem, Dropdown, DropdownButton, DropdownOverlay } from '@razorpay/blade/components'

// A one-of-few picker in the dashboard's own style: a button that shows "Label: choice" and opens a list (Blade's Dropdown with a DropdownButton trigger).
// Blade says a form-field select (SelectInput) is for more than 5 options in a form, and a button trigger is for a filter on a page like these.
export function MenuPick<T extends string>({ label, value, options, onPick, size = 'medium', isDisabled = false }: { label?: string; value: T; options: readonly { id: T; label: string }[]; onPick: (id: T) => void; size?: 'small' | 'medium'; isDisabled?: boolean }) {
  const current = options.find((o) => o.id === value)?.label ?? ''
  return (
    <Dropdown>
      <DropdownButton variant="secondary" size={size} isDisabled={isDisabled}>{label ? `${label}: ${current}` : current}</DropdownButton>
      <DropdownOverlay>
        <ActionList>
          {options.map((o) => <ActionListItem key={o.id} title={o.label} value={o.id} isSelected={o.id === value} onClick={() => onPick(o.id)} />)}
        </ActionList>
      </DropdownOverlay>
    </Dropdown>
  )
}
