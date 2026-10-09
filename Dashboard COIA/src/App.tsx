import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { OverviewPage } from '@/pages/OverviewPage';
import { PipelinePage } from '@/pages/PipelinePage';
import { ErrorsPage } from '@/pages/ErrorsPage';
import { LearningPage } from '@/pages/LearningPage';
import { DecisionsPage } from '@/pages/DecisionsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/erros" element={<ErrorsPage />} />
          <Route path="/aprendizado" element={<LearningPage />} />
          <Route path="/decisoes" element={<DecisionsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
