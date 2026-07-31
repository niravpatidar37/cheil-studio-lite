import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProductsProvider } from "./context/ProductsContext";
import Home from "./pages/Home";
import ImageCampaign from "./pages/ImageCampaign";
import VideoCampaign from "./pages/VideoCampaign";
import EmailCampaign from "./pages/EmailCampaign";

function App() {
  return (
    <ProductsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          {/* The :id variants resume a saved campaign; the bare paths start one. */}
          <Route path="/image" element={<ImageCampaign />} />
          <Route path="/image/:id" element={<ImageCampaign />} />
          <Route path="/video" element={<VideoCampaign />} />
          <Route path="/video/:id" element={<VideoCampaign />} />
          <Route path="/email" element={<EmailCampaign />} />
          <Route path="/email/:id" element={<EmailCampaign />} />
        </Routes>
      </BrowserRouter>
    </ProductsProvider>
  );
}

export default App;
