// Fælles data for stemmesiden, resultatsiden og API'et.
// Id'erne (k01–k22) gemmes i stemmerne. Ændr derfor aldrig et eksisterende
// id, når afstemningen er i gang – kun visningsnavnet må rettes.

export const KATEGORIER = Object.freeze([
  { id: 'spiller', navn: 'Årets spiller' },
  { id: 'fighter', navn: 'Årets fighter' },
  { id: 'udvikler', navn: 'Årets udvikler' },
  { id: 'bidragsyder', navn: 'Årets bidragsyder' },
]);

export const KANDIDATER = Object.freeze([
  { id: 'k01', navn: 'Jonathan Schaadt Jensen' },
  { id: 'k02', navn: 'Lasse Alexander Pedersen' },
  { id: 'k03', navn: 'Mads Graungaard Johansen' },
  { id: 'k04', navn: 'Mark Pheiffer' },
  { id: 'k05', navn: 'Marko Petrovic' },
  { id: 'k06', navn: 'Mathias Mørch Jørdorf Hansen' },
  { id: 'k07', navn: 'Nikolaj Hellesøe Mathiesen' },
  { id: 'k08', navn: 'Philip Stahl' },
  { id: 'k09', navn: 'Søren Andreas Schmidt' },
  { id: 'k10', navn: 'Thorbjørn Grønborg' },
  { id: 'k11', navn: 'Jakob Hellesøe Mathiesen' },
  { id: 'k12', navn: 'Joakim Kristensen' },
  { id: 'k13', navn: 'Jonas Egebjerg Brast' },
  { id: 'k14', navn: 'Aleksandar Lalevic' },
  { id: 'k15', navn: 'Alexander Bruun' },
  { id: 'k16', navn: 'Andreas Hansen' },
  { id: 'k17', navn: 'Bertram Stybe' },
  { id: 'k18', navn: 'Christen Peter Brændstrup Christensen' },
  { id: 'k19', navn: 'Christian Kærgaard' },
  { id: 'k20', navn: 'Christopher Madsen' },
  { id: 'k21', navn: 'Frederik Kloppenborg' },
  { id: 'k22', navn: 'Gustav Lunde' },
]);
