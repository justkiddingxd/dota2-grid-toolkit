// Every surface uses the same camera. Screen and platform meet at y = 100%.
export default function StageArtwork({ image }) {
  return <div className="editor-visual visual-stage">
    <div className="stage-camera">
      <div className="stage-world">
    <div className="stage-architecture" aria-hidden="true">
      <svg viewBox="0 0 500 440" fill="none">
        <path className="architecture-side" d="M54 38 441 416M54 247v169h169M271 38h170v170" />
        <path className="architecture-face" d="M40 24 427 402M40 233v169h169M257 24h170v170" />
        <path className="architecture-edge" d="M40 24 427 402M40 233v169h169M257 24h170v170" />
      </svg>
    </div>
      <div className="stage-platform" aria-hidden="true">
        <div className="platform-face platform-top" />
        <div className="platform-face platform-front" />
        <div className="platform-face platform-left" />
        <div className="platform-face platform-right" />
      </div>
      <div className="stage-contact-shadow" aria-hidden="true" />
      <div className="stage-screen">
        <img className="editor-shot" src={image} alt="Сетка Dota 2 в GridStudio: портреты героев, рисунок из символов и панель редактирования" width="1280" height="675" fetchPriority="high" draggable="false" />
      </div>
    </div>
    </div>
  </div>;
}
