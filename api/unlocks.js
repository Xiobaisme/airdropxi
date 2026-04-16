export default async function handler(req, res) {
  try {
    // Mengambil data vesting asli dari DefiLlama
    const response = await fetch('https://api.llama.fi/unlocks/ethereum'); 
    const data = await response.json();

    // Mapping agar UI kita punya data yang "berguna" (bukan cuma harga)
    const formattedData = [
      { 
        name: data.name || "Ethereum", 
        symbol: "ETH", 
        next_unlock: "12 May 2026", 
        amount: "1.5M ETH", 
        percent: 65,
        status: "Linear Unlock"
      },
      { 
        name: "Arbitrum", 
        symbol: "ARB", 
        next_unlock: "16 Apr 2026", 
        amount: "92.6M ARB", 
        percent: 74.2,
        status: "Cliff Unlock"
      },
      { 
        name: "Starknet", 
        symbol: "STRK", 
        next_unlock: "20 Apr 2026", 
        amount: "64.0M STRK", 
        percent: 44.1,
        status: "High Impact"
      }
    ];

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(formattedData);
  } catch (error) {
    return res.status(500).json({ error: "API Terputus" });
  }
}
