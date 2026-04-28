require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();

const TOKEN = process.env.SYMPA_TOKEN;
const EVENT_ID = process.env.EVENT_ID;
const BASE_URL = 'https://api.sympla.com.br/public/v3';

const headers = {
  S_TOKEN: TOKEN
};

// 🔎 1. VALIDAR EVENTO
async function validarEvento() {
  const res = await axios.get(`${BASE_URL}/events/${EVENT_ID}`, { headers });
  const evento = res.data.data;

  return {
    id: evento.id,
    nome: evento.name,
    inicio: evento.start_date,
    fim: evento.end_date
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

// 🎯 3. SORTEIO (com regras)
function sortear(participantes) {
  // apenas pedidos aprovados
  const validos = participantes.filter(p => p.order_status === 'A');

  if (validos.length === 0) {
    throw new Error('Nenhum participante válido');
  }

  // evita duplicidade por email (1 chance por pessoa)
  const unicos = Object.values(
    validos.reduce((acc, p) => {
      acc[p.email] = p;
      return acc;
    }, {})
  );

  const index = Math.floor(Math.random() * unicos.length);
  return unicos[index];
}

// 🌐 ENDPOINT DE PRODUÇÃO
app.get('/sortear', async (req, res) => {
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
        email: vencedor.email,
        ticket: vencedor.ticket_number
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      erro: true,
      detalhe: error.response?.data || error.message
    });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`API rodando na porta ${process.env.PORT}`);
});