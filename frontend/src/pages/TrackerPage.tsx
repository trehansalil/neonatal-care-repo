import { PageContainer } from '../components/layout/PageContainer'
import { SpeechHero } from '../components/tracker/SpeechHero'
import { QuickAdd } from '../components/tracker/QuickAdd'
import { DashboardMetrics } from '../components/tracker/DashboardMetrics'
import { ActivityLog } from '../components/tracker/ActivityLog'
import { TrendChart } from '../components/tracker/TrendChart'
import { FeedModal } from '../components/tracker/modals/FeedModal'
import { SusuModal } from '../components/tracker/modals/SusuModal'
import { PotiModal } from '../components/tracker/modals/PotiModal'
import { TempModal } from '../components/tracker/modals/TempModal'
import { WeightModal } from '../components/tracker/modals/WeightModal'
import { SpeechLogModal } from '../components/tracker/modals/SpeechLogModal'
import { useAppStore } from '../store/appStore'

export function TrackerPage() {
  const { activeModal, closeModal, mobileTab } = useAppStore()

  return (
    <PageContainer>
      {/* Speech Hero - always visible */}
      <section className="mb-6">
        <SpeechHero />
      </section>

      {/* Quick Add - always visible */}
      <section className="mb-6">
        <QuickAdd />
      </section>

      {/* Desktop: show all sections. Mobile: tab-controlled */}
      <section className={`mb-6 ${mobileTab !== 'dashboard' ? 'hidden md:block' : ''}`}>
        <DashboardMetrics />
      </section>

      <section className={`mb-6 ${mobileTab !== 'log' ? 'hidden md:block' : ''}`}>
        <ActivityLog />
      </section>

      <section className={`mb-6 ${mobileTab !== 'trends' ? 'hidden md:block' : ''}`}>
        <TrendChart />
      </section>

      {/* Modals */}
      <FeedModal open={activeModal === 'feed'} onClose={closeModal} />
      <SusuModal open={activeModal === 'susu'} onClose={closeModal} />
      <PotiModal open={activeModal === 'poti'} onClose={closeModal} />
      <TempModal open={activeModal === 'temp'} onClose={closeModal} />
      <WeightModal open={activeModal === 'weight'} onClose={closeModal} />
      <SpeechLogModal open={activeModal === 'speechLog'} onClose={closeModal} />
    </PageContainer>
  )
}
