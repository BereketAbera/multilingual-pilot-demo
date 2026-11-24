import { Navigate, Route, Routes } from 'react-router';
import { Shell } from './components/Shell';
import { I18nProvider } from './i18n';
import { PlantProvider } from './lib/plant';
import Receiving from './screens/not-enabled/Receiving';
import Lot, { DEFAULT_LOT } from './screens/pilot/Lot';
import NotFound from './screens/pilot/NotFound';
import Orders from './screens/pilot/Orders';
import RecordOutput from './screens/pilot/RecordOutput';
import Handoff from './screens/sample/Handoff';
import Home from './screens/sample/Home';
import TranslationStatus from './screens/sample/TranslationStatus';

export function App() {
  return (
    <I18nProvider>
      <PlantProvider>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="orders" element={<Orders />} />
            <Route path="lots" element={<Navigate to={`/lots/${DEFAULT_LOT}`} replace />} />
            <Route path="lots/:code" element={<Lot />} />
            <Route path="record-output" element={<RecordOutput />} />
            <Route path="receiving" element={<Receiving />} />
            <Route path="translation-status" element={<TranslationStatus />} />
            <Route path="handoff" element={<Handoff />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </PlantProvider>
    </I18nProvider>
  );
}
