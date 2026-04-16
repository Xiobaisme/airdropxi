import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { type } = req.query;
  
  // Ambil variabel lingkungan
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  // Cek apakah variabel tersedia untuk menghindari crash
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Missing Supabase Environment Variables" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('exchanges')
      .select('*')
      .eq('type', type);

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Gagal mengambil data dari Supabase", details: error.message });
  }
}
