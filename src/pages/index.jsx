import dynamic from "next/dynamic";

const CityScene = dynamic(() => import("../components/CityScene"), {
  ssr: false
});

export default function Home() {
  return <CityScene />;
}