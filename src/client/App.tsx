import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@client/components/AppLayout';
import { CatalogPage } from '@client/pages/CatalogPage';
import { DetailPage } from '@client/pages/DetailPage';

export function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/agents/:id" element={<DetailPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
