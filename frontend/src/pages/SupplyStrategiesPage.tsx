import { Link } from 'react-router-dom'
import { ArticleLayout } from '../components/education/ArticleLayout'
import { AccordionSection } from '../components/education/AccordionSection'

export default function SupplyStrategiesPage() {
  return (
    <ArticleLayout
      title="Evidence-Based Strategies to Increase Supply"
      subtitle="Proven methods to support lactation and infant nutrition"
      backTo="/"
      backLabel="Home"
    >
      {/* 1. Optimize Supply and Demand */}
      <AccordionSection number={1} title='Optimize "Supply and Demand"' defaultOpen>
        <p>
          Breast milk production follows a simple rule: the more milk removed, the more milk produced.
          Optimizing this feedback loop is the single most effective strategy.
        </p>

        <div className="space-y-4 mt-3">
          <div className="bg-primary-50 rounded-lg p-4">
            <h4 className="font-bold text-dark">Increase Frequency</h4>
            <p className="text-muted mt-1">
              Aim for <strong>8&ndash;12 feedings per 24 hours</strong>, including at least one
              overnight session when prolactin levels are highest.
            </p>
          </div>

          <div className="bg-primary-50 rounded-lg p-4">
            <h4 className="font-bold text-dark">Empty Completely</h4>
            <p className="text-muted mt-1">
              Pump or hand-express for 5&ndash;10 minutes after each feed to signal the body
              that more milk is needed.
            </p>
          </div>

          <div className="bg-primary-50 rounded-lg p-4">
            <h4 className="font-bold text-dark">Switch Nursing</h4>
            <p className="text-muted mt-1">
              Alternate breasts multiple times during a single feeding session to keep the baby
              actively suckling and stimulate both sides.
            </p>
          </div>
        </div>
      </AccordionSection>

      {/* 2. Power Pumping */}
      <AccordionSection number={2} title="Power Pumping">
        <p>
          Power pumping mimics cluster feeding to send a strong signal to your body to increase
          production. Dedicate one hour per day, ideally at the same time each day.
        </p>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-primary-50 text-left">
                <th className="px-4 py-2 font-semibold text-dark">Activity</th>
                <th className="px-4 py-2 font-semibold text-dark">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-4 py-2">Pump</td>
                <td className="px-4 py-2 font-medium">20 minutes</td>
              </tr>
              <tr className="border-t border-border bg-primary-50/30">
                <td className="px-4 py-2">Rest</td>
                <td className="px-4 py-2 font-medium">10 minutes</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-2">Pump</td>
                <td className="px-4 py-2 font-medium">10 minutes</td>
              </tr>
              <tr className="border-t border-border bg-primary-50/30">
                <td className="px-4 py-2">Rest</td>
                <td className="px-4 py-2 font-medium">10 minutes</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-2">Pump</td>
                <td className="px-4 py-2 font-medium">10 minutes</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-muted mt-2">
          Most mothers see results within 3&ndash;5 days of consistent power pumping.
        </p>
      </AccordionSection>

      {/* 3. Maternal Nutrition */}
      <AccordionSection number={3} title="Maternal Nutrition">
        <p>What you eat and drink directly impacts milk production.</p>

        <ul className="list-disc pl-5 space-y-2 mt-3">
          <li>
            <strong>Hydration:</strong> Drink <strong>3&ndash;4 liters of water</strong> daily.
            Keep a bottle at every feeding station.
          </li>
          <li>
            <strong>Oats &amp; whole grains:</strong> Rich in iron and saponins, which may support
            prolactin production.
          </li>
          <li>
            <strong>Adequate calories:</strong> Breastfeeding requires an additional{' '}
            <strong>500+ calories per day</strong> above your baseline needs.
          </li>
          <li>
            <strong>Lactogenic foods:</strong> Dark leafy greens, garlic, sesame seeds, and
            fennel have traditional galactagogue properties.
          </li>
        </ul>
      </AccordionSection>

      {/* 4. Supplements Warning */}
      <AccordionSection number={4} title="Supplements &mdash; Proceed with Caution">
        <div className="bg-accent-50 border border-accent-300 rounded-lg p-4">
          <p className="font-semibold text-dark">&#9888; Fenugreek Warning</p>
          <p className="text-muted mt-1">
            While commonly recommended, fenugreek can <strong>decrease supply</strong> in some
            mothers, especially those with thyroid conditions. Always start with a low dose and
            monitor carefully.
          </p>
        </div>

        <div className="bg-primary-50 rounded-lg p-4 mt-3">
          <p className="font-semibold text-dark">Prescription Galactagogues</p>
          <p className="text-muted mt-1">
            <strong>Domperidone</strong> and <strong>metoclopramide</strong> are sometimes used
            to increase prolactin levels but require a doctor&rsquo;s prescription and ongoing
            monitoring due to potential side effects.
          </p>
        </div>
      </AccordionSection>

      {/* 5. Mechanical Boosters */}
      <AccordionSection number={5} title="Mechanical Boosters">
        <div className="space-y-4">
          <div>
            <h4 className="font-bold text-dark">Breast Compression During Feeds</h4>
            <p className="text-muted mt-1">
              Gently compress the breast while the baby is nursing to increase milk flow and
              encourage active swallowing. This technique can add 20&ndash;30% more milk per session.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-dark">Skin-to-Skin Contact</h4>
            <p className="text-muted mt-1">
              Holding the baby skin-to-skin triggers oxytocin release, which aids the let-down
              reflex. Aim for at least 1&ndash;2 hours of skin-to-skin daily, especially in
              the early weeks.
            </p>
          </div>
        </div>
      </AccordionSection>

      {/* 6. When to Seek Help */}
      <AccordionSection number={6} title="When to Seek Help">
        <p>
          Contact a lactation consultant or healthcare provider if you notice any of the following:
        </p>

        <ul className="mt-3 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">&#9632;</span>
            Baby is not gaining weight as expected
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">&#9632;</span>
            Fewer than 6 wet diapers per day after day 4
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">&#9632;</span>
            Persistent pain during or after breastfeeding
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">&#9632;</span>
            Signs of mastitis: redness, warmth, fever, or flu-like symptoms
          </li>
        </ul>

        <div className="mt-4">
          <Link
            to="/hand-expression"
            className="inline-flex items-center gap-1.5 text-primary-500 font-semibold hover:underline"
          >
            Learn hand expression techniques &rarr;
          </Link>
        </div>
      </AccordionSection>
    </ArticleLayout>
  )
}
