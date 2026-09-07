const express = require('express');
const app = express();

app.use(express.json());

app.use('/weeks', require('./routes/weeks'));
app.use('/exercises', require('./routes/exercises'));
app.use('/logs', require('./routes/logs'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Gamma Bomb API running on port ${PORT}`));
