import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './landing';
import LifeSync from './LifeSync';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<LifeSync />} />
      </Routes>
    </BrowserRouter>
  );
}
