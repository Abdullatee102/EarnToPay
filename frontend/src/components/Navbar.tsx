import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAccount, useChainId } from 'wagmi';
import { CHAIN_ID } from '../config/contracts';

export default function Navbar() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const isWrongNetwork = isConnected && chainId !== CHAIN_ID;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-icon">⚡</span>
          <span className="brand-name">EarnToPay</span>
        </NavLink>

        <button
          className={`hamburger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`navbar-links${menuOpen ? ' open' : ''}`}>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
            Home
          </NavLink>
          <NavLink to="/earn" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
            Earn
          </NavLink>
          <NavLink to="/pay" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
            Pay
          </NavLink>
          <NavLink to="/activity" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
            Activity
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
            Admin
          </NavLink>
        </div>

        <div className="navbar-right">
          {isWrongNetwork && (
            <span className="network-badge wrong">Wrong Network</span>
          )}
          {isConnected && !isWrongNetwork && (
            <span className="network-badge correct">Bohr Testnet</span>
          )}
          {/* Reown AppKit wallet button */}
          <appkit-button />
        </div>
      </div>
    </nav>
  );
}

