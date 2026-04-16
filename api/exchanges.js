import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Pastikan variabel lingkungan terbaca
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Variabel SUPABASE_URL atau KEY belum diset di Vercel" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { type } = req.query;

  try {
    // Gunakan query sederhana dulu untuk tes
    let query = supabase.from('exchanges').select('*');
    
    // Jika ada filter type (cex/dex), baru kita filter
    if (type) {
      query = query.eq('type', type.toLowerCase());
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error) {
    // Ini akan memunculkan detail error di log Vercel
    console.error("Supabase Error:", error.message);
    return res.status(500).json({ 
      error: "Gagal mengambil data dari Supabase", 
      details: error.message 
    });
  }
}
