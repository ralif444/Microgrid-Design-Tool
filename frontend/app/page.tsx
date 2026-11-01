import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>Microgrid design tool</h1>
      <p>Stage 1.1 skeleton: the calculation engine is the Fake Engine; results are placeholders.</p>
      <p><Link href="/power-flow/">Go to Power flow (M1)</Link></p>
    </>
  );
}
