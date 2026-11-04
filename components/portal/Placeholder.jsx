import { Eyebrow, Title, card } from "./ui";

export default function Placeholder({ eyebrow, title, text }) {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      <p className={`${card} mt-8 p-6 text-sm font-light text-[#9a9aa3]`}>{text}</p>
    </>
  );
}
