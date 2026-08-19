import { FeedList } from "../components/LiveFeed";

export default function LivePage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Vue projecteur</div>
          <h1>Direct</h1>
        </div>
      </div>

      <section className="panel live-panel">
        <FeedList limit={150} />
      </section>
    </div>
  );
}
