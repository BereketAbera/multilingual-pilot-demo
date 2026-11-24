// This screen is deliberately NOT enabled for translation. It is the "before" picture:
// hard-coded text, a date built by hand, a number glued to its unit, a sentence joined
// from pieces. The Handoff page lists the five steps that would enable it.

import { UnenabledNote } from '../../components/sample/SampleChrome';
import { usePlant } from '../../lib/plant';
import { usePageTitle } from '../../lib/usePageTitle';

const DELIVERIES = [
  { id: 'RC-26-0931', supplier: 'Greenhollow Farms', material: 'Fire-roasted tomatoes', qty: 1250.5, daysAgo: 0, status: 'Awaiting QC' },
  { id: 'RC-26-0930', supplier: 'Sable Ridge Dairy', material: 'Cream', qty: 480, daysAgo: 0, status: 'Accepted' },
  { id: 'RC-26-0929', supplier: 'Vega Dry Goods', material: 'Chickpeas, cooked', qty: 2000, daysAgo: 1, status: 'Accepted' },
  { id: 'RC-26-0928', supplier: 'Three Pines Kitchen Supply', material: 'Olive oil', qty: 920.75, daysAgo: 2, status: 'Rejected' },
];

function handBuiltDate(today: string, daysAgo: number): string {
  const date = new Date(Date.parse(today) - daysAgo * 24 * 60 * 60 * 1000);
  // The kind of code the pilot replaces: month/day/year, whatever the reader's language.
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}

export default function Receiving() {
  usePageTitle('Receiving');
  const plant = usePlant();
  // The fallback is the UTC date: one more thing the enabled screens no longer do by hand.
  const today = plant?.today ?? new Date().toISOString().slice(0, 10);
  const todayCount = DELIVERIES.filter((delivery) => delivery.daysAgo === 0).length;

  return (
    <>
      <UnenabledNote />

      <div className="mb-5">
        <h1 className="text-2xl">Receiving</h1>
        <p className="mt-1 text-muted">{todayCount + ' deliveries today'}</p>
      </div>

      <div className="scroll-x rounded-lg border border-line bg-white" tabIndex={0} role="region" aria-label="Receiving">
        <table className="w-full min-w-[44rem] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="th">Receipt no.</th>
              <th scope="col" className="th">Supplier</th>
              <th scope="col" className="th">Raw material</th>
              <th scope="col" className="th text-right">Quantity</th>
              <th scope="col" className="th">Received</th>
              <th scope="col" className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {DELIVERIES.map((delivery) => (
              <tr key={delivery.id} className="border-b border-line last:border-b-0">
                <th scope="row" className="td whitespace-nowrap text-left font-mono font-medium">{delivery.id}</th>
                <td className="td">{delivery.supplier}</td>
                <td className="td">{delivery.material}</td>
                <td className="td num">{delivery.qty.toFixed(1) + ' kg'}</td>
                <td className="td whitespace-nowrap" data-testid="hand-built-date">{handBuiltDate(today, delivery.daysAgo)}</td>
                <td className="td">{delivery.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
