export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const URL   = process.env.KV_REST_API_URL;
  const TOKEN = process.env.KV_REST_API_TOKEN;

  if (!URL || !TOKEN) {
    res.status(500).json({ error: 'Upstash non configuré' });
    return;
  }

  // Appel Upstash REST API
  const upstash = async (cmd) => {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd)
    });
    return r.json();
  };

  const params = req.method === 'GET' ? req.query : (req.body || {});
  const { action, key, value } = params;

  try {
    // GET — charger une facture
    if (action === 'get') {
      const r = await upstash(['GET', `lc:${key}`]);
      res.json({ value: r.result ? JSON.parse(r.result) : null });

    // SET — sauvegarder une facture
    } else if (action === 'set') {
      await upstash(['SET', `lc:${key}`, JSON.stringify(value)]);
      // Mettre à jour l'index
      const idx = await upstash(['GET', 'lc:__index__']);
      const list = idx.result ? JSON.parse(idx.result) : [];
      if (!list.includes(key)) {
        list.push(key);
        await upstash(['SET', 'lc:__index__', JSON.stringify(list)]);
      }
      res.json({ ok: true });

    // DELETE — supprimer une facture
    } else if (action === 'delete') {
      await upstash(['DEL', `lc:${key}`]);
      const idx = await upstash(['GET', 'lc:__index__']);
      const list = idx.result ? JSON.parse(idx.result).filter(k => k !== key) : [];
      await upstash(['SET', 'lc:__index__', JSON.stringify(list)]);
      res.json({ ok: true });

    // LIST — lister toutes les clés
    } else if (action === 'list') {
      const idx = await upstash(['GET', 'lc:__index__']);
      res.json({ keys: idx.result ? JSON.parse(idx.result) : [] });

    } else {
      res.status(400).json({ error: 'Action inconnue' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
