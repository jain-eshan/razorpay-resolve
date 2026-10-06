import { Card, CardBody, Heading, Text } from '@razorpay/blade/components'

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <Text size="small" color="surface.text.gray.muted">{label}</Text>
        <Heading size="large">{value}</Heading>
      </CardBody>
    </Card>
  )
}
