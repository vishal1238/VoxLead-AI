import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import VoiceAgent from './pages/VoiceAgent';
import LeadsCRM from './pages/LeadsCRM';
import Appointments from './pages/Appointments';
import KnowledgeBase from './pages/KnowledgeBase';
import CallHistory from './pages/CallHistory';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/voice-agent" element={<VoiceAgent />} />
          <Route path="/leads" element={<LeadsCRM />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/calls" element={<CallHistory />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
