import { LiabilityDetailScreen } from './_components/liability-detail-screen'

export default async function PassivoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <LiabilityDetailScreen liabilityId={id} />
}
