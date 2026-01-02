import type { ReactNode } from "react";
import Footer from "@/components/marketing/Footer";
import SideNavbar from "@/components/marketing/SideNavbar";
import TopBanner from "@/components/marketing/TopBanner";
import MobileNavDrawer from "@/components/marketing/MobileNavDrawer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      {/* <Navbar /> */}
      <TopBanner />
      <MobileNavDrawer />
      <SideNavbar />
      <main className="pt-24">
        { children }
      </main>
      <Footer />
    </div>
  )
}