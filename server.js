require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// 🌍 CORS — libera o frontend (static site) a chamar essa API
app.use(cors({ origin: '*' }));

const TOKEN = process.env.SYMPA_TOKEN;
const EVENT_ID = process.env.EVENT_ID;
const BASE_URL = 'https://api.sympla.com.br/public/v3';

const headers = {
  S_TOKEN: TOKEN,
};

// 🔎 1. VALIDAR EVENTO
async function validarEvento() {
  const res = await axios.get(`${BASE_URL}/events/${EVENT_ID}`, { headers });
  const evento = res.data.data;

  return {
    id: evento.id,
    nome: evento.name,
    inicio: evento.start_date,
    fim: evento.end_date,
  };
}

// 👥 2. PEGAR PARTICIPANTES (com paginação)
async function getParticipantes() {
  let page = 1;
  let all = [];

  while (true) {
    const res = await axios.get(
      `${BASE_URL}/events/${EVENT_ID}/participants?page=${page}`,
      { headers }
    );

    const data = res.data.data;
    if (!data || data.length === 0) break;

    all = all.concat(data);
    page++;
  }

  return all;
}

// 📸 INSTAGRAM
function getInstagram(participant) {
  const form = participant.custom_form;
  if (!form) return null;

  if (Array.isArray(form)) {
    const campo = form.find(
      (f) => f.name && f.name.toLowerCase().includes('instagram')
    );
    return campo ? campo.value : null;
  }

  if (form.name && form.name.toLowerCase().includes('instagram')) {
    return form.value;
  }

  return null;
}

// 🎯 3. SORTEIO
function sortear(participantes) {
  const validos = participantes.filter((p) => p.order_status === 'A');

  if (validos.length === 0) {
    throw new Error('Nenhum participante válido');
  }

  const unicos = Object.values(
    validos.reduce((acc, p) => {
      acc[p.email] = p;
      return acc;
    }, {})
  );

  const index = Math.floor(Math.random() * unicos.length);
  return unicos[index];
}

// 🌐 ENDPOINT — aceita /sortear e /api/sortear
async function handleSortear(req, res) {
  try {
    const evento = await validarEvento();
    const participantes = await getParticipantes();
    const vencedor = sortear(participantes);

    return res.json({
      evento,
      total_participantes: participantes.length,
      vencedor: {
        id: vencedor.id,
        nome: `${vencedor.first_name} ${vencedor.last_name}`,
        instagram: getInstagram(vencedor),
        email: vencedor.email,
        ticket: vencedor.ticket_number,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      erro: true,
      detalhe: error.response?.data || error.message,
    });
  }
}

app.get('/sortear', handleSortear);
app.get('/api/sortear', handleSortear);

// healthcheck (útil pro Render)
app.get('/', (req, res) => res.json({ ok: true, service: 'turbo-b' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
