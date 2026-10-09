import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// Public website shell. The private /studio area has its own layout and does
// not inherit the public navigation or footer.
export default function SiteLayout({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
