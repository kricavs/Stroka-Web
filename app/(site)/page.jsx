import { getHomeData } from "@/lib/home-data";
import HomeHero from "@/components/home/HomeHero";
import HomeWork from "@/components/home/HomeWork";
import HomeServices from "@/components/home/HomeServices";
import HomeReferences from "@/components/home/HomeReferences";
import HomeContact from "@/components/home/HomeContact";

// Content comes from Studio (images, selected work, published references);
// Studio saves call revalidatePath("/"), the interval is only a safety net.
export const revalidate = 300;

export default async function Home() {
  const { hero, work, testimonials, contact } = await getHomeData();
  return (
    <>
      <HomeHero image={hero} />
      <HomeWork items={work} />
      <HomeServices />
      <HomeReferences items={testimonials} />
      <HomeContact image={contact} />
    </>
  );
}
