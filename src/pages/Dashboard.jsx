import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { FeedTicker } from "../components/LiveFeed";
import LivePage from "./LivePage";
import CandidatsPanel from "./CandidatsPanel";
import EmployesPanel from "./EmployesPanel";
import HistoriquePanel from "./HistoriquePanel";
import PostesPanel from "./PostesPanel";
import CartesPanel from "./CartesPanel";
import PresencesPanel from "./PresencesPanel";
import SimulationPanel from "./SimulationPanel";
import ReglagesPanel from "./ReglagesPanel";

const PAGES = {
  live: LivePage,
  candidats: CandidatsPanel,
  employes: EmployesPanel,
  historique: HistoriquePanel,
  postes: PostesPanel,
  cartes: CartesPanel,
  presences: PresencesPanel,
  simulation: SimulationPanel,
  reglages: ReglagesPanel,
};

export default function Dashboard() {
  const [tab, setTab] = useState("live");
  const Page = PAGES[tab] || LivePage;

  return (
    <div className="app-shell">
      <Topbar />
      <Sidebar active={tab} onChange={setTab} />
      <main className="main">
        <Page />
      </main>
      <FeedTicker />
    </div>
  );
}
