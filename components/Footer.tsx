import { PROFILE } from '@/lib/content';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="foot">
      <span>
        © <span id="footYear">{year}</span> <span id="footName">{PROFILE.name}</span>
      </span>
      <span>Crafted with a data-driven engineering journey</span>
    </footer>
  );
}
