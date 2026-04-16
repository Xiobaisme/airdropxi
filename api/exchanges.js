import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { type = 'cex' } = req.query;

  try {
    const { data, error } = await supabase
      .from('exchanges')
      .select('*')
      .eq('type', type)
      .order('rank', { ascending: true });

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed' });
  }
}
