/* ==========================================================
   AWARDS DATA — the complete public awards list.
   To add, edit, or remove an award, only this file needs to
   change; components/AwardsSection.tsx sorts and filters it
   dynamically (newest first, and by `selected`), so nothing
   else needs to be touched or recalculated by hand.

   - date: ISO 'YYYY-MM-DD' (displayed as 'D MMM YYYY')
   - selected: true = shown in the default "Selected" view;
     false = only shown when "All" is picked
   ========================================================== */

export type AwardRecord = {
  id: string;
  date: string;
  name: string;
  employer: string;
  selected: boolean;
};

const TCS = 'Tata Consultancy Services';

export const AWARDS_DATA: AwardRecord[] = [
  { id: '2026-03-31-applause-for-team-award', date: '2026-03-31', name: 'Applause for Team Award', employer: TCS, selected: true },
  { id: '2024-06-04-best-team-award', date: '2024-06-04', name: 'Best Team Award', employer: TCS, selected: true },
  { id: '2023-02-21-service-and-commitment-award', date: '2023-02-21', name: 'Service & Commitment Award', employer: TCS, selected: true },
  { id: '2022-04-26-contextual-master-award', date: '2022-04-26', name: 'Contextual Master Award', employer: TCS, selected: true },
  { id: '2021-03-17-contextual-master-award', date: '2021-03-17', name: 'Contextual Master Award', employer: TCS, selected: true },
  { id: '2021-03-11-star-of-the-month-award', date: '2021-03-11', name: 'Star of the Month Award', employer: TCS, selected: true },
  { id: '2020-12-31-applause-award', date: '2020-12-31', name: 'Applause Award', employer: TCS, selected: true },
  { id: '2018-02-21-service-and-commitment-award', date: '2018-02-21', name: 'Service & Commitment Award', employer: TCS, selected: false },
  { id: '2017-12-28-on-the-spot-award', date: '2017-12-28', name: 'On The Spot Award', employer: TCS, selected: false },
  { id: '2017-05-18-ideamax-pride', date: '2017-05-18', name: 'Ideamax Pride', employer: TCS, selected: true },
  { id: '2017-01-04-star-team-award', date: '2017-01-04', name: 'Star Team Award', employer: TCS, selected: false },
  { id: '2016-10-21-applause-award', date: '2016-10-21', name: 'Applause Award', employer: TCS, selected: false },
  { id: '2016-08-17-on-the-spot-award', date: '2016-08-17', name: 'On The Spot Award', employer: TCS, selected: false },
  { id: '2016-06-17-special-initiative-award', date: '2016-06-17', name: 'Special Initiative Award', employer: TCS, selected: true },
  { id: '2016-02-21-service-and-commitment-award', date: '2016-02-21', name: 'Service & Commitment Award', employer: TCS, selected: false },
  { id: '2016-01-14-best-team-award', date: '2016-01-14', name: 'Best Team Award', employer: TCS, selected: false },
  { id: '2015-08-24-special-initiative-award', date: '2015-08-24', name: 'Special Initiative Award', employer: TCS, selected: false },
  { id: '2015-07-31-best-team-award', date: '2015-07-31', name: 'Best Team Award', employer: TCS, selected: false },
  { id: '2014-12-08-star-of-the-month-award', date: '2014-12-08', name: 'Star of the Month Award', employer: TCS, selected: false },
  { id: '2014-07-28-on-the-spot-award', date: '2014-07-28', name: 'On The Spot Award', employer: TCS, selected: false },
  { id: '2013-05-17-ilp-kudos-award', date: '2013-05-17', name: 'ILP Kudos Award', employer: TCS, selected: false },
];
