import { ArticleLayout } from '../components/education/ArticleLayout'
import { AccordionSection } from '../components/education/AccordionSection'

export default function HandExpressionPage() {
  return (
    <ArticleLayout
      title="Manual Expression of Human Milk"
      subtitle="A comprehensive guide to hand pumping techniques, benefits, and protocols"
      backTo="/supply-strategies"
      backLabel="Supply Tips"
    >
      {/* 1. Introduction */}
      <AccordionSection number={1} title="Introduction" defaultOpen>
        <p>
          Hand expression is one of the most valuable skills a breastfeeding mother can learn. It
          requires no equipment, can be done anywhere, and is often{' '}
          <strong>superior to pumping for colostrum collection</strong> in the first few days after
          birth when volumes are small.
        </p>
        <p>
          The physical touch of hand expression activates the <strong>oxytocin response</strong> more
          effectively than a mechanical pump, leading to a stronger let-down reflex and often more
          complete breast emptying.
        </p>
        <p>
          Learning this skill also provides a backup method if you are ever separated from your pump,
          experience a power outage, or need to relieve engorgement quickly.
        </p>
      </AccordionSection>

      {/* 2. Anatomy & Physiology */}
      <AccordionSection number={2} title="Anatomy &amp; Physiology">
        <div className="space-y-4">
          <div className="bg-primary-50 rounded-lg p-4">
            <h4 className="font-bold text-dark">Glandular Architecture</h4>
            <p className="text-muted mt-1">
              Milk is produced in clusters of cells called <strong>alveoli</strong>, which are
              surrounded by <strong>myoepithelial cells</strong>. When these muscle-like cells
              contract (triggered by oxytocin), milk is squeezed from the alveoli into the duct
              system toward the nipple.
            </p>
          </div>

          <div className="bg-primary-50 rounded-lg p-4">
            <h4 className="font-bold text-dark">Hormonal Control</h4>
            <p className="text-muted mt-1">
              Two hormones drive lactation: <strong>Prolactin</strong> stimulates the alveoli to
              produce milk (primarily during and after feeding), while <strong>Oxytocin</strong>{' '}
              causes the myoepithelial cells to contract and eject milk (the &ldquo;let-down&rdquo;
              reflex). Stress inhibits oxytocin; relaxation promotes it.
            </p>
          </div>
        </div>
      </AccordionSection>

      {/* 3. The Marmet Technique */}
      <AccordionSection number={3} title="The Marmet Technique">
        <p>
          Developed by Chele Marmet, this is the most widely taught method of hand expression.
        </p>

        <div className="space-y-4 mt-3">
          <div>
            <h4 className="font-bold text-dark">1. Preparation</h4>
            <p className="text-muted mt-1">
              Apply a <strong>warm compress</strong> for 2&ndash;3 minutes to dilate milk ducts.
              Gently massage the breast in circular motions from the outer edge toward the nipple.
              Relax your shoulders and take a few deep breaths.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-dark">2. The C Hold</h4>
            <p className="text-muted mt-1">
              Place your <strong>thumb above</strong> and <strong>fingers below</strong> the nipple,
              approximately <strong>1&ndash;1.5 inches behind the nipple</strong>, forming a C shape.
              The pads of the thumb and fingers should be positioned over the milk sinuses (you may
              feel a slight change in texture).
            </p>
          </div>

          <div>
            <h4 className="font-bold text-dark">3. The Three-Step Cycle</h4>
            <ol className="list-decimal pl-5 text-muted mt-1 space-y-1">
              <li>
                <strong>Position:</strong> Press back toward the chest wall.
              </li>
              <li>
                <strong>Compress:</strong> Roll thumb and fingers together (do not slide on skin).
              </li>
              <li>
                <strong>Release:</strong> Relax pressure completely before repeating.
              </li>
            </ol>
            <p className="text-muted mt-2">
              Maintain a rhythm of approximately <strong>1 cycle per second</strong>. The motion
              should be rhythmic and painless.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-dark">4. Rotation</h4>
            <p className="text-muted mt-1">
              After several minutes, <strong>shift your hand position</strong> around the breast
              (rotate every few minutes) to drain all areas evenly. Think of the hand moving like
              the hands of a clock.
            </p>
          </div>
        </div>
      </AccordionSection>

      {/* 4. Clinical Indications */}
      <AccordionSection number={4} title="Clinical Indications">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Colostrum collection (days 1&ndash;3):</strong> Hand expression is more effective
            than pumping for the thick, small-volume colostrum produced in the first days. Collecting
            even a few drops is valuable for the baby&rsquo;s immune system.
          </li>
          <li>
            <strong>Relieving engorgement:</strong> When breasts are overfull and too firm for the
            baby to latch, expressing a small amount softens the areola and makes latching possible.
          </li>
          <li>
            <strong>Maintaining supply when separated:</strong> If you are away from your baby or
            your baby is in the NICU, regular hand expression keeps the supply-and-demand cycle
            active.
          </li>
        </ul>
      </AccordionSection>

      {/* 5. Increasing Milk Supply */}
      <AccordionSection number={5} title="Increasing Milk Supply">
        <div className="space-y-4">
          <div>
            <h4 className="font-bold text-dark">Cluster Expression</h4>
            <p className="text-muted mt-1">
              Mimic the pattern of cluster feeding by expressing multiple times within a short
              window (e.g., every 30 minutes for 2&ndash;3 hours). This sends a strong signal to
              increase production.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-dark">Power Expression</h4>
            <p className="text-muted mt-1">
              Follow the same pattern as power pumping, adapted for hand expression:
            </p>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-primary-50 text-left">
                    <th className="px-4 py-2 font-semibold text-dark">Activity</th>
                    <th className="px-4 py-2 font-semibold text-dark">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="px-4 py-2">Express</td>
                    <td className="px-4 py-2 font-medium">20 minutes</td>
                  </tr>
                  <tr className="border-t border-border bg-primary-50/30">
                    <td className="px-4 py-2">Rest</td>
                    <td className="px-4 py-2 font-medium">10 minutes</td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-4 py-2">Express</td>
                    <td className="px-4 py-2 font-medium">10 minutes</td>
                  </tr>
                  <tr className="border-t border-border bg-primary-50/30">
                    <td className="px-4 py-2">Rest</td>
                    <td className="px-4 py-2 font-medium">10 minutes</td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-4 py-2">Express</td>
                    <td className="px-4 py-2 font-medium">10 minutes</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* 6. Hygiene & Storage */}
      <AccordionSection number={6} title="Hygiene &amp; Storage">
        <p>
          Always <strong>wash hands thoroughly</strong> before expressing. Use clean, food-grade
          containers with tight-fitting lids.
        </p>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-primary-50 text-left">
                <th className="px-4 py-2 font-semibold text-dark">Storage Location</th>
                <th className="px-4 py-2 font-semibold text-dark">Duration</th>
                <th className="px-4 py-2 font-semibold text-dark">Temperature</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-4 py-2">Room temperature</td>
                <td className="px-4 py-2 font-medium">4 hours</td>
                <td className="px-4 py-2 text-muted">up to 25&deg;C / 77&deg;F</td>
              </tr>
              <tr className="border-t border-border bg-primary-50/30">
                <td className="px-4 py-2">Refrigerator</td>
                <td className="px-4 py-2 font-medium">4 days</td>
                <td className="px-4 py-2 text-muted">4&deg;C / 39&deg;F</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-4 py-2">Freezer</td>
                <td className="px-4 py-2 font-medium">4 months</td>
                <td className="px-4 py-2 text-muted">&minus;18&deg;C / 0&deg;F</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-muted mt-2">
          Remember the <strong>Rule of 4s</strong>: 4 hours, 4 days, 4 months.
        </p>
      </AccordionSection>

      {/* 7. Troubleshooting */}
      <AccordionSection number={7} title="Troubleshooting">
        <div className="space-y-4">
          <div className="bg-accent-50 border border-accent-300 rounded-lg p-4">
            <h4 className="font-bold text-dark">&ldquo;No milk comes out&rdquo;</h4>
            <p className="text-muted mt-1">
              This is <strong>completely normal</strong> the first few times you try. Your body
              needs to learn to respond to hand stimulation. Try expressing after a warm shower
              when you are relaxed, or while looking at or smelling your baby. It may take several
              sessions before you see results.
            </p>
          </div>

          <div className="bg-accent-50 border border-accent-300 rounded-lg p-4">
            <h4 className="font-bold text-dark">Pain during expression</h4>
            <p className="text-muted mt-1">
              Hand expression should <strong>not hurt</strong>. If you experience pain, your grip
              may be too tight, your fingers too close to the nipple, or you may be sliding on the
              skin instead of rolling. Adjust your technique, and if pain persists, seek help from
              a lactation consultant.
            </p>
          </div>
        </div>
      </AccordionSection>
    </ArticleLayout>
  )
}
