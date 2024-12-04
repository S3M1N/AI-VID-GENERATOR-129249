import axios from "axios";
import { FormEvent, useState } from "react";

function App() {
  const [url, setUrl] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("");

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setLoadingMessage("Generating assets...");
    try {
      const assetsResponse = await axios.get(
        "http://localhost:8080/create-story?url=" + encodeURIComponent(url)
      );
      const id = await assetsResponse.data;
      setLoadingMessage("Preparing your video...");
      const videoResponse = await axios.get(
        "http://localhost:8080/build-video?id=" + id
      );
      setLoadingMessage("");
      window.location.href = "http://localhost:8080/" + videoResponse.data;
    } catch (error) {
      console.error("Error during video creation:", error);
      setLoadingMessage("Error creating video. Please try again.");
    }
  }

  return (
    <>
      {loadingMessage && (
        <div className="fixed inset-0 bg-black/90 flex justify-center items-center">
          <p className="text-4xl text-center">{loadingMessage}</p>
        </div>
      )}
      <main className="max-w-2xl mx-auto flex gap-8 px-4">
        <div className="py-8 flex flex-col justify-center">
          <h1 className="text-4xl font-bold uppercase mb-4">
            <span className="text-5xl">URL to Video</span>
            <br />
            <span className="bg-gradient-to-br from-emerald-300 from-30% to-sky-300 bg-clip-text text-transparent">
              with power of AI
            </span>
          </h1>
          <form onSubmit={handleSubmit} className="grid gap-2">
            <input
              className="bg-transparent text-white border-2 rounded-full px-4 py-2 grow"
              value={url}
              onChange={(ev) => setUrl(ev.target.value)}
              type="url"
              placeholder="https://..."
            />
            <button
              className="bg-emerald-500 text-white px-4 py-2 rounded-full uppercase"
              type="submit"
            >
              Create&nbsp;Video
            </button>
          </form>
        </div>
        <div className="py-4">
          <div className="bg-gray-200 w-[240px] h-[380px] text-gray-500 rounded-2xl p-8">
            video here
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
