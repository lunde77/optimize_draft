const draftForm = document.getElementById('draft-form');
const summary = document.getElementById('summary');
const roundList = document.getElementById('suggested-rounds');

const templatePlan = ['RB', 'RB', 'WR', 'WR', 'TE', 'QB', 'WR', 'RB', 'WR', 'TE', 'QB', 'RB', 'WR'];

draftForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const leagueName = document.getElementById('league').value.trim();
  const rounds = Number(document.getElementById('rounds').value);
  const teams = Number(document.getElementById('teams').value);
  const format = document.getElementById('format').value;

  const picks = templatePlan.slice(0, rounds);
  summary.textContent = `${leagueName || 'Your league'} • ${teams} teams • ${rounds} rounds • ${format.toUpperCase()} scoring`;

  roundList.innerHTML = '';
  picks.forEach((position, index) => {
    const li = document.createElement('li');
    li.textContent = `Round ${index + 1}: Target ${position}`;
    roundList.appendChild(li);
  });
});
