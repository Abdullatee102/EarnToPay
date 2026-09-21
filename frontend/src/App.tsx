import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Earn from './pages/Earn';
import Pay from './pages/Pay';
import Activity from './pages/Activity';
import Admin from './pages/Admin';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/earn" element={<Earn />} />
            <Route path="/pay" element={<Pay />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
