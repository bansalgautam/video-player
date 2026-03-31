import { useSearchParams } from "react-router";
import { VideoPlayer } from "./components/VideoPlayer";
import { UrlInput } from "./components/UrlInput";
import { ShareControl } from "./components/ShareControl";
import "./App.css";

function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const videoUrl = searchParams.get("url");

  const handleLoad = (url: string) => {
    setSearchParams({ url });
  };

  const handleClear = () => {
    setSearchParams({});
  };

  return (
    <div className="app">
      {videoUrl ? (
        <div className="player-wrapper">
          <VideoPlayer src={videoUrl} />
          <div className="player-actions">
            <button className="change-video-btn" onClick={handleClear}>
              Change Video
            </button>
            <ShareControl videoUrl={videoUrl} />
          </div>
        </div>
      ) : (
        <UrlInput onLoad={handleLoad} />
      )}
    </div>
  );
}

export default App;
