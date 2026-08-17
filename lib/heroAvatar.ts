/* ==========================================================
   HERO AVATAR — the center node of the skill constellation.

   Deliberately its own file, independent of SKILL_GRAPH in
   content.ts: the avatar (who you are) and the domains (what you
   know) are separate concerns that should be swappable on their
   own schedule. Replacing the portrait later is a one-line change
   here — drop the new image in /public/avatars/ and update `image`;
   nothing in SkillConstellation or content.ts needs to move.
   ========================================================== */
export const HERO_AVATAR = {
  image: '/avatars/hero-avatar.png',
  name: 'Phanindra Uppalapati',
  title: 'Senior Lead Engineer',
};
